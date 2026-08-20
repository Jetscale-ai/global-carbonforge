# Deployment runbook

## Current deployment

Pulumi update 16 provisioned the original private Jakarta `p5.4xlarge` on
2026-08-10. Under `INC-002`, its failed cloud-init was corrected and rerun in
place through SSM. Model discovery and token generation then succeeded, providing
historical proof that the pinned image, model, licence, and H100 can operate
together.

That original instance was subsequently destroyed. Updates 20 through 26 rebuilt
supporting resources, but Jakarta repeatedly returned
`InsufficientInstanceCapacity` for a new `p5.4xlarge`. Updates 27 and 28 then
successfully destroyed the stack. Subsequent N. Virginia attempts reported
insufficient `p5.4xlarge` capacity, leaving no runtime endpoint. Ohio
`us-east-2a` subsequently failed twice and `us-east-2b` failed once for the same
reason. AWS identified `us-east-2c` as the remaining Ohio alternative, so the
next isolated live stack targets its private subnet. Ohio's approved regional
P-instance quota is 32 vCPUs.

The stack sets `aws:maxRetries: "1"`. A value of `0` was treated as unset and
fell back to the provider default of 25 attempts. The ineffective
`customTimeouts.create: 3m` option was removed because it did not interrupt the
provider's internal `RunInstances` retry loop. A failed capacity probe should
return quickly; it does not make physical H100 capacity available. `us-east-2`
advertises `p5.4xlarge` in `us-east-2a`, `us-east-2b`, and `us-east-2c`; this
still does not guarantee physical placement.

The original cloud-init failed before secret retrieval because the pinned DLAMI
already provides Docker CE, Compose, and `containerd.io`, while bootstrap also
requested Ubuntu's conflicting `docker.io` package. Bootstrap now installs only
general utilities and verifies the AMI-provided Docker and Compose binaries.
Runtime startup exposed a second issue: prefetch used
`/root/.cache/huggingface`, while offline vLLM defaulted to its `hub` subdirectory.
The generated Compose environment now sets `HUGGINGFACE_HUB_CACHE` to the
prefetch path and enables offline mode. A subsequent clean Jakarta rebuild took
about 17 minutes to pull the immutable image and pinned model, then required
additional model-initialization time during which local requests could refuse or
reset connections. Generated user data now waits through bounded model-discovery
and token-generation checks, verifies container restart/OOM state and active GPU
use, and atomically publishes `/var/lib/carbonforge/bootstrap-ready`. Failures
exit cloud-init nonzero and record only a bounded phase name in
`/var/lib/carbonforge/bootstrap-failed`; response bodies remain transient and are
never printed. These runtime corrections apply to the next host without an SSM
repair.

## Reproducibility contract

A successful full Pulumi destroy followed by an up recreates every
CarbonForge-owned resource from this repository and encrypted stack
configuration. It does not require an existing CarbonForge instance, retained
AWS secret, manual import, or SSM bootstrap repair. Pulumi creates the deployment
role, instance role and profile, security group, AWS secret containers and
versions, EC2 instance, generated bootstrap, and non-secret outputs.

This contract intentionally retains two upstream stack dependencies:
`JetScale/global-cloud-network/live` supplies the shared VPC and private subnet,
and `JetScale/global-cloud-identity/live` supplies the account OIDC trust anchor.
Duplicating either resource here would violate its ownership boundary. A fresh
apply also depends on external availability rather than prior CarbonForge state:
AWS H100 capacity, NAT/DNS egress, the pinned AMI, GHCR, Hugging Face, and valid
encrypted credential and licence inputs.

## Regional placement catalog

`src/placements/aws.ts` binds each AWS placement ID to runtime-owned policy: a
region, AZ, pinned regional DLAMI, and quota status. It deliberately contains no
physical VPC or subnet IDs.
Operators select one coherent placement with:

```bash
pnpm placement:select us-east-2c
pnpm secrets:configure -- JetScale/global-carbonforge/live-aws-us-east-2c
pnpm pulumi preview --diff -s JetScale/global-carbonforge/live-aws-us-east-2c
```

The selector targets the placement-specific stack and updates
`global-carbonforge:activePlacement` and `aws:region`. The program independently
rejects drift between stack name, cloud, placement, and region. During preview,
it intersects the subnets in the selected AZ and VPC with
`global-cloud-network`'s exported private-subnet IDs and requires exactly one
match. It also rejects public IPv4 auto-assignment. This makes the
network stack authoritative and allows subnet replacement without changing the
CarbonForge catalog.

Each candidate targets one `p5.4xlarge`: 16 P-family vCPUs and one H100.

| AWS location | Region           | Ready placements                                       |
| ------------ | ---------------- | ------------------------------------------------------ |
| N. Virginia  | `us-east-1`      | `us-east-1a` through `us-east-1f`                      |
| Ohio         | `us-east-2`      | `us-east-2a`, `us-east-2b`, `us-east-2c`               |
| Oregon       | `us-west-2`      | `us-west-2a`, `us-west-2b`, `us-west-2c`, `us-west-2d` |
| London       | `eu-west-2`      | `eu-west-2a`, `eu-west-2b`, `eu-west-2c`               |
| Mumbai       | `ap-south-1`     | `ap-south-1a`, `ap-south-1b`, `ap-south-1c`            |
| Tokyo        | `ap-northeast-1` | `ap-northeast-1c`                                      |
| Jakarta      | `ap-southeast-3` | `ap-southeast-3a`                                      |
| São Paulo    | `sa-east-1`      | `sa-east-1c`                                           |

Sydney `ap-southeast-2b` remains blocked while its quota appeal and governed
network are incomplete. Every ready placement has a committed provider-specific
stack configuration. Quota and instance-type offering do not guarantee physical
H100 capacity.

Each placement has an isolated stack. Selecting another placement creates or
updates that placement's stack rather than replacing a different deployment.
Global IAM resources retain the default Pulumi provider identity within each
stack. Never automate unattended cross-region apply
retries: select a placement, review the exact preview, and obtain explicit
authorization for each live mutation.

## Preconditions for future mutations

Before any replacement, expansion, or redeployment, confirm the selected
region's effective Running On-Demand P-instance quota can admit a 16-vCPU
`p5.4xlarge`, recheck its AZ offering and physical-capacity risk, record current
regional cost, review the preview, and obtain explicit live-action
authorization.

Verify that:

- the effective regional P-instance quota, not only a request status, is 32
  vCPUs so one active 16-vCPU host retains replacement headroom;
- `p5.4xlarge` remains offered in the selected placement AZ; physical capacity
  is still an apply-time dependency unless a separately approved reservation
  exists;
- the target follows `JetScale/global-carbonforge/live-aws-<placement>` and the
  stack suffix matches `activePlacement` in account `728827482753`;
- a least-privilege `ghcrPullToken` and the reissued CarbonForge licence have
  been entered interactively with `pnpm secrets:configure`, and `pulumi config`
  reports both keys as secret without using `--show-secrets`;
- the obsolete vendor `carbonforgeRegistryToken` is absent;
- `global-cloud-network/live` and `global-cloud-identity/live` outputs exist;
- the confirmed CarbonForge authorization covers mirroring and operating the
  proprietary evaluation image from Jetscale's private GHCR package for the PoC;
- the source digest is retained as provenance evidence and `containerDigest` is
  the independently inspected GHCR digest
  `sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de`;
- the preview exports
  `ghcr.io/jetscale-ai/carbonforge-eval@sha256:a3999f60989e47d9059cfedb0999a2342adb41cad1f20999938ac3a8f4f0d5de`
  as the non-null immutable reference;
- model revision `97f5941bf617e31c5e237364a8602ce3f03a551a`, licence use,
  and Pulumi/AWS Secrets Manager handling are reviewed;
- stack-owned Secrets Manager resources use Pulumi-stable logical names,
  generated AWS physical names under project/stack prefixes, and a zero-day
  recovery window. A recreate therefore does not collide with a legacy or
  interrupted AWS deletion tombstone. Destroy permanently deletes current AWS
  copies immediately; confirm the Pulumi encrypted config still contains both
  source values before destruction;
- the [runtime invocation](../runtime-invocation.md) explicitly overrides the
  pinned image's dry-run Qwen2.5 default with the reviewed Qwen3.5 command;
- the pinned AMI is `ami-095f757d9450363f1` in `us-east-2`, and the dynamically
  resolved private subnet for the selected Ohio AZ is exported by
  `global-cloud-network`; its driver is
  confirmed compatible with the image's CUDA 13 requirement;
- the subnet retains active NAT egress for AWS APIs, GHCR, NVIDIA package setup,
  and the public Hugging Face model download; VPC DNS and NACL behavior are
  rechecked immediately before mutation;
- the runtime security group has no ingress and administration is SSM-only;
- tracing remains explicitly `off`; `standard` requires an approved sink and
  retention design;
- the roughly 33.7 GB pinned model manifest and roughly 19 GB image fit with
  operational headroom on the encrypted 150 GiB volume.

## Quota and capacity recheck

Query the effective quota and current instance-type offering through the shared
read-only IAM Identity Center preflight client:

```bash
pnpm --dir ../security-governance jetscale-preflight -- exec --provider aws --account global-services --access readonly -- aws service-quotas get-service-quota --service-code ec2 --quota-code L-417A185B --region us-east-2
pnpm --dir ../security-governance jetscale-preflight -- exec --provider aws --account global-services --access readonly -- aws ec2 describe-instance-type-offerings --region us-east-2 --location-type availability-zone --filters Name=instance-type,Values=p5.4xlarge
```

Confirm the effective quota is 32. An offering result validates the configuration
but cannot prove that AWS has an H100 available at launch time.

## Preview

Run validation and preview from the exact reviewed commit that is eligible for
deployment:

```bash
pnpm install
pnpm build
pnpm test
pnpm format:check
pnpm pulumi preview --diff -s JetScale/global-carbonforge/live-aws-us-east-2c
```

The shared wrapper authenticates with the cached `jetscale` IAM Identity Center
session and verifies the Global Services `PlatformReadOnly` role. It permits
previews but blocks local live mutations by default. If authentication has
expired, run `aws sso login --sso-session jetscale` and retry.

`aws:maxRetries: "1"` bounds AWS API attempts; do not set it to `0`, which falls
back to the provider default. Review every preview for creation, replacement, or
deletion of `carbonforge-instance`, secret versions, security groups, and
regional resources. When an instance exists, treat its replacement as a
capacity-loss and service-interruption risk even when Pulumi proposes
create-before-delete.

Review the detailed instance properties for:

- `associatePublicIpAddress: false` and no key pair;
- IMDSv2 required with hop limit `1`;
- encrypted `gp3` root storage;
- the expected pinned AMI, AZ, subnet, and `p5.4xlarge` type;
- no security-group ingress;
- secret values masked; and
- `userDataReplaceOnChange: true`.

Bootstrap changes replace the instance so cloud-init is reproducible. On an
existing deployment this can lose scarce H100 capacity; every such preview
requires explicit replacement and cost review.

## Apply

The initial break-glass apply created the stack-scoped deployment role. Routine
live application now belongs in Pulumi Deployments:

1. Record the exported `deploymentRoleArn`.
2. Configure Pulumi Deployments to assume it with audience `JetScale`.
3. Run and review a preview under that role to catch missing IAM actions.
4. Obtain explicit cost and live-apply authorization for the reviewed commit.
5. Run the apply through Pulumi Deployments.

The bootstrap authority and the routine deployment role are distinct controls;
do not continue using broad bootstrap authority for routine updates.

Do not run `pulumi up`, `destroy`, `refresh`, or `import` locally for `live`
without explicit human authorization. Until the centrally managed
`DeploymentSettings` path is complete, an authorized manual deployment of the
exact reviewed `main` revision must use the shared tagged IAM Identity Center
path and `JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1`. This temporary path is not a
substitute for normal review, quota, replacement, or cost approval.

## Post-apply handoff

Direct runtime verification succeeded on 2026-08-11: model discovery returned
HTTP 200, and a bounded chat request returned HTTP 200 with 8 completion tokens.
The container had zero restarts, no OOM, and approximately 55 GiB of GPU memory in
use. The evidence omitted generated content and secret material.

Use the verification runbook to complete storage, driver/CUDA, telemetry, and
LiteLLM connectivity evidence. Record failures and rollback instructions before
enabling downstream traffic.
