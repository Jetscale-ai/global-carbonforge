import assert from "node:assert/strict";
import test from "node:test";

import {
  type RegionalNetwork,
  selectAllowedInferenceCidr,
} from "../src/stack-dependencies";
import type { PrivateInferenceTransport } from "../src/private-inference-transport";

const sameVpcNetwork: RegionalNetwork = {
  privateSubnetIds: ["subnet-primary"],
  vpcCidr: "10.0.0.0/16",
  vpcId: "vpc-primary",
};

const remoteNetwork: RegionalNetwork = {
  privateSubnetIds: ["subnet-remote"],
  vpcCidr: "10.24.0.0/16",
  vpcId: "vpc-remote",
};

const transport: PrivateInferenceTransport = {
  accepterVpcCidr: "10.24.0.0/16",
  accepterVpcId: "vpc-remote",
  peeringConnectionId: "pcx-private",
  requesterRegion: "us-east-1",
  requesterVpcCidr: "10.0.0.0/16",
  requesterVpcId: "vpc-primary",
  status: "active",
};

test("uses same-VPC CIDR when the selected region has no peering transport", () => {
  assert.equal(
    selectAllowedInferenceCidr(
      "JetScale/global-cloud-network/live",
      "us-east-1",
      sameVpcNetwork,
    ),
    "10.0.0.0/16",
  );
});

test("uses requester CIDR from peering transport for remote regions", () => {
  assert.equal(
    selectAllowedInferenceCidr(
      "JetScale/global-cloud-network/live",
      "us-west-2",
      remoteNetwork,
      transport,
    ),
    "10.0.0.0/16",
  );
});

test("fails closed when neither same-VPC CIDR nor peering transport is exported", () => {
  assert.throws(
    () =>
      selectAllowedInferenceCidr(
        "JetScale/global-cloud-network/live",
        "us-east-1",
        {
          privateSubnetIds: ["subnet-primary"],
          vpcId: "vpc-primary",
        },
      ),
    /same-VPC inference CIDR or private inference transport/,
  );
});
