# Repository Operations: global-carbonforge

**Status:** Operational Details  
**Scope:** `global-carbonforge` only  
**Branch Protection:** Protected IaC repository; changes require feature branches
and pull requests

## 1. Local Oracles

Use the repository scripts for the expected minimum validation surface:

```bash
pnpm install
pnpm build
pnpm test
pnpm pulumi preview -s JetScale/global-carbonforge/live
```

Do not claim these commands pass until the project and scripts exist and the
commands have actually been run. A preview requires authenticated,
read-capable credentials for the Global Services account.

Governance projection validation is available immediately:

```bash
node ../governance/scripts/onboard-governed-project.mjs --repo . --dry-run
```

## 2. Governance Refresh

`../governance` owns the imported agent workspace. Refresh it with:

```bash
pnpm --dir ../governance govern --repo ../global-carbonforge
```

To change bundle selection, update the source through the governance command
rather than manually replacing generated symlinks:

```bash
pnpm --dir ../governance govern \
  --repo ../global-carbonforge \
  --bundle baseline \
  --bundle pulumi-infra \
  --bundle node-service
```

Repo-local files such as this one and `AGENTS.md` are not generated projections
and remain owned by `global-carbonforge`.

## 3. Implemented Stack Contract

### Upstream stack references

| Stack                                 | Required outputs                              | Purpose                                        |
| ------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `JetScale/global-cloud-network/live`  | `regionalNetworks`                            | Select the configured region's private network |
| `JetScale/global-cloud-identity/live` | `pulumiOidcProviderArn`, `pulumiOidcAudience` | Create the stack-scoped Pulumi deployment role |

### Downstream outputs

The applied stack exposes a narrow, non-secret contract suitable for
`global-inference-litellm` or catalog composition. Resource-dependent values are
now concrete, but they do not imply runtime health:

| Output            | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `openAiBaseUrl`   | Private OpenAI-compatible `/v1` base URL |
| `modelName`       | Served model identifier                  |
| `healthUrl`       | Private runtime health endpoint          |
| `securityGroupId` | Consumer ingress-rule coordination       |
| `instanceId`      | Operations and evidence correlation      |

Do not export credentials, tokens, licence contents, rendered user data, or
full-trace content.

## 4. H100 Capacity and Cost Gate

Before replacing, expanding, or redeploying the concrete instance resource,
verify and record:

1. The selected H100 EC2 instance type is available in the configured region
   and Availability Zone and fits the single-H100 requirement.
2. The Global Services account retains 32 regional Running On-Demand P-instance
   vCPUs: 16 for the active host and 16 for replacement headroom. Evidence is
   tracked in [issue #1](https://github.com/Jetscale-ai/global-carbonforge/issues/1).
3. At least one existing private subnet maps to an Availability Zone with
   capacity or an approved Capacity Reservation.
4. Hourly and monthly cost estimates are attached to the issue or pull request.
5. Shutdown, restart, replacement, and capacity-loss behavior are explicit.

Do not silently substitute a multi-GPU instance, another GPU generation, Spot
capacity, or a different region. Those substitutions change cost and runtime
semantics and require human review.

## 5. Runtime Bootstrap Contract

The implemented EC2 user-data bootstrap is reproducible and replaces the
instance when its rendered input changes. It must continue to:

- use an NVIDIA-compatible, version-pinned base image;
- install or verify the required Docker and GPU runtime versions;
- authenticate to the private GHCR mirror without printing credentials;
- pull a digest-pinned CarbonForge image;
- consume the registry token and licence from Pulumi secret outputs without
  rendering either value into user data;
- mount the materialized licence read-only;
- prefetch the pinned public Hugging Face model revision and persist its cache on
  an encrypted volume;
- start the service under a supervised unit with bounded restart behavior;
- emit content-safe operational logs with request tracing explicitly off until
  an approved sink and retention design exist;
- expose port `8000` only through the workload security group.

User data is observable through AWS APIs to sufficiently privileged principals.
It may contain secret identifiers and retrieval commands, but never secret
values.

## 6. Deployment Guardrails

- Agents may run non-mutating builds, tests, static checks, quota polls, capacity
  checks, and Pulumi previews.
- Agents must not run `pulumi up`, `pulumi destroy`, or AWS mutation commands
  against live resources without explicit human authorization.
- Routine applies belong in Pulumi Deployments using the stack-scoped OIDC role.
  The initial break-glass apply created that role; verify a preview while assuming
  the exported `deploymentRoleArn` before routine updates.
- Local live mutation is recovery-only and must be explicitly authorized and
  auditable. It uses the shared tagged IAM Identity Center path plus
  `JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1`; the legacy management-account TOTP and
  1Password path is not supported.
- Preserve the AWS account and caller-role guards and never weaken them to
  unblock a preview.

## 7. Post-Deploy Evidence

The Jakarta infrastructure is provisioned. Collect all of the following before
calling the runtime healthy, without exposing secrets or prompt content:

1. The EC2 instance reaches the running and status-check-passed states.
2. The supervised CarbonForge service is healthy.
3. The private health URL responds from an authorized VPC client.
4. A minimal OpenAI-compatible completion succeeds with the configured model.
5. LiteLLM can reach the endpoint and route a minimal request.
6. Request tracing is confirmed off; after a separately approved telemetry
   change, standard traces contain counts and latency without prompt/output text.
7. GPU utilization and memory metrics demonstrate that the process is using the
   intended H100.

Qualitative marketing claims such as "More Compute Per Watt" are not benchmark
evidence. Do not publish energy, latency, throughput, quality, or cost claims
without a documented baseline, workload, measurement method, and numerical
results.

## 8. Secrets and Sensitive Output

Never print or commit:

- CarbonForge access tokens or licence contents;
- registry-token or licence values;
- AWS credentials or Pulumi secret plaintext;
- full request traces, prompts, or generated outputs;
- Docker login command lines containing literal credentials.

When debugging, prefer metadata such as secret ARN, version ID, HTTP status,
request ID, token counts, and redacted error class.

## 9. Git and Audit Workflow

Prepare changes on a feature branch and leave commit authority to the human
unless explicitly requested otherwise. Material commit messages require an
`audit_log:` section with applicable invariants and validation evidence.
