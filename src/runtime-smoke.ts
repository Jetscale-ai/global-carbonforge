import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const SMOKE_PROMPT = "Say hello.";
export const DEFAULT_SMOKE_MODEL = "Qwen/Qwen3.5-27B-FP8";

export type SmokeResult = {
  endpoint: string;
  model: string;
  modelListed: boolean;
  responseModel: string;
  finishReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
};

type ModelListResponse = {
  data?: Array<{ id?: unknown }>;
};

type ChatCompletionResponse = {
  model?: unknown;
  choices?: Array<{
    finish_reason?: unknown;
    message?: {
      content?: unknown;
      tool_calls?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
  };
};

export async function assertPrivateEndpoint(endpoint: URL): Promise<void> {
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("Smoke endpoint must use HTTP or HTTPS.");
  }
  if (endpoint.username || endpoint.password) {
    throw new Error("Smoke endpoint must not contain credentials.");
  }

  const hostname = endpoint.hostname.toLowerCase();
  if (hostname === "localhost") return;

  const addressLiteral = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(addressLiteral)
    ? [addressLiteral]
    : (await lookup(hostname, { all: true })).map(({ address }) => address);
  if (
    addresses.length === 0 ||
    addresses.some((address) => !isPrivateAddress(address))
  ) {
    throw new Error(
      `Smoke endpoint must resolve only to loopback or private addresses; resolved ${addresses.join(", ") || "none"}.`,
    );
  }
}

export function validateModelList(
  payload: unknown,
  expectedModel: string,
): void {
  const response = payload as ModelListResponse;
  const modelIds = response.data?.map(({ id }) => id).filter(isString) ?? [];
  if (!modelIds.includes(expectedModel)) {
    throw new Error(
      `Expected model ${expectedModel} was not listed by /v1/models.`,
    );
  }
}

export function validateChatCompletion(
  payload: unknown,
  expectedModel: string,
): Omit<SmokeResult, "endpoint" | "model" | "modelListed" | "durationMs"> {
  const response = payload as ChatCompletionResponse;
  if (!isString(response.model) || response.model !== expectedModel) {
    throw new Error(
      `Chat completion response model did not match ${expectedModel}.`,
    );
  }

  const choice = response.choices?.[0];
  if (!choice?.message) {
    throw new Error(
      "Chat completion response did not contain a message choice.",
    );
  }
  const hasContent =
    isString(choice.message.content) && choice.message.content.length > 0;
  const hasToolCalls =
    Array.isArray(choice.message.tool_calls) &&
    choice.message.tool_calls.length > 0;
  if (!hasContent && !hasToolCalls) {
    throw new Error(
      "Chat completion response contained neither content nor tool calls.",
    );
  }

  return {
    responseModel: response.model,
    finishReason: isString(choice.finish_reason) ? choice.finish_reason : null,
    promptTokens: asNonNegativeInteger(response.usage?.prompt_tokens),
    completionTokens: asNonNegativeInteger(response.usage?.completion_tokens),
  };
}

export async function runRuntimeSmoke(
  endpointValue: string,
  model = DEFAULT_SMOKE_MODEL,
  timeoutMs = 30_000,
): Promise<SmokeResult> {
  const endpoint = normalizeEndpoint(endpointValue);
  await assertPrivateEndpoint(endpoint);

  const startedAt = performance.now();
  const modelsPayload = await requestJson(new URL("models", endpoint), {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
  });
  validateModelList(modelsPayload, model);

  const completionPayload = await requestJson(
    new URL("chat/completions", endpoint),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: SMOKE_PROMPT }],
        max_tokens: 32,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  const completion = validateChatCompletion(completionPayload, model);

  return {
    endpoint: `${endpoint.origin}${endpoint.pathname.replace(/\/$/, "")}`,
    model,
    modelListed: true,
    ...completion,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

function normalizeEndpoint(value: string): URL {
  const endpoint = new URL(value);
  const path = endpoint.pathname.replace(/\/*$/, "");
  endpoint.pathname = path.endsWith("/v1") ? `${path}/` : `${path}/v1/`;
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint;
}

async function requestJson(url: URL, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, redirect: "error" });
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${url.pathname} returned HTTP ${response.status}.`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `${init.method ?? "GET"} ${url.pathname} did not return JSON.`,
    );
  }
  return response.json();
}

function isPrivateAddress(address: string): boolean {
  if (address === "::1") return true;
  if (
    address.toLowerCase().startsWith("fc") ||
    address.toLowerCase().startsWith("fd")
  ) {
    return true;
  }

  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet)))
    return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function asNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}
