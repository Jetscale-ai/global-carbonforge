import assert from "node:assert/strict";
import test from "node:test";

import { validateContainerConfig } from "../src/container-config";

const validConfig = {
  repository: "ghcr.io/jetscale-ai/carbonforge-eval",
  tag: "v0.1.8-v0.1.3",
  digest: `sha256:${"a".repeat(64)}`,
};

test("builds an immutable GHCR reference from a verified digest", () => {
  assert.equal(
    validateContainerConfig(validConfig).immutableReference,
    `${validConfig.repository}@${validConfig.digest}`,
  );
});

test("allows the anticipated package before its digest is known", () => {
  assert.equal(
    validateContainerConfig({
      repository: validConfig.repository,
      tag: validConfig.tag,
    }).immutableReference,
    null,
  );
});

test("rejects another registry or package", () => {
  assert.throws(
    () =>
      validateContainerConfig({
        ...validConfig,
        repository: "example.com/image",
      }),
    /containerRepository must be ghcr\.io\/jetscale-ai\/carbonforge-eval/,
  );
});

test("rejects another tag and malformed digests", () => {
  assert.throws(
    () => validateContainerConfig({ ...validConfig, tag: "v0.1.9-v0.1.3" }),
    /containerTag must be v0\.1\.8-v0\.1\.3/,
  );
  assert.throws(
    () => validateContainerConfig({ ...validConfig, digest: "sha256:pending" }),
    /containerDigest/,
  );
});
