#!/usr/bin/env bash
# Store runtime credentials as Pulumi-encrypted stack configuration.
# Omitting each value makes Pulumi prompt interactively without shell arguments.
set -euo pipefail

STACK="${1:-JetScale/global-carbonforge/live}"

echo "Enter a least-privilege GHCR token with read:packages when prompted."
pulumi config set ghcrPullToken --secret --stack "${STACK}"

echo "Enter the CarbonForge licence key when prompted."
pulumi config set carbonforgeLicenseKey --secret --stack "${STACK}"

echo "Stored ghcrPullToken and carbonforgeLicenseKey as encrypted Pulumi secrets for ${STACK}."
echo "No Hugging Face token is required for Qwen/Qwen3.5-27B-FP8."
