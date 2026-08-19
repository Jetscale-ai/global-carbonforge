# Security boundaries

## Account and deployment controls

The sole account target is Global Services AWS account `728827482753`; the next
live stack targets Ohio (`us-east-2`). The shared launcher uses the
cached `jetscale` IAM Identity Center session and verifies the account and
expected SSO role before invoking Pulumi. It removes ambient static AWS
credentials from child environments.

The Pulumi program independently checks the caller account and ARN. Routine
updates to a provider-specific live stack such as
`JetScale/global-carbonforge/live-aws-us-east-2a` require that stack's role,
such as `global-carbonforge-live-aws-us-east-2a-pulumi-deployment`. An explicitly authorized manual
recovery requires both an assumed `global-breakglass-admin` identity and
`JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1`; setting an environment variable alone
cannot authorize an unrelated principal.

## Secret lifecycle

The GHCR credential and CarbonForge licence remain encrypted Pulumi config inputs
and are copied into stack-owned Secrets Manager resources for runtime retrieval.
Those AWS secrets use Pulumi-stable logical names, generated AWS physical names
under project/stack prefixes, and a zero-day recovery window. This avoids name
collisions with legacy or interrupted deletion tombstones while deliberately
trading AWS Secrets Manager recovery for deterministic PoC teardown/recreation;
verify the Pulumi encrypted inputs exist before destroying the stack.

## Network and administration

- No public IPv4 address for the workload.
- No SSH ingress or routine SSH private keys.
- The runtime security group starts with no ingress. LiteLLM owns the eventual
  TCP `8000` rule sourced from its ECS task security group.
- AWS Systems Manager Session Manager for administration.
- Existing network resources are consumed from `global-cloud-network`.

## Secrets and supply chain

A least-privilege GHCR pull token and the CarbonForge licence use
Pulumi-encrypted stack configuration. The GHCR credential is separate from the
vendor's temporary source-registry token and should normally carry only
`read:packages`. Qwen3.5-27B-FP8 is public and requires no Hugging Face token.
Secret plaintext must not appear in stack YAML, AMIs, user data, shell history,
source code, logs, or Pulumi outputs.

At runtime, secret material must be read only when needed, written with
restrictive permissions, and removed when temporary files are no longer needed.
The infrastructure implementation must preserve Pulumi secret taint and must
not interpolate either value into EC2 user data.
CarbonForge authorization to mirror and operate the proprietary evaluation image
from Jetscale's private GHCR package for this PoC is confirmed. The mirrored
image was independently inspected at GHCR and pinned as
`sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de`.
The different source-registry digest remains provenance evidence. Container
images must remain immutable and digest pinned, and model revisions must also be
pinned where the source supports it.

The supplied command transcription was not treated as authoritative. The pinned
image itself was inspected for its entrypoint, inherited command, CarbonForge
wrapper help, vLLM option declarations, and parser registries. The generated
Compose file explicitly overrides the unsafe dry-run Qwen2.5 example. The H100 is
provisioned, but startup remains an open post-deploy compatibility check.

CarbonForge's public Terraform quickstart is also not a Jetscale security
baseline. Its user data contains base64-encoded licence and registry token
values, which would expose those values through instance metadata and IaC state.
This repository adopts none of that secret transport. See the
[Terraform sample assessment](vendor-terraform-assessment.md) for the complete
adaptation boundary.

## Telemetry and data handling

`requestTraceMode: disabled` maps to the pinned wrapper's explicit
`--request-trace off`. Image inspection confirms that `standard` records counts
and timing without prompt/output content, but requires `--trace-file` or
`--trace-endpoint`; without a sink it remains off. The program rejects the legacy
`normal` value and rejects `full` to prevent accidental content export.

A future change to any tracing requires an authoritative destination contract.
Full tracing additionally requires documented, approved controls covering:

1. data-handling purpose;
2. destination and encryption in transit;
3. access boundary;
4. retention period; and
5. deletion path.

Logs and traces must not contain credentials, licence material, prompts, or
generated outputs by default.
