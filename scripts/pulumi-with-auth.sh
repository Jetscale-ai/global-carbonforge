#!/usr/bin/env bash
# Authenticate to Global Services, then execute Pulumi. Local live mutations
# are blocked unless a ticketed DR-014 break-glass action explicitly opts in.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PULUMI_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--op-item)
      [[ -n "${2:-}" ]] || { echo "ERROR: --op-item requires a value." >&2; exit 1; }
      export AWS_MFA_OP_ITEM="$2"; shift 2 ;;
    --) shift ;;
    *) PULUMI_ARGS+=("$1"); shift ;;
  esac
done

[[ ${#PULUMI_ARGS[@]} -gt 0 ]] || {
  echo "Usage: $0 preview|up|destroy|refresh|import [--op-item NAME] [pulumi flags]" >&2
  exit 1
}

PULUMI_COMMAND=""
TARGET_STACK=""
EXPECT_VALUE_FOR=""
for arg in "${PULUMI_ARGS[@]}"; do
  if [[ -n "${EXPECT_VALUE_FOR}" ]]; then
    [[ "${EXPECT_VALUE_FOR}" == "stack" ]] && TARGET_STACK="${arg}"
    EXPECT_VALUE_FOR=""
    continue
  fi
  case "${arg}" in
    -s|--stack) EXPECT_VALUE_FOR="stack" ;;
    --stack=*) TARGET_STACK="${arg#--stack=}" ;;
    -C|--cwd|--color|--config-file|--profiling|--tracing|--verbose|-v|--memprofilerate) EXPECT_VALUE_FOR="skip" ;;
    -*) ;;
    *) [[ -z "${PULUMI_COMMAND}" ]] && PULUMI_COMMAND="${arg}" ;;
  esac
done

case "${TARGET_STACK}" in */live|live) IS_LIVE_STACK=true ;; *) IS_LIVE_STACK=false ;; esac
case "${PULUMI_COMMAND}" in up|destroy|refresh|import) IS_MUTATION=true ;; *) IS_MUTATION=false ;; esac
if [[ "${IS_LIVE_STACK}" == true && "${IS_MUTATION}" == true && "${DR014_BREAKGLASS:-}" != "1" ]]; then
  echo "ERROR: Local '${PULUMI_COMMAND}' against ${TARGET_STACK} is blocked by DR-014." >&2
  echo "Use Pulumi Deployments for routine live updates. Ticketed break-glass requires DR014_BREAKGLASS=1." >&2
  exit 1
fi
if [[ "${IS_LIVE_STACK}" == true && "${IS_MUTATION}" == true ]]; then
  echo "WARNING: DR014_BREAKGLASS=1 bypasses the local live-mutation guard; ticket evidence is required." >&2
fi

source "${SCRIPT_DIR}/preflight.sh"
exec pulumi "${PULUMI_ARGS[@]}"
