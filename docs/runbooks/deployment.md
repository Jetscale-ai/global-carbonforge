# Deployment runbook

## Preconditions

Do not apply until AWS raises the account's On-Demand G/VT quota from `0` to at
least 16 vCPUs, physical `p5.4xlarge` capacity is rechecked, the recorded
`$6.88/hour` cost is explicitly approved, and the live action is authorized.
Quota request `06437a82af484fe5b785bdd8fe871dd7UA0EPVGB` asks for 32 vCPUs and is
tracked in [issue #1](https://github.com/Jetscale-ai/global-carbonforge/issues/1).
Quota approval alone is not apply authorization. The implementation currently
has a clean non-destructive preview only.

Verify that:

- the quota request is approved and the effective regional quota, not only the
  request status, is at least 16 vCPUs;
- `p5.4xlarge` remains offered in `us-east-1a`; physical capacity is still an
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
- the pinned AMI is `ami-02c52c305263fdec5` in private subnet
  `subnet-0ce370d0b178797ab` (`us-east-1a`), and its driver is confirmed compatible
  with the image's CUDA 13 requirement;
- the subnet retains active NAT egress for AWS APIs, GHCR, NVIDIA package setup,
  and the public Hugging Face model download; VPC DNS and NACL behavior are
  rechecked immediately before apply;
- the runtime security group has no ingress and administration is SSM-only;
- tracing remains explicitly `off`; `standard` requires an approved sink and
  retention design;
- the roughly 33.7 GB pinned model manifest and roughly 19 GB image fit with
  operational headroom on the encrypted 150 GiB volume.

## Quota and capacity recheck

Poll the existing request through the authenticated preflight environment:

```bash
bash -c 'source scripts/preflight.sh && aws service-quotas get-requested-service-quota-change --request-id 06437a82af484fe5b785bdd8fe871dd7UA0EPVGB --region us-east-1'
```

After it reports approval, separately query quota `L-DB2E81BA` and confirm the
effective value has propagated to at least 16. Recheck the `p5.4xlarge` offering
in `us-east-1a`. An offering result validates the configuration but cannot prove
that AWS has an H100 available at launch time.

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

The wrapper authenticates to Global Services. It permits previews but blocks
local live mutations by default. The reviewed preview contains 16 creates and no
updates, replacements, or deletions.

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

Routine live application occurs through Pulumi Deployments after the reviewed
change is landed. Because the stack-scoped deployment role is itself owned by
this stack, its first creation requires a separately approved bootstrap path
using existing Global Services authority. After that bootstrap:

1. Record the exported `deploymentRoleArn`.
2. Configure Pulumi Deployments to assume it with audience `JetScale`.
3. Run and review a preview under that role to catch missing IAM actions.
4. Obtain explicit cost and live-apply authorization for the reviewed commit.
5. Run the apply through Pulumi Deployments.

The bootstrap authority and the routine deployment role are distinct controls;
do not continue using broad bootstrap authority for routine updates.

Do not run `pulumi up`, `destroy`, `refresh`, or `import` locally for `live`
without an explicitly ticketed break-glass authorization. A break-glass path is
not a substitute for normal review, quota, or cost approval.

## Post-apply handoff

Use the verification runbook to collect health, OpenAI-compatible completion,
LiteLLM connectivity, private-network, and telemetry evidence. Record failures
and rollback instructions before expanding traffic.
