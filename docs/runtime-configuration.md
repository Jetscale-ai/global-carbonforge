# Runtime configuration

## POC settings

| Option                       | Initial value                                        | Notes                                                  |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Model                        | `Qwen/Qwen3.5-27B-FP8`                               | Dense 27B FP8 model from supplied source material      |
| Private container mirror     | `ghcr.io/jetscale-ai/carbonforge-eval:v0.1.8-v0.1.3` | Mirrored privately; deployment resolves by digest      |
| GPU                          | One H100                                             | Target; no H100 currently exists                       |
| EC2 shape                    | `p5.4xlarge`                                         | 16 P vCPUs and one H100                                |
| Root volume                  | `150 GiB` `gp3`                                      | Encrypted; ~33.7 GB model manifest leaves POC headroom |
| Pinned AMI                   | Selected from the placement catalog                  | Regional Ubuntu 22.04 DLAMI dated 2026-07-28           |
| Placement                    | `activePlacement`                                    | AZ plus dynamically resolved private subnet            |
| Public IPv4 / SSH            | Disabled                                             | Private subnet and SSM administration only             |
| Tensor parallel size         | `1`                                                  | One-GPU target                                         |
| Maximum model length         | `32768`                                              | Lower than the published 262,144-token maximum         |
| GPU memory utilization       | `0.7`                                                | POC input requiring empirical validation               |
| Maximum concurrent sequences | `4`                                                  | POC input requiring load testing                       |
| Scheduler                    | `ltr-promptlen`                                      | Accepted by the pinned CarbonForge wrapper             |
| Model revision               | `97f5941bf617e31c5e237364a8602ce3f03a551a`           | Prefetched before offline runtime startup              |
| Runtime mode                 | Language model only                                  | Option declared by pinned vLLM                         |
| Reasoning parser             | `qwen3`                                              | Registered in pinned vLLM                              |
| Automatic tool choice        | Enabled                                              | Declared by pinned vLLM; requires a tool parser        |
| Tool-call parser             | `qwen3_coder`                                        | Registered in pinned vLLM                              |
| Runtime port                 | `8000`                                               | Private workload ingress only                          |
| Request tracing              | `off`                                                | Explicit; `standard` requires an approved sink         |

## Candidate regions

The active placement can cycle through the following candidates as quota and
network prerequisites become ready:

| Placement         | Region      | Quota state  | Network state |
| ----------------- | ----------- | ------------ | ------------- |
| `us-east-1b`      | N. Virginia | 32 vCPUs     | Ready         |
| `us-east-2a`      | Ohio        | 32 vCPUs     | Ready         |
| `us-west-2a`      | Oregon      | 32 vCPUs     | Missing       |
| `ap-northeast-1c` | Tokyo       | 32 vCPUs     | Ready         |
| `ap-southeast-3a` | Jakarta     | 32 vCPUs     | Ready         |
| `eu-west-2a`      | London      | Appeal to 32 | Missing       |
| `ap-south-1a`     | Mumbai      | Appeal to 32 | Missing       |
| `ap-southeast-2b` | Sydney      | Appeal to 32 | Missing       |
| `sa-east-1c`      | São Paulo   | Appeal to 32 | Missing       |

A 32-vCPU quota leaves quota headroom for two 16-vCPU `p5.4xlarge` instances,
but it is not a capacity reservation. Each activation still requires a current
offering check, cost review, preview, and explicit authorization.

## Configuration validation

`src/container-config.ts` restricts the mirror to the approved private GHCR
package and release tag, validates a lowercase SHA-256 digest when present, and
produces an immutable reference. The live stack currently configures the
independently inspected GHCR digest
`sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de`.
`src/host-config.ts` validates the vendor-informed host baseline and rejects
public IPv4 and SSH. `src/placements/aws.ts` is the committed source for
runtime-owned regional AMI, AZ, and quota combinations. Physical subnet IDs are
resolved from `global-cloud-network` outputs during preview. `activePlacement`
is the operator selector; use `pnpm placement:select <placement-id>` rather than
manually changing coupled region values. `src/runtime-config.ts` validates the
non-secret runtime settings in the provider-specific stack file, such as
`Pulumi.live-aws-us-east-2a.yaml`:
positive counts, an in-range port, GPU utilization greater than zero and no more
than one, and a recognized tracing mode. It additionally rejects `full` tracing.

Pinned-image inspection showed that the inherited command is a dry-run Qwen2.5
example and found no consumer for the previously assumed `CF_SCHEDULER` or
`CF_VLLM_MODEL` variables. The generated Compose file now explicitly passes the
validated CarbonForge wrapper and vLLM settings, including the pinned model
revision, context, concurrency, memory fraction, parsers, and tracing `off`.
This proves interface presence, not successful H100 model startup or performance.
The host is now provisioned, but target-host verification remains open. See the
[runtime invocation](runtime-invocation.md).

## Secrets and persistent data

Store a least-privilege `ghcrPullToken` and the reissued licence only as
Pulumi-encrypted stack secrets; never place plaintext values in this file or
command arguments. The GHCR credential is distinct from the vendor's temporary
source-registry token and should normally carry only `read:packages` access.
Qwen3.5-27B-FP8 is public and requires no Hugging Face token. Model cache and
operational logs require encrypted storage, access control, and bounded
retention.

The configured `32768` context is now passed as vLLM `--max-model-len`; the
pinned vLLM source declares that option. The screenshot's `262144` dry-run value
is not used. A read-only Hub dry run measured roughly 33.7 GB for the pinned
model revision. Verify model load, GPU memory behavior, temporary download space,
and remaining disk capacity on the provisioned H100 before treating the sizing as
proven.
