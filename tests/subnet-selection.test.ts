import assert from "node:assert/strict";
import test from "node:test";

import { selectPrivateSubnetId } from "../src/subnet-selection";

test("selects the network-owned private subnet in the placement AZ", () => {
  assert.equal(
    selectPrivateSubnetId(
      ["subnet-private-a", "subnet-private-b"],
      ["subnet-public-b", "subnet-private-b"],
      "us-east-1b",
      "us-east-1b",
    ),
    "subnet-private-b",
  );
});

test("rejects an AZ without a network-owned private subnet", () => {
  assert.throws(
    () =>
      selectPrivateSubnetId(
        ["subnet-private-a"],
        ["subnet-public-b"],
        "us-east-1b",
        "us-east-1b",
      ),
    /found 0/,
  );
});

test("rejects ambiguous private subnet selection", () => {
  assert.throws(
    () =>
      selectPrivateSubnetId(
        ["subnet-private-b1", "subnet-private-b2"],
        ["subnet-private-b1", "subnet-private-b2"],
        "us-east-1b",
        "us-east-1b",
      ),
    /found 2/,
  );
});
