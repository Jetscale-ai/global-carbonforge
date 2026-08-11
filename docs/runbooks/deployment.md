# Deployment runbook

## Current deployment

Pulumi update 16 provisioned the private Jakarta runtime infrastructure on
2026-08-10. The update created a `p5.4xlarge` after 832 seconds and completed in
14 minutes 7 seconds. This is placement evidence, not runtime-health evidence.
Use the verification runbook before routing traffic.

Pulumi update 17 attempted a create-before-delete replacement for the bootstrap
correction. The existing instance remained running, but the replacement failed
with `InsufficientInstanceCapacity` after the AWS provider made 25 attempts over
about 50 minutes. Update 18 used the corrected retry bound and failed for the same
capacity reason in 8 seconds. Jakarta currently offers `p5.4xlarge` only in
`ap-southeast-3a`, so there is no alternate regional AZ for this shape.

The stack now sets `aws:maxRetries: "1"`. A value of `0` was treated as unset and
fell back to the provider default of 25 attempts. The ineffective
`customTimeouts.create: 3m` option was removed because it did not interrupt the
provider's internal `RunInstances` retry loop. A failed capacity probe should
now return quickly; it does not make physical H100 capacity available.

The initial host's cloud-init failed before secret retrieval because the pinned
DLAMI already provides Docker CE, Compose, and `containerd.io`, while bootstrap
also requested Ubuntu's conflicting `docker.io` package. Bootstrap now installs
only general utilities and verifies the AMI-provided Docker and Compose binaries.
Because `userDataReplaceOnChange` is enabled, applying this correction proposes
an instance replacement. Pulumi uses create-before-delete, preserving the running
host when replacement capacity is unavailable. Under `INC-002`, the stored
cloud-init script was corrected and rerun in place through SSM so the allocated
H100 could be retained. Runtime startup then exposed a second issue: prefetch used
`/root/.cache/huggingface`, while offline vLLM defaulted to its `hub` subdirectory.
The Compose environment now sets `HUGGINGFACE_HUB_CACHE` to the prefetch path.

This recovery made the existing service operational but did not change the EC2
resource's recorded user data. Pulumi therefore still proposes replacement to
reconcile state. Do not apply or target-delete the instance until replacement
capacity is demonstrated and the replacement is explicitly authorized.

## Preconditions for future mutations

Before any replacement, expansion, or redeployment, confirm Jakarta's effective
Running On-Demand P-instance quota remains 32 vCPUs, recheck `p5.4xlarge`
offering and physical-capacity risk, record current Jakarta cost, review the
preview, and obtain explicit live-action authorization.

Verify that:

- the effective regional P-instance quota, not only a request status, is 32
  vCPUs so one active 16-vCPU host retains replacement headroom;
- `p5.4xlarge` remains offered in `ap-southeast-3a`; it is currently the only
  Jakarta AZ advertising this shape, and physical capacity is still an
  apply-time dependency unless a separately approved reservation exists;
- the target is `JetScale/global-carbonforge/live` in account `728827482753`;
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
- the [runtime invocation](../runtime-invocation.md) explicitly overrides the
  pinned image's dry-run Qwen2.5 default with the reviewed Qwen3.5 command;
- the pinned AMI is `ami-06bc172b9832559df` in private subnet
  `subnet-06a995e4116d8061b` (`ap-southeast-3a`), and its driver is confirmed compatible
  with the image's CUDA 13 requirement;
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
pnpm --dir ../security-governance jetscale-preflight -- exec --provider aws --account global-services --access readonly -- aws service-quotas get-service-quota --service-code ec2 --quota-code L-417A185B --region ap-southeast-3
pnpm --dir ../security-governance jetscale-preflight -- exec --provider aws --account global-services --access readonly -- aws ec2 describe-instance-type-offerings --region ap-southeast-3 --location-type availability-zone --filters Name=instance-type,Values=p5.4xlarge Name=location,Values=ap-southeast-3a
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
pnpm pulumi preview --diff -s JetScale/global-carbonforge/live
```

The shared wrapper authenticates with the cached `jetscale` IAM Identity Center
session and verifies the Global Services `PlatformReadOnly` role. It permits
previews but blocks local live mutations by default. If authentication has
expired, run `aws sso login --sso-session jetscale` and retry.

`aws:maxRetries: "1"` bounds AWS API attempts; do not set it to `0`, which falls
back to the provider default. Because an instance now exists, review every
preview for replacement or deletion of `carbonforge-instance`, secret versions,
security groups, and regional resources. Treat an instance replacement as a
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
