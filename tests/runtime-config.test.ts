import assert from "node:assert/strict";
import test from "node:test";

import {
  validateRuntimeConfig,
  type RuntimeConfig,
} from "../src/runtime-config";

const validConfig: RuntimeConfig = {
  modelName: "Qwen/Qwen3.5-27B-FP8",
  engineVersion: "0.26.0",
  maxModelLength: 32768,
  tensorParallelSize: 1,
  gpuMemoryUtilization: 0.7,
  maxConcurrentSequences: 4,
  runtimePort: 8000,
  scheduler: "ltr-promptlen",
  trustRemoteCode: true,
  languageModelOnly: true,
  reasoningParser: "qwen3",
  enableAutoToolChoice: true,
  toolCallParser: "qwen3_coder",
  requestTraceMode: "disabled",
};

test("accepts tracing disabled until the vendor contract is confirmed", () => {
  assert.deepEqual(validateRuntimeConfig(validConfig), validConfig);
});

test("rejects an engine version that differs from the pinned image", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validConfig, engineVersion: "0.25" }),
    /inspected pinned image version 0\.26\.0/,
  );
});

test("rejects normal tracing until its destination contract is confirmed", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validConfig, requestTraceMode: "normal" }),
    /requestTraceMode=normal is not enabled/,
  );
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

test("requires explicit remote-code execution for the selected model", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validConfig, trustRemoteCode: false }),
    /trustRemoteCode must be explicitly enabled/,
  );
});

test("requires the selected Qwen tool-call parser", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validConfig, toolCallParser: "other" }),
    /toolCallParser must be qwen3_coder/,
  );
});

test("rejects model lengths above the published POC limit", () => {
  assert.throws(
    () => validateRuntimeConfig({ ...validConfig, maxModelLength: 262145 }),
    /maxModelLength must not exceed/,
  );
});
