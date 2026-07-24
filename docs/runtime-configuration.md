# Runtime configuration

## POC settings

| Option                       | Initial value          | Notes                                                  |
| ---------------------------- | ---------------------- | ------------------------------------------------------ |
| Model                        | `Qwen/Qwen3.5-27B-FP8` | Dense 27B FP8 model from supplied source material      |
| GPU                          | One H100               | Capacity and instance selection still require approval |
| Tensor parallel size         | `1`                    | One-GPU target                                         |
| Maximum model length         | `32768`                | Lower than the published 262,144-token maximum         |
| GPU memory utilization       | `0.7`                  | POC input requiring empirical validation               |
| Maximum concurrent sequences | `4`                    | POC input requiring load testing                       |
| Scheduler                    | `ltr-promptlen`        | Must be validated against CarbonForge documentation    |
| Runtime port                 | `8000`                 | Private workload ingress only                          |
| Request tracing              | `normal`               | Content-safe mode only                                 |

## Configuration validation

`src/runtime-config.ts` validates the non-secret settings in `Pulumi.live.yaml`:
positive counts, an in-range port, GPU utilization greater than zero and no more
than one, and a recognized tracing mode. It additionally rejects `full` tracing.

This is configuration hygiene, not proof that the vendor runtime accepts every
option. Before any launch, validate the exact container invocation, image digest,
model revision, `--trust-remote-code` implications, Qwen reasoning parser,
tool-call parser, and scheduler behavior with authoritative vendor material.

## Secrets and persistent data

Do not add registry credentials, licence contents, or model access tokens to
this file, Pulumi configuration, or a command line. The later runtime design
will retrieve them from an approved secret store. Model cache and operational
logs require encrypted storage, access control, and bounded retention.
