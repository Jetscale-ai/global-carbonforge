import assert from "node:assert/strict";
import test from "node:test";

import {
  GHCR_TOKEN_PATH,
  LICENSE_PATH,
  renderWorkloadBootstrapScript,
} from "../src/core/workload-bootstrap";

const script = renderWorkloadBootstrapScript({
  imageReference: "ghcr.io/jetscale-ai/carbonforge-eval@sha256:abc",
  modelName: "Qwen/Qwen3.5-27B-FP8",
  modelRevision: "revision",
  scheduler: "ltr-promptlen",
  runtimePort: 8000,
  maxModelLength: 32768,
  tensorParallelSize: 1,
  gpuMemoryUtilization: 0.7,
  maxConcurrentSequences: 4,
  trustRemoteCode: true,
  languageModelOnly: true,
  reasoningParser: "qwen3",
  enableAutoToolChoice: true,
  toolCallParser: "qwen3_coder",
  ghcrUsername: "registry-user",
  ghcrTokenPath: GHCR_TOKEN_PATH,
  licensePath: LICENSE_PATH,
});

test("portable workload bootstrap depends on protected files, not a cloud CLI", () => {
  assert.match(script, new RegExp(GHCR_TOKEN_PATH));
  assert.match(script, new RegExp(LICENSE_PATH));
  assert.doesNotMatch(script, /aws secretsmanager|gcloud secrets|az keyvault/);
});

test("portable workload bootstrap removes the transient registry token", () => {
  assert.match(script, new RegExp(`rm -f '${GHCR_TOKEN_PATH}'`));
  assert.doesNotMatch(script, new RegExp(`rm -f '${LICENSE_PATH}'`));
});
