# Runtime invocation

## Status

The generated Compose file explicitly overrides the pinned image command.
Inspection of
`ghcr.io/jetscale-ai/carbonforge-eval@sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de`
showed that its inherited command is a `--dry-run` example for
`Qwen/Qwen2.5-7B-Instruct`. No image code was found consuming the previously
assumed `CF_SCHEDULER` or `CF_VLLM_MODEL` environment variables.

The same inspection established these relevant versions and interfaces:

- CarbonForge `0.1.8`;
- vLLM `0.26.0`;
- Transformers `5.14.1` with Qwen3.5 configuration support;
- wrapper syntax `carbonforge-runtime [wrapper options] -- MODEL [vLLM options]`;
- wrapper trace modes `off`, `standard`, and `full`;
- vLLM parser registrations `qwen3` and `qwen3_coder`; and
- bundled `hf download` support for `--revision` and `--cache-dir`.

## Implemented Compose contract

The generated `/opt/carbonforge/docker-compose.yml` is equivalent to:

```yaml
services:
  carbonforge:
    image: ghcr.io/jetscale-ai/carbonforge-eval@sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de
    pull_policy: never
    restart: unless-stopped
    command:
      - --scheduler
      - ltr-promptlen
      - --vllm-port
      - "8000"
      - --request-trace
      - off
      - --
      - Qwen/Qwen3.5-27B-FP8
      - --host
      - 0.0.0.0
      - --port
      - "8000"
      - --revision
      - 97f5941bf617e31c5e237364a8602ce3f03a551a
      - --served-model-name
      - Qwen/Qwen3.5-27B-FP8
      - --tensor-parallel-size
      - "1"
      - --max-model-len
      - "32768"
      - --gpu-memory-utilization
      - "0.7"
      - --max-num-seqs
      - "4"
      - --trust-remote-code
      - --language-model-only
      - --reasoning-parser
      - qwen3
      - --enable-auto-tool-choice
      - --tool-call-parser
      - qwen3_coder
    environment:
      HF_HUB_OFFLINE: "1"
      HF_HUB_DISABLE_TELEMETRY: "1"
    ports:
      - "8000:8000"
    volumes:
      - /etc/carbonforge/license.key:/etc/carbonforge/license.key:ro
      - /var/lib/carbonforge/huggingface:/root/.cache/huggingface
      - /var/log/carbonforge:/var/log/carbonforge
    gpus: all
```

`--dry-run` is intentionally absent. The model name, model revision, and served
model name are explicit so neither the vendor example model nor a moving Hub
branch can affect startup.

Before systemd starts Compose, bootstrap uses the digest-pinned image's bundled
`hf download` command to prefetch revision
`97f5941bf617e31c5e237364a8602ce3f03a551a` into the mounted cache. Runtime then
starts with Hub offline mode enabled. A read-only `hf download --dry-run` query
resolved the public revision without a token and reported roughly 33.7 GB of
model files across 11 safetensor shards.

The immutable image reference uses the digest independently reported by GHCR
after the mirror push. The different source-registry digest remains provenance
evidence rather than being substituted for the verified GHCR manifest digest.

## Security interpretation

- `--host 0.0.0.0` binds inside the container. It does not authorize public
  exposure. The EC2 instance remains private and port `8000` has no ingress
  until an approved workload security group creates a source-SG rule.
- Qwen3.5-27B-FP8 is public, so the container does not receive an `HF_TOKEN`.
- A least-privilege `ghcrPullToken` and the licence originate as encrypted Pulumi
  stack secrets. The GHCR token should normally carry only `read:packages`.
- Bootstrap materializes the licence mode `0600`, mounts it read-only, and uses a
  temporary Docker configuration removed after the digest-pinned pull.
- Request tracing is explicitly `off`. CarbonForge `standard` tracing excludes
  prompt and output content but does nothing without a file or endpoint sink.
  Any future sink requires encryption, access control, bounded retention, and a
  deletion path. `full` remains prohibited for user traffic without approval.
- The model cache and logs share the encrypted 150 GiB root volume. Verify free
  space and log growth after deployment; the model and image measurements do not
  include all temporary download, Docker overlay, or operational growth.

## Remaining target-host validation

The command shape and option registrations are validated from the pinned image,
but a GPU-free workstation cannot initialize vLLM's complete CLI parser because
vLLM requires a detected device while constructing defaults. After an authorized
apply, verify:

1. the pinned AMI driver satisfies the image's CUDA 13 compatibility contract;
2. the H100 loads the pinned model at the configured context and memory fraction;
3. CarbonForge activates `ltr-promptlen` rather than the stock scheduler;
4. the Qwen3 reasoning and tool parsers produce valid OpenAI-compatible output;
5. startup, shutdown, and restart complete under systemd; and
6. no inherited `--dry-run` or Qwen2.5 argument appears in the process command.

## Post-start smoke test

After a human-authorized deployment, use `pnpm smoke:runtime` from an authorized
private-network client. It validates `/v1/models` and `/v1/chat/completions`
using a fixed non-sensitive prompt and does not print generated response content.
See the [verification runbook](runbooks/verification.md).
