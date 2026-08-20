import type { RuntimeConfig } from "../runtime-config";

export const GHCR_TOKEN_PATH = "/etc/carbonforge/ghcr-token";
export const LICENSE_PATH = "/etc/carbonforge/license.key";
export const BOOTSTRAP_READY_PATH = "/var/lib/carbonforge/bootstrap-ready";
export const BOOTSTRAP_FAILURE_PATH = "/var/lib/carbonforge/bootstrap-failed";

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
systemctl enable --now carbonforge.service

READINESS_DIR="$(mktemp -d /run/carbonforge-readiness.XXXXXX)"
READINESS_PHASE="model_discovery"
cleanup_readiness() {
  status=$?
  trap - EXIT
  rm -rf "\${READINESS_DIR}"
  if [ "\${status}" -ne 0 ]; then
    marker="$(mktemp /var/lib/carbonforge/bootstrap-failed.XXXXXX)"
    printf 'phase=%s\\n' "\${READINESS_PHASE}" > "\${marker}"
    chmod 0600 "\${marker}"
    mv -f "\${marker}" '${BOOTSTRAP_FAILURE_PATH}'
  fi
  exit "\${status}"
}
trap cleanup_readiness EXIT
rm -f '${BOOTSTRAP_READY_PATH}' '${BOOTSTRAP_FAILURE_PATH}'

EXPECTED_MODEL=${values.modelName}
MODELS_URL='http://127.0.0.1:${config.runtimePort}/v1/models'
COMPLETIONS_URL='http://127.0.0.1:${config.runtimePort}/v1/chat/completions'
models_ready=false
models_deadline=$((SECONDS + 1800))
while [ "\${SECONDS}" -lt "\${models_deadline}" ]; do
  models_http="$(curl --silent --show-error \
    --connect-timeout 5 --max-time 30 \
    --output "\${READINESS_DIR}/models.json" \
    --write-out '%{http_code}' \
    "\${MODELS_URL}" 2>/dev/null || true)"
  if [ "\${models_http}" = '200' ] && jq -e --arg model "\${EXPECTED_MODEL}" \
    '.data | type == "array" and any(.[]; .id == $model)' \
    "\${READINESS_DIR}/models.json" >/dev/null 2>&1; then
    models_ready=true
    break
  fi
  sleep 10
done
if [ "\${models_ready}" != true ]; then
  echo 'ERROR: CarbonForge model discovery did not become ready before the bounded timeout.' >&2
  exit 1
fi

READINESS_PHASE="token_generation"
jq -n --arg model "\${EXPECTED_MODEL}" '{
  model: $model,
  messages: [{role: "user", content: "Say hello."}],
  max_tokens: 32,
  temperature: 0
}' > "\${READINESS_DIR}/completion-request.json"
completion_ready=false
completion_deadline=$((SECONDS + 300))
while [ "\${SECONDS}" -lt "\${completion_deadline}" ]; do
  completion_http="$(curl --silent --show-error \
    --connect-timeout 5 --max-time 90 \
    --header 'content-type: application/json' \
    --request POST \
    --data-binary "@\${READINESS_DIR}/completion-request.json" \
    --output "\${READINESS_DIR}/completion-response.json" \
    --write-out '%{http_code}' \
    "\${COMPLETIONS_URL}" 2>/dev/null || true)"
  if [ "\${completion_http}" = '200' ] && jq -e --arg model "\${EXPECTED_MODEL}" '
    (.error == null) and
    (.model == $model) and
    (.choices | type == "array" and length > 0) and
    (.usage.completion_tokens | type == "number" and . > 0)
  ' "\${READINESS_DIR}/completion-response.json" >/dev/null 2>&1; then
    completion_ready=true
    break
  fi
  sleep 10
done
if [ "\${completion_ready}" != true ]; then
  echo 'ERROR: CarbonForge did not generate tokens before the bounded timeout.' >&2
  exit 1
fi

READINESS_PHASE="runtime_integrity"
container_id="$(docker compose \
  --project-directory /opt/carbonforge \
  --file /opt/carbonforge/docker-compose.yml \
  ps -q carbonforge)"
if [ -z "\${container_id}" ]; then
  echo 'ERROR: CarbonForge container is not running.' >&2
  exit 1
fi
container_state="$(docker inspect --format '{{.RestartCount}} {{.State.OOMKilled}} {{.State.Running}}' "\${container_id}")"
if [ "\${container_state}" != '0 false true' ]; then
  echo 'ERROR: CarbonForge container failed restart, OOM, or running-state checks.' >&2
  exit 1
fi
if ! nvidia-smi --query-compute-apps=used_memory --format=csv,noheader,nounits \
  | awk '$1 + 0 > 0 { found = 1 } END { exit !found }'; then
  echo 'ERROR: CarbonForge readiness completed without an active GPU compute process.' >&2
  exit 1
fi

READINESS_PHASE="publish_marker"
ready_marker="$(mktemp /var/lib/carbonforge/bootstrap-ready.XXXXXX)"
printf 'model=%s\\nstatus=ready\\n' "\${EXPECTED_MODEL}" > "\${ready_marker}"
chmod 0600 "\${ready_marker}"
mv -f "\${ready_marker}" '${BOOTSTRAP_READY_PATH}'
trap - EXIT
rm -rf "\${READINESS_DIR}"`;
}
