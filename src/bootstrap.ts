export type BootstrapConfig = {
  region: string;
  imageReference: string;
  modelName: string;
  modelRevision: string;
  scheduler: string;
  runtimePort: number;
  maxModelLength: number;
  tensorParallelSize: number;
  gpuMemoryUtilization: number;
  maxConcurrentSequences: number;
  trustRemoteCode: boolean;
  languageModelOnly: boolean;
  reasoningParser: string;
  enableAutoToolChoice: boolean;
  toolCallParser: string;
  requestTraceMode: "disabled";
  ghcrUsername: string;
  ghcrTokenSecretArn: string;
  ghcrTokenVersionId: string;
  licenseSecretArn: string;
  licenseVersionId: string;
};

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function renderBootstrapScript(config: BootstrapConfig): string {
  const values = {
    region: shellQuote(config.region),
    imageReference: shellQuote(config.imageReference),
    modelName: shellQuote(config.modelName),
    modelRevision: shellQuote(config.modelRevision),
    scheduler: shellQuote(config.scheduler),
    runtimePort: shellQuote(String(config.runtimePort)),
    maxModelLength: shellQuote(String(config.maxModelLength)),
    tensorParallelSize: shellQuote(String(config.tensorParallelSize)),
    gpuMemoryUtilization: shellQuote(String(config.gpuMemoryUtilization)),
    maxConcurrentSequences: shellQuote(String(config.maxConcurrentSequences)),
    reasoningParser: shellQuote(config.reasoningParser),
    toolCallParser: shellQuote(config.toolCallParser),
    ghcrUsername: shellQuote(config.ghcrUsername),
    ghcrTokenSecretArn: shellQuote(config.ghcrTokenSecretArn),
    ghcrTokenVersionId: shellQuote(config.ghcrTokenVersionId),
    licenseSecretArn: shellQuote(config.licenseSecretArn),
    licenseVersionId: shellQuote(config.licenseVersionId),
  };

  return `#!/usr/bin/env bash
set -euo pipefail
exec > /var/log/carbonforge-bootstrap.log 2>&1

export DEBIAN_FRONTEND=noninteractive
export AWS_REGION=${values.region}
export AWS_DEFAULT_REGION=${values.region}

apt-get update
apt-get install -y awscli ca-certificates curl gnupg jq

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: The pinned NVIDIA DLAMI must provide Docker CE." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: The pinned NVIDIA DLAMI must provide the Docker Compose plugin." >&2
  exit 1
fi
systemctl enable --now docker

if ! dpkg -s nvidia-container-toolkit >/dev/null 2>&1; then
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update
  apt-get install -y nvidia-container-toolkit
  nvidia-ctk runtime configure --runtime=docker
  systemctl restart docker
fi

nvidia-smi -L
install -d -m 0700 /etc/carbonforge /opt/carbonforge /var/lib/carbonforge/huggingface /var/log/carbonforge
aws secretsmanager get-secret-value \
  --secret-id ${values.licenseSecretArn} \
  --version-id ${values.licenseVersionId} \
  --query SecretString \
  --output text > /etc/carbonforge/license.key
chmod 0600 /etc/carbonforge/license.key

DOCKER_CONFIG="$(mktemp -d /run/carbonforge-docker.XXXXXX)"
export DOCKER_CONFIG
trap 'docker logout ghcr.io >/dev/null 2>&1 || true; rm -rf "\${DOCKER_CONFIG}"' EXIT
aws secretsmanager get-secret-value \
  --secret-id ${values.ghcrTokenSecretArn} \
  --version-id ${values.ghcrTokenVersionId} \
  --query SecretString \
  --output text \
  | docker login ghcr.io --username ${values.ghcrUsername} --password-stdin
docker pull ${values.imageReference}
docker logout ghcr.io >/dev/null
rm -rf "\${DOCKER_CONFIG}"
unset DOCKER_CONFIG
trap - EXIT

docker run --rm \
  --entrypoint hf \
  --volume /var/lib/carbonforge/huggingface:/root/.cache/huggingface \
  ${values.imageReference} \
  download ${values.modelName} \
  --revision ${values.modelRevision} \
  --cache-dir /root/.cache/huggingface

cat > /opt/carbonforge/docker-compose.yml <<'COMPOSE'
services:
  carbonforge:
    image: ${JSON.stringify(config.imageReference)}
    pull_policy: never
    restart: unless-stopped
    command:
      - --scheduler
      - ${JSON.stringify(config.scheduler)}
      - --vllm-port
      - ${JSON.stringify(String(config.runtimePort))}
      - --request-trace
      - off
      - --
      - ${JSON.stringify(config.modelName)}
      - --host
      - 0.0.0.0
      - --port
      - ${JSON.stringify(String(config.runtimePort))}
      - --revision
      - ${JSON.stringify(config.modelRevision)}
      - --served-model-name
      - ${JSON.stringify(config.modelName)}
      - --tensor-parallel-size
      - ${JSON.stringify(String(config.tensorParallelSize))}
      - --max-model-len
      - ${JSON.stringify(String(config.maxModelLength))}
      - --gpu-memory-utilization
      - ${JSON.stringify(String(config.gpuMemoryUtilization))}
      - --max-num-seqs
      - ${JSON.stringify(String(config.maxConcurrentSequences))}
${config.trustRemoteCode ? "      - --trust-remote-code\n" : ""}${config.languageModelOnly ? "      - --language-model-only\n" : ""}      - --reasoning-parser
      - ${JSON.stringify(config.reasoningParser)}
${config.enableAutoToolChoice ? "      - --enable-auto-tool-choice\n" : ""}      - --tool-call-parser
      - ${JSON.stringify(config.toolCallParser)}
    environment:
      HUGGINGFACE_HUB_CACHE: "/root/.cache/huggingface"
      HF_HUB_OFFLINE: "1"
      HF_HUB_DISABLE_TELEMETRY: "1"
    ports:
      - "${config.runtimePort}:${config.runtimePort}"
    volumes:
      - /etc/carbonforge/license.key:/etc/carbonforge/license.key:ro
      - /var/lib/carbonforge/huggingface:/root/.cache/huggingface
      - /var/log/carbonforge:/var/log/carbonforge
    gpus: all
COMPOSE
chmod 0600 /opt/carbonforge/docker-compose.yml

cat > /etc/systemd/system/carbonforge.service <<'UNIT'
[Unit]
Description=CarbonForge inference runtime
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/carbonforge
ExecStart=/usr/bin/docker compose up -d --pull never
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=1800
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now carbonforge.service
`;
}
