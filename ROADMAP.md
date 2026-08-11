# CarbonForge delivery roadmap

This roadmap describes the path from the reviewed infrastructure implementation
to a governed private inference service. Completion of a phase does
not authorize the next phase; each gate requires the listed evidence and human
approval.

## Current delivery state

Pulumi update 16 provisioned the private `p5.4xlarge` and supporting resources in
`ap-southeast-3a` on 2026-08-10. Updates 17 and 18 found no replacement capacity,
so the allocated H100 was retained. An `INC-002` in-place SSM recovery corrected
the Docker bootstrap conflict and offline model-cache path. On 2026-08-11, direct
model discovery and an 8-token OpenAI-compatible completion both returned HTTP
200 without a container restart or OOM.

The critical path is now:

1. Complete storage, driver/CUDA, and telemetry evidence for the recovered host.
2. Configure LiteLLM's source-security-group ingress and validate end-to-end
   routing.
3. Configure routine Pulumi Deployments use of the stack-owned deployment role.
4. Reconcile corrected user data only after replacement capacity is demonstrated
   and replacement is explicitly authorized.
5. Record Jakarta-specific cost and lifecycle evidence before continued operation
   or replacement.

The direct check proves bounded token serving, not future replacement capacity,
downstream reachability, performance, availability, or benchmark claims.

## Principles

- More compute per watt is a hypothesis to measure, not a claim this repository
  presently substantiates.
- Security, privacy, and account sovereignty are release criteria.
- `global-carbonforge` consumes network and identity contracts but never reads
  from its LiteLLM consumer.
- The durable model catalog remains owned by `global-inference-models`.

## Phase 0 — Governance and contract scaffold

**Status:** Implemented, pending review.

- Govern the repository through `../governance`.
- Create a buildable Pulumi TypeScript skeleton with account and live-mutation
  guards.
- Model the upstream network and identity contracts.
- Validate non-secret host, runtime, and container metadata and reject public
  networking, SSH, and full request tracing.
- Add secret-safe configuration helpers and a bounded OpenAI-compatible runtime
  smoke test.
- Mirror the selected evaluation image to private GHCR, independently verify its
  registry digest, and configure the immutable reference.

**Exit evidence:** dependency install, TypeScript build, unit tests, formatting
and pre-commit checks, a secret-masked non-destructive preview, and an
independently inspected GHCR digest.

## Phase 1 — Capacity, cost, and vendor validation

**Status:** Capacity and P-instance quota gate passed for the initial Jakarta
launch; lifecycle cost and replacement-capacity evidence remain open.

Image provenance, mirroring/licence authorization, digest pinning, concrete
AMI/subnet placement, and runtime launch-path validation are complete. Jakarta's
effective Running On-Demand P-instance quota is 32 vCPUs, and one 16-vCPU
`p5.4xlarge` was placed successfully in `ap-southeast-3a`.

- Preserve at least 32 Running On-Demand P-instance vCPUs for active capacity and
  replacement headroom; recheck physical capacity before any replacement.
- Record current Jakarta On-Demand cost before continued-operation, replacement,
  or expansion decisions.
- Preserve the confirmed CarbonForge authorization to mirror and operate the
  proprietary evaluation image from Jetscale's private GHCR package for the PoC.
- Preserve the verified source and GHCR image provenance evidence.
- Validate post-start compatibility. Pinned-image inspection disproved the
  assumed environment-variable contract and exposed a default dry-run Qwen2.5
  command. The implementation now overrides it with the inspected CarbonForge
  wrapper contract and vLLM options for the pinned Qwen3.5 revision.
- Validate the vendor sample's `p5.4xlarge` and NVIDIA Deep Learning AMI against
  current AWS capacity and compatibility. A pinned-revision Hub dry run measured
  roughly 33.7 GB of model files, leaving practical PoC headroom on the 150 GiB
  root volume alongside the roughly 19 GB image; verify free space after boot.
- Pinned Jakarta AMI `ami-06bc172b9832559df`, the regional copy of the
  2026-07-28 Ubuntu 22.04 NVIDIA-driver Deep Learning Base OSS AMI.
- Define model provenance and the relationship to `global-inference-models`.

**Exit gate:** human-approved cost/capacity evidence and a reviewed technical
runbook. No rolling container tags are acceptable.

## Phase 2 — Private H100 compute

**Status:** Applied in Jakarta by Pulumi update 16; infrastructure verification
is in progress.

- Added a private H100 instance in the existing VPC and selected private subnet.
- Added a least-privilege instance profile, encrypted storage, IMDSv2, detailed
  monitoring, and SSM-only administration.
- Added a dedicated workload security group with no ingress. LiteLLM will own a
  standalone TCP `8000` rule sourced from its ECS task security group.
- Added a stack-scoped Pulumi Deployments role anchored in the upstream OIDC
  provider. The initial break-glass apply created the role; routine updates must
  configure and verify Pulumi Deployments assumption of that role.

**Exit gate:** confirm the applied instance has no public IPv4 or SSH ingress,
passes EC2 and SSM checks, and is manageable through the intended deployment
identity. Future replacement-bearing previews require explicit capacity, cost,
and live-mutation review.

## Phase 3 — Secret-safe runtime bootstrap

**Status:** Applied; bootstrap completion, secret-safety, and private health
evidence remain open.

- Store the GHCR pull token and the reissued licence as
  encrypted Pulumi stack secrets; no Hugging Face token is required for the
  public model.
- Materialize secrets only during boot with restrictive permissions and remove
  temporary plaintext.
- Pull the digest-pinned GHCR image, prefetch model revision
  `97f5941bf617e31c5e237364a8602ce3f03a551a` with bundled `hf download`, then
  start Hugging Face offline using an explicit non-dry-run command.
- Persist only approved model cache and bounded operational logs.

**Exit gate:** secret scan, user-data review, boot evidence showing no secret
leakage, and successful private health check.

## Phase 4 — Service health and observability

**Status:** Service supervision and smoke-test tooling are implemented and the
host is provisioned. Runtime health and telemetry evidence remain open.

- Add a service manager and resilient startup behavior.
- Add health probes and alertable service/runtime signals.
- Run the bounded chat-completions smoke test from an authorized private client
  and retain only sanitized result metadata.
- Keep request tracing explicitly `off`. The pinned wrapper confirms `standard`
  is content-safe but requires a sink; add one only with encrypted transport,
  bounded retention, controlled access, and deletion semantics.
- Define log retention, access, and deletion paths.

**Exit gate:** documented recovery test, health evidence, and trace review
confirming prompts and outputs are absent.

## Phase 5 — LiteLLM integration

**Status:** CarbonForge output contract implemented; downstream changes and
end-to-end evidence remain open.

- Publish only the private endpoint contract needed by
  `global-inference-litellm`.
- Configure LiteLLM as the downstream caller without introducing a reverse
  StackReference.
- Validate OpenAI-compatible completions and LiteLLM-to-CarbonForge network
  connectivity against the provisioned private endpoint.

**Exit gate:** authenticated end-to-end request evidence, least-privilege
network evidence, and rollback instructions. Specifically, LiteLLM must consume
the CarbonForge StackReference, create TCP `8000` ingress on the exported runtime
security group from its ECS task security group, register the pinned model, and
pass a sanitized completion test.

## Phase 6 — Benchmark and decision evidence

- Establish a representative coding, agentic, and software workload suite.
- Measure baseline and CarbonForge variants with methodology, hardware,
  software versions, and confidence limits recorded.
- Evaluate latency, throughput, quality, cost, and energy claims without
  extrapolating beyond observed data.

**Exit gate:** reviewable benchmark report and a decision on continued
investment, expansion, or shutdown.

## Phase 7 — Production hardening and lifecycle

- Define availability targets, patching, incident response, backup/recovery,
  and capacity lifecycle controls.
- Complete threat modeling, audit evidence, and service ownership handoff.
- Evaluate scaling, multi-AZ alternatives, and retirement criteria.

**Exit gate:** accepted production-readiness decision. This is not implied by
completion of any prior phase.

## Explicit non-goals

- Immediate production readiness or public internet exposure.
- Unmeasured energy, latency, quality, or cost marketing claims.
- Long-lived capacity commitments without explicit approval.
- Full prompt/output tracing for user traffic without approved data controls.
