import assert from "node:assert/strict";
import test from "node:test";

import {
  deploymentStackName,
  isLiveDeploymentStack,
  parseDeploymentStackName,
} from "../src/core/deployment";

test("formats canonical provider-specific stack names", () => {
  assert.equal(
    deploymentStackName({
      environment: "live",
      cloud: "aws",
      placementId: "us-east-1b",
    }),
    "live-aws-us-east-1b",
  );
});

test("parses stack identity without independently configured cloud fields", () => {
  assert.deepEqual(parseDeploymentStackName("live-gcp-us-central1-a"), {
    environment: "live",
    cloud: "gcp",
    placementId: "us-central1-a",
  });
});

test("rejects ambiguous generic and malformed stack names", () => {
  assert.throws(() => parseDeploymentStackName("live"), /must follow/);
  assert.throws(
    () => parseDeploymentStackName("live-aws-US-EAST-1B"),
    /must follow/,
  );
});

test("classifies provider-specific live stacks as live", () => {
  assert.equal(isLiveDeploymentStack("live-aws-us-east-1b"), true);
  assert.equal(isLiveDeploymentStack("live-gcp-us-central1-a"), true);
  assert.equal(isLiveDeploymentStack("dev-aws-us-east-1b"), false);
});
