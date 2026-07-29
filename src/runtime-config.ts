export const REQUEST_TRACE_MODES = ["disabled", "normal", "full"] as const;
export type RequestTraceMode = (typeof REQUEST_TRACE_MODES)[number];

const POC_ENGINE_VERSION = "0.26.0";
const POC_MAX_MODEL_LENGTH = 262_144;
const POC_SCHEDULER = "ltr-promptlen";
const POC_REASONING_PARSER = "qwen3";
const POC_TOOL_CALL_PARSER = "qwen3_coder";

export type RuntimeConfig = {
  modelName: string;
  engineVersion: string;
  maxModelLength: number;
  tensorParallelSize: number;
  gpuMemoryUtilization: number;
  maxConcurrentSequences: number;
  runtimePort: number;
  scheduler: string;
  trustRemoteCode: boolean;
  languageModelOnly: boolean;
  reasoningParser: string;
  enableAutoToolChoice: boolean;
  toolCallParser: string;
  requestTraceMode: RequestTraceMode;
};

export function validateRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  if (!config.modelName.trim()) throw new Error("modelName must be non-empty.");
  if (config.engineVersion !== POC_ENGINE_VERSION) {
    throw new Error(
      `engineVersion must match the inspected pinned image version ${POC_ENGINE_VERSION}.`,
    );
  }
  assertPositiveInteger("maxModelLength", config.maxModelLength);
  if (config.maxModelLength > POC_MAX_MODEL_LENGTH) {
    throw new Error(
      `maxModelLength must not exceed the published POC limit of ${POC_MAX_MODEL_LENGTH}.`,
    );
  }
  assertPositiveInteger("tensorParallelSize", config.tensorParallelSize);
  assertPositiveInteger(
    "maxConcurrentSequences",
    config.maxConcurrentSequences,
  );
  if (
    !Number.isInteger(config.runtimePort) ||
    config.runtimePort < 1 ||
    config.runtimePort > 65535
  ) {
    throw new Error("runtimePort must be an integer between 1 and 65535.");
  }
  if (config.gpuMemoryUtilization <= 0 || config.gpuMemoryUtilization > 1) {
    throw new Error(
      "gpuMemoryUtilization must be greater than 0 and no more than 1.",
    );
  }
  if (config.scheduler !== POC_SCHEDULER) {
    throw new Error(`scheduler must be ${POC_SCHEDULER} for the POC runtime.`);
  }
  if (!config.trustRemoteCode) {
    throw new Error(
      "trustRemoteCode must be explicitly enabled for the selected POC model and paired with a pinned, reviewed model revision.",
    );
  }
  if (!config.languageModelOnly) {
    throw new Error(
      "languageModelOnly must remain enabled for the POC runtime.",
    );
  }
  if (config.reasoningParser !== POC_REASONING_PARSER) {
    throw new Error(
      `reasoningParser must be ${POC_REASONING_PARSER} for the selected model.`,
    );
  }
  if (!config.enableAutoToolChoice) {
    throw new Error(
      "enableAutoToolChoice must remain enabled for the POC runtime.",
    );
  }
  if (config.toolCallParser !== POC_TOOL_CALL_PARSER) {
    throw new Error(
      `toolCallParser must be ${POC_TOOL_CALL_PARSER} for the selected model.`,
    );
  }
  if (!REQUEST_TRACE_MODES.includes(config.requestTraceMode)) {
    throw new Error(
      `requestTraceMode must be one of: ${REQUEST_TRACE_MODES.join(", ")}.`,
    );
  }
  if (config.requestTraceMode === "normal") {
    throw new Error(
      "requestTraceMode=normal is not enabled until the pinned CarbonForge image's trace destination contract is authoritatively confirmed.",
    );
  }
  if (config.requestTraceMode === "full") {
    throw new Error(
      "requestTraceMode=full is prohibited until approved data-handling controls define purpose, retention, access, and deletion.",
    );
  }
  return config;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}
