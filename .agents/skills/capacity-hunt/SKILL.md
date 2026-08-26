---
name: capacity-hunt
description: Find scarce accelerator capacity for CarbonForge by probing provider stack placements, defaulting to AWS p5/H100 stacks. Use when retrying the worldwide H100 hunt, deciding probe order, running authorized Pulumi up/destroy loops, or preserving only stacks that successfully secure capacity.
---

# Capacity Hunt

Find available accelerator capacity for CarbonForge across configured provider
placements while preserving governance, cost, and cleanup boundaries.

## Default Provider

Default to AWS unless the user explicitly selects another provider.

The current AWS lane hunts for one or more `p5.4xlarge` H100 instances by
running provider-specific `global-carbonforge` Pulumi stacks such as
`JetScale/live-aws-us-east-1a`.

Azure and GCP lanes are future extension points. Do not invent their stack names,
quota model, resource cleanup commands, or GPU SKU mappings until those provider
placements are implemented and documented in this repository.

## When To Use

Use this skill when the user asks to:

- rerun the worldwide H100 hunt;
- probe scarce GPU or accelerator capacity;
- try CarbonForge stacks across regions or Availability Zones;
- keep stacks that successfully secure capacity alive;
- destroy partial stacks after `InsufficientInstanceCapacity` or equivalent
  provider capacity failures;
- decide the next AWS region or AZ probe order.

## Authority And Safety

Follow `AGENTS.md` and `.agents/agents.md` before live mutations.

Live `up` and `destroy` operations require explicit human authorization in the
current session. For AWS, use the repository wrapper only:

```bash
JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1 pnpm pulumi up -f -y -s JetScale/<stack>
JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1 pnpm pulumi destroy -f -y -s JetScale/<stack>
```

Do not call raw `pulumi up` or raw `pulumi destroy`. Do not run direct EC2
mutation commands. Do not commit or push unless separately authorized.

Never print secrets, Pulumi secret plaintext, registry credentials, licence
material, prompts, generated outputs, or full request traces.

## AWS Inputs

Before probing AWS, collect the candidate set from repository sources rather
than guessing.

1. Read `../global-inference-models/QUOTAS_TODO.md` and identify regions with
   enough Running On-Demand P-instance quota for `p5.4xlarge`.
2. List available CarbonForge stack config files:

   ```bash
   ls Pulumi.live-aws-*.yaml
   ```

3. Confirm `global-cloud-network` exports the required network contract for the
   candidate regions:
   - remote regions require `privateInferenceTransport[region]` unless the
     CarbonForge code supports another documented transport;
   - same-VPC primary regions may use the network-owned `regionalNetworks` VPC
     CIDR when supported by code.
4. Skip regions without sufficient quota, stack config, or network support.

## AWS Probe Order

Prefer breadth-first by region unless the user specifies another ordering.

Recompute eligibility before live mutation, but use this default AWS stack order
when all listed stacks are still quota-qualified, network-ready, and present:

1. `live-aws-ap-northeast-1c`
2. `live-aws-ap-south-1a`
3. `live-aws-ap-southeast-3a`
4. `live-aws-sa-east-1c`
5. `live-aws-eu-west-2a`
6. `live-aws-us-east-2a`
7. `live-aws-us-west-2a`
8. `live-aws-us-east-1a`
9. `live-aws-ap-south-1b`
10. `live-aws-eu-west-2b`
11. `live-aws-us-east-2b`
12. `live-aws-us-west-2b`
13. `live-aws-us-east-1b`
14. `live-aws-ap-south-1c`
15. `live-aws-eu-west-2c`
16. `live-aws-us-east-2c`
17. `live-aws-us-west-2c`
18. `live-aws-us-east-1c`
19. `live-aws-us-west-2d`
20. `live-aws-us-east-1d`
21. `live-aws-us-east-1e`
22. `live-aws-us-east-1f`

This order tours the world before exhausting same-region alternate AZs, then
returns for additional AZs after the first pass.

When choosing between time zones, prefer regions likely to have low interactive
user demand first, but do not override the user's requested order.

## AWS Execution Loop

For each candidate stack:

1. Run the authorized apply through the wrapper:

   ```bash
   JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1 pnpm pulumi up -f -y -s JetScale/<stack>
   ```

2. Classify the result:
   - **success**: record the stack, region, AZ, update URL, and leave the stack
     alive;
   - **capacity failure**: if diagnostics contain `InsufficientInstanceCapacity`,
     run the cleanup command immediately;
   - **quota failure**: stop unless the user explicitly wants to continue with
     other quota-qualified regions;
   - **network, code, credential, secret, or policy failure**: stop and diagnose.
3. For AWS capacity failure cleanup, run:

   ```bash
   JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1 pnpm pulumi destroy -f -y -s JetScale/<stack>
   ```

4. After cleanup, verify the stack resource count returns to `0` with:

   ```bash
   pulumi stack ls
   ```

5. Continue until all candidates are exhausted or the user-specified target
   number of live capacity wins is reached.

## Parallel Probing

Prefer parallel region lanes when sub-agents are available. Assign one sub-agent
per eligible region and probe that region's AZ stacks sequentially. This reduces
total hunt time without making same-region probes compete against the regional
P-instance quota.

Use sequential probing instead when the user requests ordered first-success
behavior, sub-agents are unavailable, or concurrent successful allocations
would exceed the approved cost boundary.

When parallelizing:

- use sub-agents with disjoint regional stack lists;
- probe AZs sequentially within each region;
- give every sub-agent the same authority, wrapper-only, cleanup, and no-secrets
  instructions;
- require every sub-agent to destroy partial stacks after capacity failures;
- require every sub-agent to stop its regional lane and leave the first
  successful stack alive;
- warn that parallel region successes can reserve multiple expensive
  accelerators;
- reconcile results with `pulumi stack ls` after all agents finish.

Do not parallelize multiple operations against the same stack or multiple AZs in
the same region.

## Reporting

Report results as a table:

| Stack                 | Region/AZ    | Result                 | Evidence                     |
| --------------------- | ------------ | ---------------------- | ---------------------------- |
| `live-aws-example-1a` | `example-1a` | `alive` or `destroyed` | key diagnostic or update URL |

For successful stacks, include follow-up evidence still required before calling
runtime healthy:

- EC2 instance running and status checks passed;
- CarbonForge service health through SSM or an approved private client;
- private health URL reachable from an authorized workload source;
- minimal OpenAI-compatible completion succeeds without logging prompt or output
  content;
- LiteLLM can reach CarbonForge;
- request tracing remains non-content-bearing or disabled as configured;
- GPU metrics confirm H100 use.

After live mutations, remind the user to clear local break-glass context when the
wrapper asks for it:

```bash
unset TICKET APPROVER
```

## Future Provider Lanes

When Azure or GCP support is added, extend this skill with provider-specific
sections only after the repository contains:

- stack naming conventions;
- quota and capacity source of truth;
- accelerator SKU mapping to CarbonForge runtime requirements;
- network/private endpoint contract;
- authorized wrapper commands;
- capacity-failure diagnostic strings;
- cleanup commands and post-cleanup verification.

Until then, treat non-AWS capacity hunts as planning tasks, not live mutation
workflows.
