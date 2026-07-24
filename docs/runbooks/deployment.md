# Deployment runbook

## Preconditions

Do not deploy from this scaffold until the Phase 1 and Phase 2 roadmap gates
are complete. In particular, obtain explicit approval for H100 capacity and
cost, validate the CarbonForge runtime command with the vendor, and review a
non-destructive preview in the target account.

Verify that:

- the target is `JetScale/global-carbonforge/live` in account `728827482753`;
- `global-cloud-network/live` and `global-cloud-identity/live` outputs exist;
- image digest, model revision, licence use, and secret-store references are
  reviewed;
- private ingress and SSM-only administration are represented in the preview;
- logging and normal tracing retention controls are approved.

## Preview

```bash
pnpm install
pnpm build
pnpm test
pnpm pulumi preview -s JetScale/global-carbonforge/live
```

The wrapper authenticates to Global Services. It permits previews but blocks
local live mutations by default.

## Apply

Routine live application occurs through Pulumi Deployments after a reviewed PR.
Do not run `pulumi up`, `destroy`, `refresh`, or `import` locally for `live`
without an explicitly ticketed break-glass authorization. A break-glass path is
not a substitute for normal review or capacity approval.

## Post-apply handoff

Use the verification runbook to collect health, OpenAI-compatible completion,
LiteLLM connectivity, private-network, and telemetry evidence. Record failures
and rollback instructions before expanding traffic.
