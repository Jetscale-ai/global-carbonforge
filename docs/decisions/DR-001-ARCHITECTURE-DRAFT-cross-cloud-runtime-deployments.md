# DR-001: Cross-cloud CarbonForge runtime deployments

## Status

- **State:** Draft
- **Rigor:** R2 - standard
- **Owner:** Global Services Platform
- **Review date:** 2026-09-01
- **Proposed supersession:** None
- **Execution outputs:** goal, policy

## Human summary

CarbonForge capacity is scarce and differs materially across AWS, Google Cloud,
and Azure. This record asks how the repository should represent, deploy, verify,
and activate provider-specific H100 runtimes without coupling routing state to
infrastructure creation or replacing one provider with another in a shared
Pulumi checkpoint.

## Decision question

How should `global-carbonforge` deploy equivalent private CarbonForge runtimes
across AWS, Google Cloud, and Azure while preserving provider-native security
boundaries, independent lifecycle, reproducibility, and verified downstream
activation?

## Scope

This decision covers:

- Pulumi stack isolation and naming;
- provider-neutral workload and output contracts;
- provider-specific compute, network, identity, secret, and administration
  adapters;
- placement catalogs and readiness gates; and
- the boundary between provisioning and active downstream routing.

It does not choose initial GCP or Azure projects, regions, quotas, purchasing
models, or foundation repositories. It does not authorize cloud mutations,
capacity reservations, or commercial commitments.

## Trigger and affected parties

Repeated AWS capacity failures demonstrated that a single-cloud, single-stack
runtime cannot reliably secure one H100. The decision affects
`global-carbonforge`, provider foundation owners, `global-inference-litellm`,
security governance, and operators responsible for cost and break-glass access.

## Constraints

| Constraint       | Pass condition                                                     | Source                  | Negotiable |
| ---------------- | ------------------------------------------------------------------ | ----------------------- | ---------- |
| Secret safety    | No secret value enters user data, source, logs, or outputs         | Repository constitution | No         |
| Private endpoint | Runtime has no public endpoint or routine SSH ingress              | Repository constitution | No         |
| Ownership        | CarbonForge consumes provider foundation networking and identity   | Repository constitution | No         |
| State isolation  | One provider placement cannot replace another provider's resources | Operational requirement | No         |
| Supply chain     | Container and model remain immutable and revision-pinned           | Repository constitution | No         |
| Activation       | Provisioning success alone does not mark an endpoint active        | Verification runbook    | No         |
| Cost authority   | Reservations and commitments require explicit human approval       | Repository constitution | No         |

## Decision drivers

- Recovery speed when a placement lacks physical H100 capacity.
- Least-privilege provider-native identity and secret delivery.
- Reproducible destroy-and-recreate behavior.
- Clear blast radius and rollback.
- Minimal provider-specific code in the CarbonForge workload layer.
- Verifiable routing promotion and demotion.

## Options

### Provider-specific stacks with shared contracts

Use one Pulumi stack per environment, cloud, and placement, such as
`live-aws-us-east-1b`. Share a provider-neutral workload bootstrap and normalized
runtime outputs. Implement provider adapters independently. Maintain the active,
verified routing pointer outside compute stacks.

### One stack with a provider switch

Use a generic stack and config-select AWS, GCP, or Azure. Changing provider would
replace the stack's compute, networking references, identity, secrets, and
administration resources.

### Separate provider repositories

Create independent AWS, GCP, and Azure CarbonForge repositories with duplicated
workload configuration and downstream contracts.

### Status quo

Retain one AWS-only `live` stack and handle capacity failures manually by
changing region and availability zone.

## Known risks and blast radius

- A nominally provider-neutral contract may hide meaningful provider security or
  lifecycle differences.
- GCP Spot or Flex-start capacity may not satisfy always-on runtime expectations.
- Azure and GCP images may require different driver and Docker bootstrap paths.
- Cross-cloud private connectivity to LiteLLM may introduce egress cost,
  latency, DNS, and trust-boundary changes.
- Duplicated encrypted stack secrets increase rotation and revocation work.
- An incorrectly designed active pointer could route traffic before runtime
  verification succeeds.

## Acceptance criteria

- Stack names unambiguously encode environment, cloud, and placement.
- Each deployment stack owns only one provider placement.
- Provider adapters return a normalized non-secret runtime contract.
- The portable workload bootstrap consumes protected local files rather than a
  cloud CLI or cloud secret identifier.
- AWS behavior remains validated while GCP and Azure fail closed until their
  adapters and foundations are implemented.
- Promotion requires health, model discovery, bounded completion, GPU, and
  downstream-connectivity evidence.
- Independent challenge and affected-repository review are complete before
  acceptance.

## Open questions

- Which repositories own GCP and Azure network and workload-identity contracts?
- Is cross-cloud private connectivity routed through the current global network,
  or should LiteLLM gain provider-local workers?
- Where should the verified active-deployment registry live?
- What availability posture is acceptable for GCP Spot or Flex-start H100s?
- Does the CarbonForge licence permit all intended providers and machine types?
- Which provider image families are compatible with the pinned container and
  bootstrap requirements?

## Related evidence

- [`../architecture.md`](../architecture.md)
- [`../runbooks/deployment.md`](../runbooks/deployment.md)
- [`../runbooks/verification.md`](../runbooks/verification.md)
- AWS placement catalog in `src/placements/aws.ts`
- Provider-neutral contracts in `src/core/`
