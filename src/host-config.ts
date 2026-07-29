export type HostConfig = {
  instanceType: string;
  gpuCount: number;
  rootVolumeSizeGiB: number;
  baseAmiFamily: string;
  publicIpv4Enabled: boolean;
  sshIngressEnabled: boolean;
};

const POC_INSTANCE_TYPE = "p5.4xlarge";
const POC_GPU_COUNT = 1;
const MINIMUM_ROOT_VOLUME_SIZE_GIB = 150;

export function validateHostConfig(config: HostConfig): HostConfig {
  if (config.instanceType !== POC_INSTANCE_TYPE) {
    throw new Error(
      `instanceType must be ${POC_INSTANCE_TYPE} for the approved single-H100 POC baseline.`,
    );
  }
  if (config.gpuCount !== POC_GPU_COUNT) {
    throw new Error(`gpuCount must be ${POC_GPU_COUNT} for the POC baseline.`);
  }
  if (
    !Number.isInteger(config.rootVolumeSizeGiB) ||
    config.rootVolumeSizeGiB < MINIMUM_ROOT_VOLUME_SIZE_GIB
  ) {
    throw new Error(
      `rootVolumeSizeGiB must be an integer of at least ${MINIMUM_ROOT_VOLUME_SIZE_GIB}.`,
    );
  }
  if (!config.baseAmiFamily.trim()) {
    throw new Error("baseAmiFamily must be non-empty.");
  }
  if (config.publicIpv4Enabled) {
    throw new Error("publicIpv4Enabled must remain false for the private POC.");
  }
  if (config.sshIngressEnabled) {
    throw new Error(
      "sshIngressEnabled must remain false; administration uses SSM.",
    );
  }
  return config;
}
