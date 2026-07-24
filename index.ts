import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import {
  enforceLiveMutationGuard,
  enforceTargetAwsAccount,
} from "./src/guards";
import { validateRuntimeConfig } from "./src/runtime-config";
import {
  getGlobalCloudIdentityOutputs,
  getGlobalCloudNetworkOutputs,
} from "./src/stack-dependencies";

const cfg = new pulumi.Config();
const project = pulumi.getProject();
const stack = pulumi.getStack();
const targetAwsAccountId = cfg.require("targetAwsAccountId");

const runtime = validateRuntimeConfig({
  modelName: cfg.require("modelName"),
  engineVersion: cfg.require("engineVersion"),
  maxModelLength: cfg.requireNumber("maxModelLength"),
  tensorParallelSize: cfg.requireNumber("tensorParallelSize"),
  gpuMemoryUtilization: cfg.requireNumber("gpuMemoryUtilization"),
  maxConcurrentSequences: cfg.requireNumber("maxConcurrentSequences"),
  runtimePort: cfg.requireNumber("runtimePort"),
  scheduler: cfg.require("scheduler"),
  requestTraceMode: cfg.require("requestTraceMode") as "normal" | "full",
});

enforceLiveMutationGuard(project, stack);
enforceTargetAwsAccount(targetAwsAccountId);

const network = getGlobalCloudNetworkOutputs(cfg.require("networkStackRef"));
const identity = getGlobalCloudIdentityOutputs(cfg.require("identityStackRef"));

// This is deliberately a contract-only scaffold. No compute, IAM, security
// groups, secrets, or endpoints are created until the roadmap gates are met.
export const stackIdentity = `${project}/${stack}`;
export const deploymentMaturity = "scaffold";
export const targetAwsAccount = targetAwsAccountId;
export const region = aws.config.region ?? "us-east-1";
export const runtimeConfiguration = runtime;
export const networkContract = {
  vpcId: network.vpcId,
  privateSubnetIds: network.privateSubnetIds,
};
export const identityContract = {
  pulumiOidcProviderArn: identity.pulumiOidcProviderArn,
  pulumiOidcAudience: identity.pulumiOidcAudience,
};
export const downstreamContract = {
  status: "not-deployed",
  modelName: runtime.modelName,
  openAiBaseUrl: null,
  healthUrl: null,
  securityGroupId: null,
  instanceId: null,
};
