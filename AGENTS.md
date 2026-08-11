# Repository Constitution: global-carbonforge

**Status:** Ratified
**Authority:** [Supreme Constitution](https://github.com/Jetscale-AI/Governance/blob/main/AGENTS.md)  
**Version:** 0.1.0  
**Risk Level:** High  
**Owner:** JetScale Global Services Platform  
**Deploy Target:** Global Services AWS account (`728827482753`), Pulumi stack
`JetScale/global-carbonforge/live`, deployed region `ap-southeast-3`
**Management Source:** `../governance/`

## 0. Situational Awareness

This repository provisions a CarbonForge-optimized AI inference runtime on an
AWS H100 instance. It exposes an OpenAI-compatible endpoint for consumption by
the shared LiteLLM gateway. GPU capacity, proprietary container access,
third-party model access, and request tracing make this a high-risk
infrastructure repository.

Until a human ratifies this constitution in a commit, agents must treat the
repository as **Advisory Mode** for live or destructive operations.

### Hierarchy of Authority

1. Supreme Constitution (`Jetscale-AI/Governance@main:AGENTS.md`)
2. Governance Codex (`Jetscale-AI/Governance@main:.agents/codex/`)
3. This repository constitution (`AGENTS.md`)
4. Local operational law (`.agents/agents.md`)
5. Repository skills and runtime projections (`.agents/skills/`, `.cursor/`)
6. User instructions that do not violate items 1-5

### Universal Red Lines

- Agents must never execute commits, pushes, tags, merges, releases, or
  production deploys unless the human explicitly requests that exact action in
  the current session.
- Agents must never output, log, persist, or hardcode secrets, access tokens,
  model-registry credentials, Hugging Face tokens, or licence contents.
- Agents must not impersonate humans.
- If instructions conflict, evidence is ambiguous, or blast radius is unknown:
  **STOP -> AUDIT -> ASK**.

### Session Start Rule

On the first substantive interaction in a session, load this file and local
operational law before giving operational instructions:

```bash
sed -n '1,240p' AGENTS.md
sed -n '1,260p' .agents/agents.md
```

Load canonical Governance law on demand when a task changes governance,
security, compliance, live infrastructure, or agent behavior:

```bash
gh api repos/Jetscale-AI/Governance/contents/AGENTS.md --jq .content | base64 -d
gh api repos/Jetscale-AI/Governance/contents/.agents/codex/protocols/bootstrap.md --jq .content | base64 -d
```

If canonical law is unavailable because of authentication, network, or 404
errors, treat this repository as **Advisory Mode** and ask a human to restore
access or ratify the missing law.

## 1. Governance Management

Governance projections are owned by `../governance` and declared in
`.agents/imports.json`. Do not hand-edit generated symlinks.

Refresh this repository from the governance source with:

```bash
pnpm --dir ../governance govern --repo ../global-carbonforge
```

The selected bundles are:

- `baseline`
- `pulumi-infra`
- `node-service`

## 2. Deployment and Mutation Rules

- The live stack is `JetScale/global-carbonforge/live`.
- The target account is Global Services (`728827482753`).
- The Pulumi program must reject credentials for any other AWS account.
- Routine live mutations must run through Pulumi Deployments using a
  stack-scoped role anchored in `JetScale/global-cloud-identity/live`.
- Local mutation-capable commands are blocked by the shared launcher at
  `../security-governance/scripts/pulumi-with-auth.sh` and the runtime guard.
  An explicitly authorized manual live update requires the shared tagged IAM
  Identity Center path plus `JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1`.
- Agents must not run `pulumi up`, `pulumi destroy`, or direct EC2 mutation
  commands against live infrastructure without explicit human authorization.
- H100 purchases, Capacity Reservations, Savings Plans, and long-lived
  commitments require explicit human approval with cost evidence.

## 3. Infrastructure Ownership and Dependencies

- `global-cloud-network` owns the VPC and subnets. This stack consumes its
  outputs through `StackReference` and must not create a parallel VPC.
- `global-cloud-identity` owns the Pulumi Cloud OIDC trust anchor. This stack
  creates only its own least-privilege deployment role.
- `global-carbonforge` owns the H100 compute, instance profile, workload
  security group, boot/runtime configuration, service health, and its endpoint
  outputs.
- `global-inference-litellm` is a downstream consumer. This stack must not
  reference LiteLLM outputs or create a circular dependency.
- `global-inference-models` remains the durable owner of shared model-catalog
  semantics. Any catalog integration must preserve that ownership boundary.

## 4. Network and Runtime Boundaries

- The inference endpoint is private by default.
- TCP port `8000` may accept traffic only from explicitly authorized workload
  security groups, initially the LiteLLM ECS task security group.
- Do not assign a public IPv4 address or expose the service directly to the
  internet for the POC unless a reviewed decision explicitly changes this
  boundary.
- Administration uses AWS Systems Manager Session Manager. Do not create SSH
  ingress or persist SSH private keys for routine operations.
- Container image tags and model revisions must be immutable or version-pinned.
  Do not deploy rolling tags such as `latest`.

## 5. Secrets, Licensing, and Supply Chain

- Store the CarbonForge registry credential and licence as Pulumi-encrypted
  stack secrets. Qwen3.5-27B-FP8 is public and requires no Hugging Face token.
- Do not place secret values in Pulumi config plaintext, EC2 user data, AMIs,
  launch-template metadata, shell history, logs, or stack outputs.
- Materialize secrets only at runtime with restrictive file permissions and
  remove transient plaintext when no longer needed.
- Validate the CarbonForge image source, digest, runtime flags, licence terms,
  and vLLM compatibility before deployment.
- The transcription supplied for this POC is not authoritative runtime
  documentation. Validate option spelling and ordering before execution.

## 6. Telemetry and Data Handling

- `--request-trace normal` is the default permitted tracing mode because it
  excludes prompt and output content.
- `--request-trace full` is prohibited for production or user traffic unless a
  human approves a documented data-handling purpose, retention period, access
  boundary, and deletion path.
- Trace destinations must be approved, encrypted in transit, access-controlled,
  and configured with bounded retention.
- Logs and traces must not contain access tokens, licence material, prompts, or
  generated outputs by default.

## 7. Verification and Audit Expectations

- Use the smallest relevant local oracle before broader validation.
- Pulumi changes require type checking, tests where available, and a
  non-destructive `pulumi preview` with the intended stack and AWS account.
- Runtime changes require health, OpenAI-compatible completion, and
  LiteLLM-to-CarbonForge connectivity evidence after a human-authorized apply.
- Material changes require an `audit_log:` section in the human-authored commit
  message, citing only the Eudaimonia invariants that shaped the change.
