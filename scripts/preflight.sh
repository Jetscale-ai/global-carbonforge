#!/usr/bin/env bash
# Authenticate to the Global Services AWS account before invoking Pulumi.
set -euo pipefail

TARGET_ACCOUNT="728827482753"
TARGET_NAME="Global Services"
MANAGEMENT_ACCOUNT="081373342681"
ROLE_ARN="arn:aws:iam::${TARGET_ACCOUNT}:role/OrganizationAccountAccessRole"
MFA_SERIAL="${AWS_MFA_SERIAL:-arn:aws:iam::${MANAGEMENT_ACCOUNT}:mfa/paul.admin-totp}"
OP_ITEM="${AWS_MFA_OP_ITEM:-Amazon}"

CURRENT="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "UNKNOWN")"
if [[ "${CURRENT}" == "${TARGET_ACCOUNT}" ]]; then
  echo "Account verified: ${TARGET_NAME} (${TARGET_ACCOUNT})"
  return 0 2>/dev/null || exit 0
fi
if [[ "${CURRENT}" != "${MANAGEMENT_ACCOUNT}" ]]; then
  echo "ERROR: Wrong AWS account. Expected ${TARGET_NAME} (${TARGET_ACCOUNT}); current: ${CURRENT}." >&2
  echo "Authenticate to management (${MANAGEMENT_ACCOUNT}) first, then retry." >&2
  return 1 2>/dev/null || exit 1
fi

# Reuse an existing MFA-authenticated management session when available. The
# target role's trust policy remains the authority for enforcing MFA.
if [[ -n "${AWS_SESSION_TOKEN:-}" ]] &&
  CREDS="$(aws sts assume-role --role-arn "${ROLE_ARN}" --role-session-name pulumi-deploy --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text 2>/dev/null)"; then
  read -r AK SK ST <<< "${CREDS}"
  export AWS_ACCESS_KEY_ID="${AK}" AWS_SECRET_ACCESS_KEY="${SK}" AWS_SESSION_TOKEN="${ST}"
  echo "Account verified: ${TARGET_NAME} (${TARGET_ACCOUNT})"
  return 0 2>/dev/null || exit 0
fi

if command -v op >/dev/null 2>&1; then
  TOTP="$(op item get "${OP_ITEM}" --otp 2>/dev/null || true)"
fi
if [[ -z "${TOTP:-}" ]]; then
  read -r -p "TOTP code: " TOTP
fi
if [[ -z "${TOTP:-}" ]]; then
  echo "ERROR: No TOTP code provided." >&2
  return 1 2>/dev/null || exit 1
fi

CREDS="$(aws sts get-session-token --serial-number "${MFA_SERIAL}" --token-code "${TOTP}" --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text)" || {
  echo "ERROR: Failed to obtain an MFA session." >&2
  return 1 2>/dev/null || exit 1
}
read -r AK SK ST <<< "${CREDS}"
export AWS_ACCESS_KEY_ID="${AK}" AWS_SECRET_ACCESS_KEY="${SK}" AWS_SESSION_TOKEN="${ST}"

CREDS="$(aws sts assume-role --role-arn "${ROLE_ARN}" --role-session-name pulumi-deploy --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text)" || {
  echo "ERROR: Failed to assume the ${TARGET_NAME} role." >&2
  return 1 2>/dev/null || exit 1
}
read -r AK SK ST <<< "${CREDS}"
export AWS_ACCESS_KEY_ID="${AK}" AWS_SECRET_ACCESS_KEY="${SK}" AWS_SESSION_TOKEN="${ST}"

FINAL="$(aws sts get-caller-identity --query Account --output text)"
if [[ "${FINAL}" != "${TARGET_ACCOUNT}" ]]; then
  echo "ERROR: Assumed credentials target ${FINAL}, expected ${TARGET_ACCOUNT}." >&2
  return 1 2>/dev/null || exit 1
fi
echo "Account verified: ${TARGET_NAME} (${TARGET_ACCOUNT})"
