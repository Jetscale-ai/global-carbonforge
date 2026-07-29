# Verification runbook

Run these checks only after a human-authorized deployment. Do not place tokens,
licence values, prompts containing sensitive data, or generated user content in
verification logs or tickets.

## Infrastructure checks

1. Confirm the workload exists in account `728827482753` and the intended
   private subnet.
2. Confirm there is no public IPv4 address and no SSH ingress.
3. Confirm the CarbonForge security group initially has no ingress. After
   LiteLLM integration, confirm its standalone TCP `8000` rule is sourced only
   from the intended LiteLLM ECS task security group.
4. Confirm Systems Manager can administer the instance using the approved role.
5. Confirm the running container resolves to
   `ghcr.io/jetscale-ai/carbonforge-eval@sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de`,
   the model cache contains revision
   `97f5941bf617e31c5e237364a8602ce3f03a551a`, and runtime is offline.
6. Through SSM, verify `systemctl status carbonforge`, `docker compose ps`,
   `nvidia-smi`, and `/var/log/carbonforge-bootstrap.log` without copying secret
   material into evidence.
7. Confirm the effective container process command contains the pinned Qwen3.5
   model and does not contain `--dry-run` or `Qwen/Qwen2.5-7B-Instruct`.
8. Record driver and CUDA compatibility, root-volume free space, Docker storage
   use, model-cache size, and SSM reachability.

## Runtime checks

Run the automated smoke test from an authorized private-network client:

```bash
CARBONFORGE_BASE_URL=http://PRIVATE_ENDPOINT:8000/v1 pnpm smoke:runtime
```

The test:

1. Refuses endpoints that resolve outside loopback or RFC 1918/private IPv6
   ranges, including the EC2 metadata link-local address.
2. Calls `/v1/models` and requires `Qwen/Qwen3.5-27B-FP8` to be listed.
3. Calls `/v1/chat/completions` with the fixed non-sensitive prompt
   `Say hello.`, `max_tokens: 32`, and `temperature: 0`.
4. Requires an OpenAI-compatible message or tool-call response from the expected
   model.
5. Emits only endpoint, model, finish reason, token counts, and total duration;
   it does not print generated content.
6. Fails after 30 seconds by default. Set
   `CARBONFORGE_SMOKE_TIMEOUT_MS` only when a reviewed test needs a larger bound.

Then confirm the health endpoint is healthy. For the downstream handoff:

1. `global-inference-litellm` reads this stack's downstream contract through a
   one-way StackReference.
2. LiteLLM creates a standalone TCP `8000` ingress rule on the exported
   CarbonForge security group, sourced only from its ECS task security group.
3. LiteLLM registers `Qwen/Qwen3.5-27B-FP8` against the private base URL.
4. Run the equivalent fixed request through LiteLLM and retain only sanitized
   metadata.

Do not mark the service reachable merely because the Pulumi apply succeeds.
Reachability requires the private health, model discovery, direct completion,
and LiteLLM completion checks.

## Telemetry checks

Request tracing is intentionally disabled. Confirm no content-bearing trace
sink is active and inspect operational logs for absence of prompts, generated
outputs, credentials, and licence material. Add trace-specific checks only after
an authoritative destination contract and approved retention design exist.

## Evidence

Capture resource identifiers, security-group evidence, SSM status, driver/CUDA
versions, disk headroom, service and container status, effective process command,
health status, the sanitized `pnpm smoke:runtime` result, LiteLLM connectivity
result, and trace inspection results. Do not claim throughput, energy, quality,
or latency improvements until an approved benchmark method produces comparable
data.
