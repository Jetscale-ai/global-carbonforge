# CarbonForge Terraform sample assessment

## Reviewed source

This design assessment reviews CarbonForge's public AWS Terraform sample at
commit [`fb8e789a8cea8bb9bd1d4b84809078ebeda19658`](https://github.com/carbonforgeAI/docs/tree/fb8e789a8cea8bb9bd1d4b84809078ebeda19658/deploy/terraform/aws).
The sample is a client quickstart, not a security or production architecture for
Jetscale. It remains upstream-owned and is not copied into this repository.

## Patterns adopted

| Vendor pattern                                             | Jetscale adaptation                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `p5.4xlarge` for one NVIDIA H100 80 GB                     | Initial POC host baseline, subject to quota, capacity, and cost approval          |
| NVIDIA Deep Learning AMI family                            | Candidate base image family; deployment must pin and review a concrete AMI ID     |
| 150 GiB encrypted `gp3` root volume                        | Encrypted PoC baseline; ~33.7 GB model manifest leaves measured headroom          |
| GPU-aware Docker runtime                                   | Required runtime capability, installed from pinned and reviewed sources           |
| Persistent Hugging Face cache and CarbonForge logs         | Separate encrypted, access-controlled storage with explicit retention             |
| Startup GPU detection                                      | Post-boot evidence must include `nvidia-smi` and intended H100 identity           |
| CarbonForge image, scheduler, and model as explicit inputs | Typed non-secret configuration, immutable image digest, and pinned model revision |

## Patterns explicitly rejected

| Vendor quickstart pattern                                 | Reason and replacement                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Default VPC and default subnet discovery                  | Consume the VPC and private subnets owned by `global-cloud-network`                 |
| Public IPv4 address                                       | Keep the endpoint private and reachable only through approved VPC paths             |
| SSH ingress and EC2 key pair                              | Use AWS Systems Manager Session Manager with no port `22` ingress                   |
| CIDR-based access to port `8000`                          | Authorize only named workload security groups, initially LiteLLM ECS tasks          |
| `0.0.0.0/0` as the default allowed CIDR                   | Prohibited by the repository's private network boundary                             |
| Licence and registry token embedded in user data          | Keep values as Pulumi-encrypted config and never render them into EC2 user data     |
| Base64 as secret protection                               | Base64 is encoding, not encryption; secret values must not enter bootstrap metadata |
| Mutable image tag                                         | Require an immutable CarbonForge image digest                                       |
| Most-recent AMI lookup during every deployment            | Resolve, test, and pin a concrete AMI ID before apply                               |
| Boot-time package installation from unpinned repositories | Prefer a reviewed image or version-pinned bootstrap with supply-chain evidence      |
| Unbounded internet egress                                 | Define only the approved registry, model, telemetry, and AWS service access paths   |
| Secret values embedded in user data                       | Store values in Secrets Manager; user data contains identifiers only                |

## Verified image provenance

The vendor image was pulled as `linux/amd64` with source-registry digest
`sha256:ffd62626fa5d1a8288821edbd34ab44a19ac1d949bfee63ffe7eb9debeb0748c`.
The private GHCR mirror was then independently inspected with digest
`sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de`.
The Pulumi stack records the GHCR digest and resolves deployment by that immutable
reference. The two registry digests are tracked separately as provenance facts.
CarbonForge authorization to mirror and operate this image for the PoC is
confirmed.

## Information still required

The sample and verified mirror do not close the remaining roadmap gates. Before
an authorized apply, obtain or verify:

1. `p5.4xlarge` quota, Availability Zone capacity, and current Global Services
   account cost evidence in `us-east-1`.
2. The pinned Deep Learning AMI publisher, driver, CUDA, Docker, and NVIDIA
   Container Toolkit compatibility with the mirrored image.
3. Registry authentication lifetime. CarbonForge confirmed the source pull token
   was valid for seven days and the licence for 30 days. Runtime instead uses a
   separate least-privilege GHCR token, normally with `read:packages`.
4. Required outbound destinations for GHCR, Hugging Face, NVIDIA package setup,
   and AWS APIs. Tracing has no destination while it remains off.
5. Post-boot free space and bounded retention for the roughly 33.7 GB model,
   roughly 19 GB image, Docker layers, temporary downloads, and logs.
6. Target-host evidence for service supervision, health, restart behavior, and
   deliberate instance replacement when a secret version changes.

## Implementation consequence

`src/container-config.ts` validates the private package, fixed release tag, and
GHCR digest. `src/host-config.ts` records the accepted host baseline and rejects
public IPv4 and SSH configuration. The Pulumi implementation now includes EC2,
IAM, Secrets Manager, a no-ingress workload security group, encrypted storage,
and explicit runtime bootstrap; it remains unapplied pending quota, target-host
compatibility evidence, cost approval, and governed deployment authorization.
