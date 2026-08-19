import assert from "node:assert/strict";
import test from "node:test";

import { authorizeRuntimeIdentity } from "../src/guards";

const baseInput = {
  accountId: "728827482753",
  arn: "arn:aws:sts::728827482753:assumed-role/AWSReservedSSO_PlatformReadOnly_hash/operator",
  targetAccountId: "728827482753",
  project: "global-carbonforge",
  stack: "live",
  isDryRun: true,
  allowLocalLiveMutation: false,
};

test("allows a live preview after verifying the target account", () => {
  assert.equal(authorizeRuntimeIdentity(baseInput), "allow");
});

test("rejects the wrong AWS account", () => {
  assert.throws(
    () =>
      authorizeRuntimeIdentity({
        ...baseInput,
        accountId: "000000000000",
      }),
    /Wrong AWS account/,
  );
});

test("allows live mutation through the stack deployment role", () => {
  assert.equal(
    authorizeRuntimeIdentity({
      ...baseInput,
      stack: "live-aws-us-east-1b",
      arn: "arn:aws:sts::728827482753:assumed-role/global-carbonforge-live-aws-us-east-1b-pulumi-deployment/pulumi-deployment",
      isDryRun: false,
    }),
    "allow",
  );
});

test("does not let provider-specific live stacks bypass mutation controls", () => {
  assert.throws(
    () =>
      authorizeRuntimeIdentity({
        ...baseInput,
        stack: "live-aws-us-east-1b",
        isDryRun: false,
      }),
    /require the stack deployment role/,
  );
});

test("allows explicitly authorized live mutation through global-breakglass-admin", () => {
  assert.equal(
    authorizeRuntimeIdentity({
      ...baseInput,
      arn: "arn:aws:sts::728827482753:assumed-role/global-breakglass-admin/LOCAL-123",
      isDryRun: false,
      allowLocalLiveMutation: true,
    }),
    "allow-breakglass",
  );
});

test("rejects break-glass identity without explicit mutation intent", () => {
  assert.throws(
    () =>
      authorizeRuntimeIdentity({
        ...baseInput,
        arn: "arn:aws:sts::728827482753:assumed-role/global-breakglass-admin/LOCAL-123",
        isDryRun: false,
      }),
    /require the stack deployment role/,
  );
});

test("rejects explicit mutation intent for an unrelated identity", () => {
  assert.throws(
    () =>
      authorizeRuntimeIdentity({
        ...baseInput,
        arn: "arn:aws:sts::728827482753:assumed-role/Administrator/operator",
        isDryRun: false,
        allowLocalLiveMutation: true,
      }),
    /require the stack deployment role/,
  );
});
