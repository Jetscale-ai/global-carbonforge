import assert from "node:assert/strict";
import test from "node:test";

import {
  REGIONAL_PLACEMENTS,
  selectRegionalPlacement,
} from "../src/placements/aws";

test("specifies every documented p5.4xlarge candidate region", () => {
  assert.deepEqual(
    new Set(Object.values(REGIONAL_PLACEMENTS).map(({ region }) => region)),
    new Set([
      "us-east-1",
      "us-east-2",
      "us-west-2",
      "ap-northeast-1",
      "ap-southeast-3",
      "eu-west-2",
      "ap-south-1",
      "ap-southeast-2",
      "sa-east-1",
    ]),
  );
});

test("selects each approved Ohio placement as one coherent unit", () => {
  for (const id of ["us-east-2a", "us-east-2b", "us-east-2c"] as const) {
    assert.deepEqual(selectRegionalPlacement(id), {
      ...REGIONAL_PLACEMENTS[id],
      id,
      accelerator: "nvidia-h100",
      gpuCount: 1,
      machineType: "p5.4xlarge",
      readiness: "ready",
    });
  }
});

test("rejects unknown placements", () => {
  assert.throws(
    () => selectRegionalPlacement("moon-1a"),
    /Unknown activePlacement/,
  );
});

test("rejects candidates whose quota appeal is still pending", () => {
  assert.throws(
    () => selectRegionalPlacement("ap-southeast-2b"),
    /quota is still under appeal/,
  );
});
