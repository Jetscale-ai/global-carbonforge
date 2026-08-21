# Verification runbook

Direct model discovery and token generation were verified on the rebuilt Jakarta
H100 on 2026-08-20. A fresh boot took about 17 minutes to pull the immutable
image and pinned model, followed by additional model-initialization time. EC2 and
SSM became available before the runtime; early readiness requests saw expected
connection refusals and resets before the fixed completion succeeded. Bootstrap
now tolerates those transient failures within bounded deadlines and publishes a
non-secret readiness marker only after model discovery, token generation,
container-integrity, and GPU-use checks pass. Storage, telemetry, and LiteLLM
handoff evidence remain open. Do not place credentials, licence values, prompts
containing sensitive data, or generated user content in verification logs or
tickets.

## Infrastructure checks

1. Confirm the workload exists in account `728827482753` and the intended
   private subnet.
2. Confirm there is no public IPv4 address and no SSH ingress.
3. Confirm the CarbonForge security group has exactly the intended standalone
   TCP `8000` ingress from the primary private workload VPC CIDR exported by
   `global-cloud-network`, with no public or broader source.
4. Confirm Systems Manager can administer the instance using the approved role.
5. Confirm the running container resolves to
   `ghcr.io/jetscale-ai/carbonforge-eval@sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de`,
   the model cache contains revision
   `97f5941bf617e31c5e237364a8602ce3f03a551a`, and runtime is offline.
6. Through SSM, verify `systemctl status carbonforge`, `docker compose ps`,
   `nvidia-smi`, and `/var/log/carbonforge-bootstrap.log` without copying secret
   material into evidence. Do not treat EC2 or SSM availability as runtime
   readiness.
7. Require `/var/lib/carbonforge/bootstrap-ready` and confirm
   `/var/lib/carbonforge/bootstrap-failed` is absent. The ready marker contains
   only the expected model and `status=ready`; a failure marker contains only the
   failed phase. If neither marker exists, cloud-init is still running or ended
   before the readiness contract could publish a result.
8. Confirm the effective container process command contains the pinned Qwen3.5
   model and does not contain `--dry-run` or `Qwen/Qwen2.5-7B-Instruct`.
9. Record driver and CUDA compatibility, root-volume free space, Docker storage
   use, model-cache size, and SSM reachability.

## Runtime checks

Recovery verification through SSM on 2026-08-20 recorded the following
sanitized historical result for the subsequently destroyed allocation:

```text
instance_id=i-0a48ac2883c21c468
availability_zone=ap-southeast-3a
instance_type=p5.4xlarge
public_ipv4=none
ssm_status=Online
models_http=200
expected_model_listed=true
completion_http=200
completion_model=Qwen/Qwen3.5-27B-FP8
prompt_tokens=13
completion_tokens=32
total_tokens=45
finish_reason=length
duration_seconds=1
restart_count=0
oom_killed=false
gpu_used_mib=55321
```

This proves direct model discovery and bounded token generation on the allocated
H100. It does not prove throughput, sustained latency, availability, or LiteLLM
connectivity. During fresh boot, model discovery may initially refuse or reset
connections while the container remains running. The generated bootstrap retries
model discovery for at most 30 minutes and token generation for at most 5
minutes; a timeout fails cloud-init and records only the failed phase.

For repeat verification, run the automated smoke test from an authorized
private-network client:

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

1. `global-inference-litellm` reads this stack's downstream and validated
   network contracts through a one-way StackReference.
2. Confirm `global-cloud-network` reports the selected region's peering active
   and both private route directions present.
3. LiteLLM registers `Qwen/Qwen3.5-27B-FP8` against the private base URL.
4. Run the equivalent fixed request through LiteLLM and retain only sanitized
   metadata.

Do not mark the service reachable merely because the Pulumi apply succeeds.
Pulumi reports EC2 provisioning before cloud-init necessarily completes. The
bootstrap-ready marker proves host-local model discovery, token generation, and
runtime integrity; downstream promotion still requires the private health,
direct completion, and LiteLLM completion checks.

## Telemetry checks

Request tracing is intentionally disabled. Confirm no content-bearing trace
sink is active and inspect operational logs for absence of prompts, generated
outputs, credentials, and licence material. Add trace-specific checks only after
an authoritative destination contract and approved retention design exist.

## Evidence

Capture resource identifiers, security-group evidence, SSM status, driver/CUDA
versions, disk headroom, service and container status, effective process command,
health status, the sanitized `pnpm smoke:runtime` result, LiteLLM connectivity
result, and trace inspection results. The direct SSM evidence above may satisfy
model-discovery and completion checks but not the remaining evidence categories.
Do not claim throughput, energy, quality, or latency improvements until an
approved benchmark method produces comparable data.
