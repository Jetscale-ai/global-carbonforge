import assert from "node:assert/strict";
import test from "node:test";

import { renderBootstrapScript } from "../src/bootstrap";

const config = {
  region: "us-east-1",
  imageReference:
    "ghcr.io/jetscale-ai/carbonforge-eval@sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de",
  modelName: "Qwen/Qwen3.5-27B-FP8",
  modelRevision: "97f5941bf617e31c5e237364a8602ce3f03a551a",
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
  requestTraceMode: "disabled" as const,
  ghcrUsername: "pcuci",
  ghcrTokenSecretArn:
    "arn:aws:secretsmanager:us-east-1:728827482753:secret:ghcr-token",
  ghcrTokenVersionId: "ghcr-version-id",
  licenseSecretArn:
    "arn:aws:secretsmanager:us-east-1:728827482753:secret:license",
  licenseVersionId: "license-version-id",
};

test("renders only secret identifiers and the immutable image reference", () => {
  const script = renderBootstrapScript(config);

  assert.match(script, new RegExp(config.ghcrTokenSecretArn));
  assert.match(script, new RegExp(config.licenseSecretArn));
  assert.match(script, new RegExp(config.ghcrTokenVersionId));
  assert.match(script, new RegExp(config.licenseVersionId));
  assert.match(script, new RegExp(config.imageReference));
  assert.doesNotMatch(script, /ghp_|license-plaintext|oauth2accesstoken/);
});

test("prefetches the pinned model revision and starts offline", () => {
  const script = renderBootstrapScript(config);

  assert.match(script, /--entrypoint hf/);
  assert.match(script, /download 'Qwen\/Qwen3\.5-27B-FP8'/);
  assert.match(script, new RegExp(`--revision '${config.modelRevision}'`));
  assert.match(script, /--cache-dir \/root\/\.cache\/huggingface/);
  assert.match(script, /HF_HUB_OFFLINE: "1"/);
  assert.doesNotMatch(script, /snapshot_download|--entrypoint python/);
});

test("overrides the vendor default with the validated runtime command", () => {
  const script = renderBootstrapScript(config);

  assert.match(script, /command:/);
  assert.match(script, /- --scheduler\n      - "ltr-promptlen"/);
  assert.match(script, /- --request-trace\n      - off/);
  assert.match(script, /- "Qwen\/Qwen3\.5-27B-FP8"/);
  assert.match(script, new RegExp(`- "${config.modelRevision}"`));
  assert.match(script, /- --max-model-len\n      - "32768"/);
  assert.match(script, /- --max-num-seqs\n      - "4"/);
  assert.match(script, /- --gpu-memory-utilization\n      - "0.7"/);
  assert.match(script, /- --reasoning-parser\n      - "qwen3"/);
  assert.match(script, /- --tool-call-parser\n      - "qwen3_coder"/);
  assert.match(script, /- --enable-auto-tool-choice/);
  assert.match(script, /- --trust-remote-code/);
  assert.match(script, /- --language-model-only/);
  assert.doesNotMatch(script, /Qwen2\.5|CF_VLLM_MODEL|CF_SCHEDULER/);
});

test("requires the pinned DLAMI Docker stack without conflicting packages", () => {
  const script = renderBootstrapScript(config);

  assert.match(script, /command -v docker/);
  assert.match(script, /docker compose version/);
  assert.match(script, /systemctl enable --now docker/);
  assert.doesNotMatch(
    script,
    /apt-get install[^\n]*(docker\.io|docker-compose-v2)/,
  );
});

test("uses a temporary Docker config and removes it", () => {
  const script = renderBootstrapScript(config);

  assert.match(script, /DOCKER_CONFIG="\$\(mktemp -d/);
  assert.match(script, /--password-stdin/);
  assert.match(script, /rm -rf "\$\{DOCKER_CONFIG\}"/);
  assert.match(script, /unset DOCKER_CONFIG/);
});

test("does not enable SSH, public networking, dry-run, or content tracing", () => {
  const script = renderBootstrapScript(config);

  assert.doesNotMatch(
    script,
    /sshd|authorized_keys|--dry-run|request-trace (standard|full)/,
  );
});
