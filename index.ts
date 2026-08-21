import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import {
  assertPlacementMatchesStack,
  type Placement,
} from "./src/core/placement";
import { parseDeploymentStackName } from "./src/core/deployment";
import { validateContainerConfig } from "./src/container-config";
import { DeploymentRole } from "./src/providers/aws/deployment-role";
import { CarbonForgeRuntime } from "./src/providers/aws/runtime";
import { enforceRuntimeIdentity } from "./src/guards";
import { validateHostConfig } from "./src/host-config";
import { selectRegionalPlacement } from "./src/placements/aws";
import { validateRuntimeConfig } from "./src/runtime-config";
import { getRuntimeSecrets } from "./src/secret-config";
import { selectPrivateSubnetId } from "./src/subnet-selection";
import {
  getGlobalCloudIdentityOutputs,
  getGlobalCloudNetworkOutputs,
} from "./src/stack-dependencies";

const cfg = new pulumi.Config();
const project = pulumi.getProject();
const stack = pulumi.getStack();
const stackCoordinates = parseDeploymentStackName(stack);
if (stackCoordinates.cloud !== "aws") {
  throw new Error(
    `Cloud provider ${stackCoordinates.cloud} is not implemented yet. AWS remains the only deployable adapter.`,
  );
}

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

enforceRuntimeIdentity(targetAwsAccountId, project, stack);

const placement = selectRegionalPlacement(cfg.require("activePlacement"));
assertPlacementMatchesStack(
  placement as Placement,
  stackCoordinates.cloud,
  stackCoordinates.placementId,
);
const region = aws.config.region;
if (!region) {
  throw new Error(
    `aws:region must match activePlacement ${placement.id} (${placement.region}). Run pnpm placement:select ${placement.id}.`,
  );
}
if (region !== placement.region) {
  throw new Error(
    `aws:region ${region} does not match activePlacement ${placement.id} (${placement.region}). Run pnpm placement:select ${placement.id}.`,
  );
}
const network = getGlobalCloudNetworkOutputs(
  cfg.require("networkStackRef"),
  region,
);
const identity = getGlobalCloudIdentityOutputs(cfg.require("identityStackRef"));
const availabilityZone = placement.availabilityZone;
const subnetsInPlacementAz = aws.ec2.getSubnetsOutput({
  filters: [
    { name: "availability-zone", values: [availabilityZone] },
    { name: "vpc-id", values: [network.vpcId] },
  ],
});
const subnetId = pulumi
  .all([network.privateSubnetIds, subnetsInPlacementAz.ids])
  .apply(([privateSubnetIds, subnetIdsInAz]) =>
    selectPrivateSubnetId(
      privateSubnetIds,
      subnetIdsInAz,
      placement.id,
      availabilityZone,
    ),
  );
const selectedSubnet = aws.ec2.getSubnetOutput({ id: subnetId });

pulumi
  .all([
    network.vpcId,
    selectedSubnet.vpcId,
    selectedSubnet.availabilityZone,
    selectedSubnet.mapPublicIpOnLaunch,
  ])
  .apply(
    ([
      expectedVpcId,
      actualVpcId,
      actualAvailabilityZone,
      mapPublicIpOnLaunch,
    ]) => {
      if (actualVpcId !== expectedVpcId) {
        throw new Error(`Selected subnet is not in VPC ${expectedVpcId}.`);
      }
      if (actualAvailabilityZone !== availabilityZone) {
        throw new Error(
          `Selected subnet is in ${actualAvailabilityZone}, not ${availabilityZone}.`,
        );
      }
      if (mapPublicIpOnLaunch) {
        throw new Error(
          "Selected private subnet must not auto-assign public IPv4.",
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
  allowedInferenceCidr: network.privateInferenceTransport.apply(
    ({ requesterVpcCidr }) => requesterVpcCidr,
  ),
  amiId: placement.amiId,
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
export const cloud = stackCoordinates.cloud;
export const placementId = placement.id;
export const deploymentMaturity = "planned-runtime";
export const targetAwsAccount = targetAwsAccountId;
export { region };
export const activePlacement = placement;
export const containerConfiguration = container;
export const hostConfiguration = host;
export const runtimeConfiguration = runtime;
export const networkContract = {
  vpcId: network.vpcId,
  privateSubnetIds: network.privateSubnetIds,
  privateInferenceTransport: network.privateInferenceTransport,
};
export const identityContract = {
  pulumiOidcProviderArn: identity.pulumiOidcProviderArn,
  pulumiOidcAudience: identity.pulumiOidcAudience,
};
export const deploymentRoleArn = deploymentRole.roleArn;
export const downstreamContract = {
  status: "provisioned-after-apply",
  cloud: stackCoordinates.cloud,
  placementId: placement.id,
  modelName: runtime.modelName,
  modelRevision: cfg.require("modelRevision"),
  openAiBaseUrl: runtimeService.openAiBaseUrl,
  healthUrl: runtimeService.healthUrl,
  firewallIdentity: runtimeService.firewallIdentity,
  securityGroupId: runtimeService.securityGroupId,
  instanceId: runtimeService.instanceId,
  privateIp: runtimeService.privateIp,
};
