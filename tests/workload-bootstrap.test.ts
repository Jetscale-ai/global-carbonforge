import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  BOOTSTRAP_FAILURE_PATH,
  BOOTSTRAP_READY_PATH,
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

test("renders syntactically valid Bash", () => {
  const result = spawnSync("bash", ["-n"], {
    input: script,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
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

test("waits through transient readiness failures with bounded deadlines", () => {
  assert.match(script, /models_deadline=\$\(\(SECONDS \+ 1800\)\)/);
  assert.match(
    script,
    /while \[ "\$\{SECONDS\}" -lt "\$\{models_deadline\}" \]/,
  );
  assert.match(script, /--connect-timeout 5 --max-time 30/);
  assert.match(script, /2>\/dev\/null \|\| true/);
  assert.match(script, /sleep 10/);
  assert.match(script, /completion_deadline=\$\(\(SECONDS \+ 300\)\)/);
  assert.match(
    script,
    /while \[ "\$\{SECONDS\}" -lt "\$\{completion_deadline\}" \]/,
  );
  assert.match(script, /--connect-timeout 5 --max-time 90/);
});

test("requires the configured model and positive completion token usage", () => {
  assert.match(script, /any\(\.\[\]; \.id == \$model\)/);
  assert.match(script, /\.model == \$model/);
  assert.match(
    script,
    /\.usage\.completion_tokens \| type == "number" and \. > 0/,
  );
  assert.match(script, /content: "Say hello\."/);
  assert.match(script, /max_tokens: 32/);
  assert.match(script, /temperature: 0/);
});

test("keeps readiness payloads transient and never emits generated content", () => {
  assert.match(script, /mktemp -d \/run\/carbonforge-readiness/);
  assert.match(script, /chmod 0600/);
  assert.match(script, /rm -rf "\$\{READINESS_DIR\}"/);
  assert.doesNotMatch(
    script,
    /cat .*completion-response|jq .*\.choices.*completion-response/,
  );
});

test("publishes an atomic marker only after runtime integrity checks", () => {
  const integrityCheck = script.indexOf("container_state=");
  const gpuCheck = script.indexOf("nvidia-smi --query-compute-apps");
  const markerCreate = script.indexOf(
    'ready_marker="$(mktemp /var/lib/carbonforge/bootstrap-ready',
  );
  const markerPublish = script.indexOf(
    `mv -f "\${ready_marker}" '${BOOTSTRAP_READY_PATH}'`,
  );

  assert.ok(integrityCheck > 0);
  assert.ok(gpuCheck > integrityCheck);
  assert.ok(markerCreate > gpuCheck);
  assert.ok(markerPublish > markerCreate);
  assert.match(script, new RegExp(BOOTSTRAP_FAILURE_PATH));
  assert.match(script, /exit "\$\{status\}"/);
});
