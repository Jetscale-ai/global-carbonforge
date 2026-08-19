import type { RuntimeConfig } from "../runtime-config";

export const GHCR_TOKEN_PATH = "/etc/carbonforge/ghcr-token";
export const LICENSE_PATH = "/etc/carbonforge/license.key";

export type WorkloadBootstrapConfig = Pick<
  RuntimeConfig,
  | "scheduler"
  | "runtimePort"
  | "maxModelLength"
  | "tensorParallelSize"
  | "gpuMemoryUtilization"
  | "maxConcurrentSequences"
  | "trustRemoteCode"
  | "languageModelOnly"
  | "reasoningParser"
  | "enableAutoToolChoice"
  | "toolCallParser"
> & {
  imageReference: string;
  modelName: string;
  modelRevision: string;
  ghcrUsername: string;
  ghcrTokenPath: string;
  licensePath: string;
};

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function renderWorkloadBootstrapScript(
  config: WorkloadBootstrapConfig,
): string {
  const values = {
    imageReference: shellQuote(config.imageReference),
    modelName: shellQuote(config.modelName),
    modelRevision: shellQuote(config.modelRevision),
    ghcrUsername: shellQuote(config.ghcrUsername),
    ghcrTokenPath: shellQuote(config.ghcrTokenPath),
    licensePath: shellQuote(config.licensePath),
  };

  return `if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: The provider image must supply Docker CE." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: The provider image must supply the Docker Compose plugin." >&2
  exit 1
fi
systemctl enable --now docker
nvidia-smi -L

install -d -m 0700 /opt/carbonforge /var/lib/carbonforge/huggingface /var/log/carbonforge
chmod 0600 ${values.ghcrTokenPath} ${values.licensePath}

DOCKER_CONFIG="$(mktemp -d /run/carbonforge-docker.XXXXXX)"
export DOCKER_CONFIG
trap 'docker logout ghcr.io >/dev/null 2>&1 || true; rm -rf "\${DOCKER_CONFIG}"' EXIT
cat ${values.ghcrTokenPath} \
  | docker login ghcr.io --username ${values.ghcrUsername} --password-stdin
docker pull ${values.imageReference}
docker logout ghcr.io >/dev/null
rm -rf "\${DOCKER_CONFIG}"
unset DOCKER_CONFIG
trap - EXIT
rm -f ${values.ghcrTokenPath}

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
      - ${config.licensePath}:/etc/carbonforge/license.key:ro
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
systemctl enable --now carbonforge.service`;
}
