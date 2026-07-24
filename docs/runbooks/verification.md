# Verification runbook

Run these checks only after a human-authorized deployment. Do not place tokens,
licence values, prompts containing sensitive data, or generated user content in
verification logs or tickets.

## Infrastructure checks

1. Confirm the workload exists in account `728827482753` and the intended
   private subnet.
2. Confirm there is no public IPv4 address and no SSH ingress.
3. Confirm TCP `8000` permits only the intended LiteLLM workload security group.
4. Confirm Systems Manager can administer the instance using the approved role.
5. Confirm container image and model revision are pinned as reviewed.

## Runtime checks

1. Confirm the service health endpoint is healthy from the authorized private
   network.
2. Submit a minimal OpenAI-compatible completion request without sensitive
   content.
3. Confirm the expected model is served and errors are actionable.
4. Confirm a LiteLLM-routed request reaches CarbonForge without opening an
   unintended ingress path.

## Telemetry checks

1. Confirm normal traces contain timestamps, token counts, latency, TTFT, and
   queue timing as expected.
2. Inspect a representative trace and log sample for absence of prompts,
   generated outputs, credentials, and licence material.
3. Confirm telemetry transport encryption, access boundary, retention, and
   deletion configuration match the approved design.

## Evidence

Capture resource identifiers, security-group evidence, health status, sanitized
completion result metadata, LiteLLM connectivity result, and trace inspection
results. Do not claim throughput, energy, quality, or latency improvements until
an approved benchmark method produces comparable data.
