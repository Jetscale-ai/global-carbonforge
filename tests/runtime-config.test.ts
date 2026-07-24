import assert from "node:assert/strict";
import test from "node:test";

import {
  validateRuntimeConfig,
  type RuntimeConfig,
} from "../src/runtime-config";

const validConfig: RuntimeConfig = {
  modelName: "Qwen/Qwen3.5-27B-FP8",
  engineVersion: "0.25",
  maxModelLength: 32768,
  tensorParallelSize: 1,
  gpuMemoryUtilization: 0.7,
  maxConcurrentSequences: 4,
  runtimePort: 8000,
  scheduler: "ltr-promptlen",
  requestTraceMode: "normal",
};

test("accepts the approved normal-tracing POC configuration", () => {
  assert.deepEqual(validateRuntimeConfig(validConfig), validConfig);
});

test("rejects full tracing before data-handling controls are approved", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validConfig, requestTraceMode: "full" }),
    /requestTraceMode=full is prohibited/,
  );
});

test("rejects out-of-range GPU utilization", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validConfig, gpuMemoryUtilization: 1.1 }),
    /gpuMemoryUtilization/,
  );
});

test("rejects invalid runtime ports", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validConfig, runtimePort: 0 }),
    /runtimePort/,
  );
});
