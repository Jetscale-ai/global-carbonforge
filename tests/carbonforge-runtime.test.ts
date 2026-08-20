import assert from "node:assert/strict";
import test from "node:test";

import {
  GHCR_TOKEN_SECRET_NAME_SUFFIX,
  INSTANCE_DELETE_BEFORE_REPLACE,
  LICENSE_SECRET_NAME_SUFFIX,
  SECRET_RECOVERY_WINDOW_DAYS,
} from "../src/carbonforge-runtime";

test("preserves the active H100 until its replacement is ready", () => {
  assert.equal(INSTANCE_DELETE_BEFORE_REPLACE, false);
});

test("makes stack-owned secret recreation independent of AWS tombstones", () => {
  assert.equal(SECRET_RECOVERY_WINDOW_DAYS, 0);
  assert.equal(GHCR_TOKEN_SECRET_NAME_SUFFIX, "ghcr-pull-token-");
  assert.equal(LICENSE_SECRET_NAME_SUFFIX, "license-key-");
});
