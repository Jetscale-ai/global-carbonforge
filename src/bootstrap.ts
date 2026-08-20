import {
  GHCR_TOKEN_PATH,
  LICENSE_PATH,
  renderWorkloadBootstrapScript,
  type WorkloadBootstrapConfig,
} from "./core/workload-bootstrap";

export type BootstrapConfig = Omit<
  WorkloadBootstrapConfig,
  "ghcrTokenPath" | "licensePath"
> & {
  region: string;
  requestTraceMode: "disabled";
  ghcrTokenSecretArn: string;
  ghcrTokenVersionId: string;
  licenseSecretArn: string;
  licenseVersionId: string;
};

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function renderBootstrapScript(config: BootstrapConfig): string {
  const providerBootstrap = `#!/usr/bin/env bash
set -euo pipefail
exec > /var/log/carbonforge-bootstrap.log 2>&1

export DEBIAN_FRONTEND=noninteractive
export AWS_REGION=${shellQuote(config.region)}
export AWS_DEFAULT_REGION=${shellQuote(config.region)}

apt-get -o DPkg::Lock::Timeout=900 update
apt-get -o DPkg::Lock::Timeout=900 install -y awscli ca-certificates curl gnupg jq

if ! dpkg -s nvidia-container-toolkit >/dev/null 2>&1; then
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get -o DPkg::Lock::Timeout=900 update
  apt-get -o DPkg::Lock::Timeout=900 install -y nvidia-container-toolkit
  nvidia-ctk runtime configure --runtime=docker
  systemctl restart docker
fi

umask 077
install -d -m 0700 /etc/carbonforge
aws secretsmanager get-secret-value \
  --secret-id ${shellQuote(config.licenseSecretArn)} \
  --version-id ${shellQuote(config.licenseVersionId)} \
  --query SecretString \
  --output text > ${LICENSE_PATH}
aws secretsmanager get-secret-value \
  --secret-id ${shellQuote(config.ghcrTokenSecretArn)} \
  --version-id ${shellQuote(config.ghcrTokenVersionId)} \
  --query SecretString \
  --output text > ${GHCR_TOKEN_PATH}
`;

  const workloadBootstrap = renderWorkloadBootstrapScript({
    ...config,
    ghcrTokenPath: GHCR_TOKEN_PATH,
    licensePath: LICENSE_PATH,
  });

  return `${providerBootstrap}\n${workloadBootstrap}\n`;
}
