import { runRuntimeSmoke } from "../src/runtime-smoke";

async function main(): Promise<void> {
  const endpoint = process.env.CARBONFORGE_BASE_URL;
  if (!endpoint) {
    console.error(
      "ERROR: CARBONFORGE_BASE_URL is required (for example, http://127.0.0.1:8000/v1).",
    );
    process.exitCode = 2;
    return;
  }

  try {
    const result = await runRuntimeSmoke(
      endpoint,
      process.env.CARBONFORGE_MODEL,
      parseTimeout(process.env.CARBONFORGE_SMOKE_TIMEOUT_MS),
    );
    console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown smoke-test failure.";
    console.error(`ERROR: CarbonForge runtime smoke test failed: ${message}`);
    process.exitCode = 1;
  }
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined) return 30_000;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 300_000) {
    throw new Error(
      "CARBONFORGE_SMOKE_TIMEOUT_MS must be an integer from 1 to 300000.",
    );
  }
  return timeout;
}

void main();
