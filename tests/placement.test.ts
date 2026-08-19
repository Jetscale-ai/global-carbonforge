import assert from "node:assert/strict";
import test from "node:test";

import { assertPlacementMatchesStack } from "../src/core/placement";
import { selectRegionalPlacement } from "../src/placements/aws";

test("accepts a placement that matches stack cloud and placement", () => {
  assert.doesNotThrow(() =>
    assertPlacementMatchesStack(
      selectRegionalPlacement("us-east-1b"),
      "aws",
      "us-east-1b",
    ),
  );
});

test("rejects cloud or placement drift from the stack name", () => {
  const placement = selectRegionalPlacement("us-east-1b");
  assert.throws(
    () => assertPlacementMatchesStack(placement, "gcp", "us-east-1b"),
    /Stack selects gcp\/us-east-1b/,
  );
  assert.throws(
    () => assertPlacementMatchesStack(placement, "aws", "us-east-2a"),
    /Stack selects aws\/us-east-2a/,
  );
});
