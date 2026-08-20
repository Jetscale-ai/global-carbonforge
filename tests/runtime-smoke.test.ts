import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import {
  assertPrivateEndpoint,
  DEFAULT_SMOKE_MODEL,
  runRuntimeSmoke,
  SMOKE_PROMPT,
  validateChatCompletion,
  validateModelList,
} from "../src/runtime-smoke";

test("accepts loopback and private endpoints", async () => {
  await assert.doesNotReject(
    assertPrivateEndpoint(new URL("http://127.0.0.1:8000/v1")),
  );
  await assert.doesNotReject(
    assertPrivateEndpoint(new URL("http://10.0.1.10:8000/v1")),
  );
});

test("rejects public and link-local endpoints", async () => {
  await assert.rejects(
    assertPrivateEndpoint(new URL("https://8.8.8.8/v1")),
    /must resolve only to loopback or private addresses/,
  );
  await assert.rejects(
    assertPrivateEndpoint(new URL("http://169.254.169.254/v1")),
    /must resolve only to loopback or private addresses/,
  );
});

test("validates the expected model list", () => {
  assert.doesNotThrow(() =>
    validateModelList(
      { data: [{ id: DEFAULT_SMOKE_MODEL }] },
      DEFAULT_SMOKE_MODEL,
    ),
  );
  assert.throws(
    () => validateModelList({ data: [{ id: "other" }] }, DEFAULT_SMOKE_MODEL),
    /was not listed/,
  );
});

test("validates completion shape without returning generated content", () => {
  const result = validateChatCompletion(
    {
      model: DEFAULT_SMOKE_MODEL,
      choices: [{ finish_reason: "stop", message: { content: "Hello!" } }],
      usage: { prompt_tokens: 8, completion_tokens: 2 },
    },
    DEFAULT_SMOKE_MODEL,
  );
  assert.deepEqual(result, {
    responseModel: DEFAULT_SMOKE_MODEL,
    finishReason: "stop",
    promptTokens: 8,
    completionTokens: 2,
  });
  assert.equal("content" in result, false);
});

test("requires a positive completion token count", () => {
  assert.throws(
    () =>
      validateChatCompletion(
        {
          model: DEFAULT_SMOKE_MODEL,
          choices: [{ finish_reason: "stop", message: { content: "Hello!" } }],
          usage: { prompt_tokens: 8, completion_tokens: 0 },
        },
        DEFAULT_SMOKE_MODEL,
      ),
    /positive completion token count/,
  );
});

test("queries models and chat completions with the fixed safe prompt", async (context) => {
  let receivedBody: unknown;
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: DEFAULT_SMOKE_MODEL }] }));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        receivedBody = JSON.parse(body);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            model: DEFAULT_SMOKE_MODEL,
            choices: [
              { finish_reason: "stop", message: { content: "Hello!" } },
            ],
            usage: { prompt_tokens: 8, completion_tokens: 2 },
          }),
        );
      });
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  assert(address && typeof address === "object");

  const result = await runRuntimeSmoke(
    `http://127.0.0.1:${address.port}`,
    undefined,
    5_000,
  );

  assert.deepEqual(receivedBody, {
    model: DEFAULT_SMOKE_MODEL,
    messages: [{ role: "user", content: SMOKE_PROMPT }],
    max_tokens: 32,
    temperature: 0,
  });
  assert.equal(result.modelListed, true);
  assert.equal(result.responseModel, DEFAULT_SMOKE_MODEL);
  assert.equal(result.completionTokens, 2);
  assert.equal("content" in result, false);
});
