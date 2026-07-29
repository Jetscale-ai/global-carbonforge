# CarbonForge delivery roadmap

This roadmap describes the path from the reviewed infrastructure implementation
to a governed private inference service. Completion of a phase does
not authorize the next phase; each gate requires the listed evidence and human
approval.

## Current delivery state

The Pulumi implementation, runtime invocation, private-network contract, secret
flow, and post-deploy smoke tooling are complete and preview cleanly. The stack
is not deployed. The critical path is:

1. AWS quota request
   [`06437a82af484fe5b785bdd8fe871dd7UA0EPVGB`](https://github.com/Jetscale-ai/global-carbonforge/issues/1)
   reaches an approved state and the effective quota is verified.
2. `p5.4xlarge` capacity is rechecked in `us-east-1a`.
3. Changes are reviewed and landed; a fresh preview is run from the exact commit.
4. Existing authority bootstraps the stack-owned Pulumi Deployments role.
5. Cost and live apply receive explicit human approval.
6. Target-host, OpenAI-compatible, and LiteLLM evidence close the remaining
   runtime gates.

Quota approval removes only one blocker. It does not prove physical capacity,
authorize spend, validate the target host, or make the downstream endpoint
reachable.

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

**Status:** Blocked on AWS quota request
[`06437a82af484fe5b785bdd8fe871dd7UA0EPVGB`](https://github.com/Jetscale-ai/global-carbonforge/issues/1).
Image provenance, mirroring/licence authorization, digest pinning, concrete
AMI/subnet placement, current pricing, and runtime launch-path validation are
complete. The effective On-Demand G/VT quota remains `0`; physical capacity and
post-start compatibility evidence remain open.

- Confirmed `p5.4xlarge` is offered in the selected `us-east-1a` private subnet;
  obtain at least 16 On-Demand G/VT vCPUs and re-check physical capacity.
- Obtain explicit apply approval using the recorded `$6.88/hour` On-Demand rate
  (about `$5,022.40` for 730 hours before EBS, NAT, and transfer).
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
- Pinned `ami-02c52c305263fdec5`, the 2026-07-28 Ubuntu 22.04 NVIDIA-driver Deep
  Learning Base OSS AMI.
- Define model provenance and the relationship to `global-inference-models`.

**Exit gate:** human-approved cost/capacity evidence and a reviewed technical
runbook. No rolling container tags are acceptable.

## Phase 2 — Private H100 compute

**Status:** Implemented and previewed; not applied.

- Added a private H100 instance in the existing VPC and selected private subnet.
- Added a least-privilege instance profile, encrypted storage, IMDSv2, detailed
  monitoring, and SSM-only administration.
- Added a dedicated workload security group with no ingress. LiteLLM will own a
  standalone TCP `8000` rule sourced from its ECS task security group.
- Added a stack-scoped Pulumi Deployments role anchored in the upstream OIDC
  provider. Its first creation still requires separately approved bootstrap
  authority because the role cannot assume itself before it exists.

**Exit gate:** the non-destructive preview is clean for Global Services with 16
creates and no update/delete operations. Public IPv4 and SSH are absent. Before
apply, land the reviewed change, rerun `--diff` from that commit, bootstrap and
test the deployment role, verify quota/capacity, and obtain explicit cost and
live-apply authorization.

## Phase 3 — Secret-safe runtime bootstrap

**Status:** Implemented and previewed; boot evidence requires an apply.

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

**Status:** Service supervision and smoke-test tooling are implemented. Runtime
health and telemetry evidence require an apply.

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
  connectivity after a human-authorized apply.

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
