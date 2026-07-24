# Security boundaries

## Account and deployment controls

The sole target is Global Services AWS account `728827482753` in `us-east-1`.
The Pulumi program checks caller identity against that account. The shell wrapper
also authenticates through the management account before invoking Pulumi.

Routine updates to `JetScale/global-carbonforge/live` use Pulumi Deployments.
The wrapper and program block local live mutations unless an explicitly
authorized, ticketed break-glass operation sets `DR014_BREAKGLASS=1`.

## Network and administration

- No public IPv4 address for the workload.
- No SSH ingress or routine SSH private keys.
- Port `8000` only from named authorized workload security groups.
- AWS Systems Manager Session Manager for administration.
- Existing network resources are consumed from `global-cloud-network`.

## Secrets and supply chain

The CarbonForge registry credential, CarbonForge licence, and Hugging Face token
must use AWS Secrets Manager or another approved secret store. They must not
appear in Pulumi plaintext configuration, AMIs, user data, shell history, source
code, logs, or Pulumi outputs.

At runtime, secret material must be read only when needed, written with
restrictive permissions, and removed when temporary files are no longer needed.
Container images must be immutable and digest pinned. Model revisions must also
be pinned where the source supports it.

The supplied command transcription is not authoritative runtime documentation.
Validate registry host, command ordering, scheduler, parser, and vLLM options
with CarbonForge before deployment.

## Telemetry and data handling

`requestTraceMode: normal` is the only accepted initial mode. It records timing
and token-count metrics without prompt or generated content. The program rejects
`full` mode to prevent an accidental configuration change from exporting user
content.

A future change to full tracing requires documented, approved controls covering:

1. data-handling purpose;
2. destination and encryption in transit;
3. access boundary;
4. retention period; and
5. deletion path.

Logs and traces must not contain credentials, licence material, prompts, or
generated outputs by default.
