import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { CarbonForgeRuntime } from "./src/carbonforge-runtime";
import { validateContainerConfig } from "./src/container-config";
import { DeploymentRole } from "./src/deployment-role";
import {
  enforceLiveMutationGuard,
  enforceTargetAwsAccount,
} from "./src/guards";
import { validateHostConfig } from "./src/host-config";
import { validateRuntimeConfig } from "./src/runtime-config";
import { getRuntimeSecrets } from "./src/secret-config";
import {
  getGlobalCloudIdentityOutputs,
  getGlobalCloudNetworkOutputs,
} from "./src/stack-dependencies";

const cfg = new pulumi.Config();
const project = pulumi.getProject();
const stack = pulumi.getStack();
const targetAwsAccountId = cfg.require("targetAwsAccountId");
const runtimeSecrets = getRuntimeSecrets(cfg);

const container = validateContainerConfig({
  repository: cfg.require("containerRepository"),
  tag: cfg.require("containerTag"),
  digest: cfg.get("containerDigest"),
});

const host = validateHostConfig({
  instanceType: cfg.require("instanceType"),
  gpuCount: cfg.requireNumber("gpuCount"),
  rootVolumeSizeGiB: cfg.requireNumber("rootVolumeSizeGiB"),
  baseAmiFamily: cfg.require("baseAmiFamily"),
  publicIpv4Enabled: cfg.requireBoolean("publicIpv4Enabled"),
  sshIngressEnabled: cfg.requireBoolean("sshIngressEnabled"),
});

const runtime = validateRuntimeConfig({
  modelName: cfg.require("modelName"),
  engineVersion: cfg.require("engineVersion"),
  maxModelLength: cfg.requireNumber("maxModelLength"),
  tensorParallelSize: cfg.requireNumber("tensorParallelSize"),
  gpuMemoryUtilization: cfg.requireNumber("gpuMemoryUtilization"),
  maxConcurrentSequences: cfg.requireNumber("maxConcurrentSequences"),
  runtimePort: cfg.requireNumber("runtimePort"),
  scheduler: cfg.require("scheduler"),
  trustRemoteCode: cfg.requireBoolean("trustRemoteCode"),
  languageModelOnly: cfg.requireBoolean("languageModelOnly"),
  reasoningParser: cfg.require("reasoningParser"),
  enableAutoToolChoice: cfg.requireBoolean("enableAutoToolChoice"),
  toolCallParser: cfg.require("toolCallParser"),
  requestTraceMode: cfg.require("requestTraceMode") as
    "disabled" | "normal" | "full",
});

enforceLiveMutationGuard(project, stack);
enforceTargetAwsAccount(targetAwsAccountId);

const region = aws.config.region ?? "us-east-1";
const network = getGlobalCloudNetworkOutputs(
  cfg.require("networkStackRef"),
  region,
);
const identity = getGlobalCloudIdentityOutputs(cfg.require("identityStackRef"));
const subnetId = cfg.require("subnetId");
const availabilityZone = cfg.require("availabilityZone");
const selectedSubnet = aws.ec2.getSubnetOutput({ id: subnetId });

pulumi
  .all([
    network.privateSubnetIds,
    network.vpcId,
    selectedSubnet.vpcId,
    selectedSubnet.availabilityZone,
    selectedSubnet.mapPublicIpOnLaunch,
  ])
  .apply(
    ([
      privateSubnetIds,
      expectedVpcId,
      actualVpcId,
      actualAvailabilityZone,
      mapPublicIpOnLaunch,
    ]) => {
      if (!privateSubnetIds.includes(subnetId)) {
        throw new Error(
          `subnetId ${subnetId} is not exported by the configured network stack.`,
        );
      }
      if (actualVpcId !== expectedVpcId) {
        throw new Error(`subnetId ${subnetId} is not in VPC ${expectedVpcId}.`);
      }
      if (actualAvailabilityZone !== availabilityZone) {
        throw new Error(
          `subnetId ${subnetId} is in ${actualAvailabilityZone}, not ${availabilityZone}.`,
        );
      }
      if (mapPublicIpOnLaunch) {
        throw new Error(
          `subnetId ${subnetId} must not auto-assign public IPv4.`,
        );
      }
    },
  );

if (!container.immutableReference) {
  throw new Error(
    "containerDigest is required before runtime resources can be created.",
  );
}

const runtimeService = new CarbonForgeRuntime("carbonforge", {
  amiId: cfg.require("amiId"),
  availabilityZone,
  ghcrPullToken: runtimeSecrets.ghcrPullToken,
  ghcrUsername: cfg.require("ghcrUsername"),
  imageReference: container.immutableReference,
  instanceType: host.instanceType,
  licenseKey: runtimeSecrets.licenseKey,
  modelName: runtime.modelName,
  modelRevision: cfg.require("modelRevision"),
  region,
  rootVolumeSizeGiB: host.rootVolumeSizeGiB,
  runtimePort: runtime.runtimePort,
  scheduler: runtime.scheduler,
  maxModelLength: runtime.maxModelLength,
  tensorParallelSize: runtime.tensorParallelSize,
  gpuMemoryUtilization: runtime.gpuMemoryUtilization,
  maxConcurrentSequences: runtime.maxConcurrentSequences,
  trustRemoteCode: runtime.trustRemoteCode,
  languageModelOnly: runtime.languageModelOnly,
  reasoningParser: runtime.reasoningParser,
  enableAutoToolChoice: runtime.enableAutoToolChoice,
  toolCallParser: runtime.toolCallParser,
  requestTraceMode: runtime.requestTraceMode as "disabled",
  subnetId,
  vpcId: network.vpcId,
});

const deploymentRole = new DeploymentRole("pulumi-deployment", {
  oidcAudience: identity.pulumiOidcAudience,
  oidcProviderArn: identity.pulumiOidcProviderArn,
  targetAwsAccountId,
});

export const stackIdentity = `${project}/${stack}`;
export const deploymentMaturity = "planned-runtime";
export const targetAwsAccount = targetAwsAccountId;
export { region };
export const containerConfiguration = container;
export const hostConfiguration = host;
export const runtimeConfiguration = runtime;
export const networkContract = {
  vpcId: network.vpcId,
  privateSubnetIds: network.privateSubnetIds,
};
export const identityContract = {
  pulumiOidcProviderArn: identity.pulumiOidcProviderArn,
  pulumiOidcAudience: identity.pulumiOidcAudience,
};
export const deploymentRoleArn = deploymentRole.roleArn;
export const downstreamContract = {
  status: "provisioned-after-apply",
  modelName: runtime.modelName,
  modelRevision: cfg.require("modelRevision"),
  openAiBaseUrl: runtimeService.openAiBaseUrl,
  healthUrl: runtimeService.healthUrl,
  securityGroupId: runtimeService.securityGroupId,
  instanceId: runtimeService.instanceId,
  privateIp: runtimeService.privateIp,
};
