const GHCR_REPOSITORY = "ghcr.io/jetscale-ai/carbonforge-eval";
const CARBONFORGE_RELEASE_TAG = "v0.1.8-v0.1.3";
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export type ContainerConfig = {
  repository: string;
  tag: string;
  digest?: string;
};

export type ValidatedContainerConfig = ContainerConfig & {
  immutableReference: string | null;
};

export function validateContainerConfig(
  config: ContainerConfig,
): ValidatedContainerConfig {
  if (config.repository !== GHCR_REPOSITORY) {
    throw new Error(`containerRepository must be ${GHCR_REPOSITORY}.`);
  }
  if (config.tag !== CARBONFORGE_RELEASE_TAG) {
    throw new Error(`containerTag must be ${CARBONFORGE_RELEASE_TAG}.`);
  }
  if (
    config.digest !== undefined &&
    !SHA256_DIGEST_PATTERN.test(config.digest)
  ) {
    throw new Error(
      "containerDigest must use the form sha256:<64 lowercase hex characters>.",
    );
  }

  return {
    ...config,
    immutableReference: config.digest
      ? `${config.repository}@${config.digest}`
      : null,
  };
}
