import assert from "node:assert/strict";
import test from "node:test";

import {
  type PrivateInferenceTransport,
  validatePrivateInferenceTransport,
} from "../src/private-inference-transport";

const validTransport: PrivateInferenceTransport = {
  accepterVpcCidr: "10.22.0.0/16",
  accepterVpcId: "vpc-carbonforge",
  peeringConnectionId: "pcx-private",
  requesterRegion: "us-east-1",
  requesterVpcCidr: "10.0.0.0/16",
  requesterVpcId: "vpc-litellm",
  status: "active",
};

test("accepts an active private transport to the CarbonForge VPC", () => {
  assert.deepEqual(
    validatePrivateInferenceTransport(validTransport, "vpc-carbonforge"),
    validTransport,
  );
});

test("rejects transport that is not active", () => {
  assert.throws(
    () =>
      validatePrivateInferenceTransport(
        { ...validTransport, status: "pending-acceptance" },
        "vpc-carbonforge",
      ),
    /must be active/,
  );
});

test("rejects transport to another accepter VPC", () => {
  assert.throws(
    () => validatePrivateInferenceTransport(validTransport, "vpc-other"),
    /not vpc-other/,
  );
});

test("rejects transport from an unexpected region", () => {
  assert.throws(
    () =>
      validatePrivateInferenceTransport(
        { ...validTransport, requesterRegion: "us-west-2" },
        "vpc-carbonforge",
      ),
    /not us-east-1/,
  );
});

test("rejects public and overbroad requester CIDRs", () => {
  for (const requesterVpcCidr of ["0.0.0.0/0", "10.0.0.0/8", "8.8.0.0/16"]) {
    assert.throws(
      () =>
        validatePrivateInferenceTransport(
          { ...validTransport, requesterVpcCidr },
          "vpc-carbonforge",
        ),
      /private RFC1918 \/16/,
    );
  }
});
