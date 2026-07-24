export const REQUEST_TRACE_MODES = ["normal", "full"] as const;
export type RequestTraceMode = (typeof REQUEST_TRACE_MODES)[number];

export type RuntimeConfig = {
  modelName: string;
  engineVersion: string;
  maxModelLength: number;
  tensorParallelSize: number;
  gpuMemoryUtilization: number;
  maxConcurrentSequences: number;
  runtimePort: number;
  scheduler: string;
  requestTraceMode: RequestTraceMode;
};

export function validateRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  if (!config.modelName.trim()) throw new Error("modelName must be non-empty.");
  if (!config.engineVersion.trim())
    throw new Error("engineVersion must be non-empty.");
  assertPositiveInteger("maxModelLength", config.maxModelLength);
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
  if (!config.scheduler.trim()) throw new Error("scheduler must be non-empty.");
  if (!REQUEST_TRACE_MODES.includes(config.requestTraceMode)) {
    throw new Error(
      `requestTraceMode must be one of: ${REQUEST_TRACE_MODES.join(", ")}.`,
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
