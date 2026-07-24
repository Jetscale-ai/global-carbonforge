# CarbonForge delivery roadmap

This roadmap describes the intended path from the current contract-only
scaffold to a governed private inference service. Completion of a phase does
not authorize the next phase; each gate requires the listed evidence and human
approval.

## Principles

- More compute per watt is a hypothesis to measure, not a claim this repository
  presently substantiates.
- Security, privacy, and account sovereignty are release criteria.
- `global-carbonforge` consumes network and identity contracts but never reads
  from its LiteLLM consumer.
- The durable model catalog remains owned by `global-inference-models`.

## Phase 0 — Governance and scaffold

**Status:** Complete in this change set, pending review.

- Govern the repository through `../governance`.
- Create a buildable Pulumi TypeScript skeleton with account and live-mutation
  guards.
- Model the upstream network and identity contracts.
- Validate non-secret POC runtime metadata and reject full request tracing.

**Exit evidence:** dependency install, TypeScript build, unit tests, formatting,
and a reviewed configuration diff. No AWS resources are created.

## Phase 1 — Capacity, cost, and vendor validation

- Confirm H100 availability in `us-east-1` and choose an approved instance
  family and purchase path.
- Obtain written approval for hourly cost, capacity-reservation, Savings Plan,
  or other commitment implications.
- Validate CarbonForge registry access, licence terms, image digest, vLLM
  compatibility, scheduler flags, and Qwen parser options with authoritative
  documentation.
- Define model provenance and the relationship to `global-inference-models`.

**Exit gate:** human-approved cost/capacity evidence and a reviewed technical
runbook. No rolling container tags are acceptable.

## Phase 2 — Private H100 compute

- Add a private H100 instance or launch template in the existing VPC and private
  subnets.
- Add least-privilege instance profile, encrypted storage, and SSM-only
  administration.
- Add a dedicated workload security group allowing port `8000` only from the
  authorized LiteLLM task security group.
- Add deployment role permissions scoped to this stack's resources.

**Exit gate:** non-destructive preview reviewed for the intended Global Services
account, no public address or SSH ingress, and explicit approval to apply.

## Phase 3 — Secret-safe runtime bootstrap

- Store registry credential, licence, and Hugging Face token in an approved
  secret store.
- Materialize secrets only during boot with restrictive permissions and remove
  temporary plaintext.
- Digest-pin the CarbonForge image and pin the model revision where supported.
- Persist only approved model cache and bounded operational logs.

**Exit gate:** secret scan, user-data review, boot evidence showing no secret
leakage, and successful private health check.

## Phase 4 — Service health and observability

- Add a service manager and resilient startup behavior.
- Add health probes and alertable service/runtime signals.
- Export normal, content-safe telemetry to an encrypted and access-controlled
  destination with bounded retention.
- Define log retention, access, and deletion paths.

**Exit gate:** documented recovery test, health evidence, and trace review
confirming prompts and outputs are absent.

## Phase 5 — LiteLLM integration

- Publish only the private endpoint contract needed by
  `global-inference-litellm`.
- Configure LiteLLM as the downstream caller without introducing a reverse
  StackReference.
- Validate OpenAI-compatible completions and LiteLLM-to-CarbonForge network
  connectivity after a human-authorized apply.

**Exit gate:** authenticated end-to-end request evidence, least-privilege
network evidence, and rollback instructions.

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
