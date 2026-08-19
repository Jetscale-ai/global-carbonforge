import type * as pulumi from "@pulumi/pulumi";

export const CLOUD_PROVIDERS = ["aws", "gcp", "azure"] as const;
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export type RuntimeDeployment = {
  cloud: CloudProvider;
  placementId: string;
  instanceId: pulumi.Output<string>;
  privateIp: pulumi.Output<string>;
  openAiBaseUrl: pulumi.Output<string>;
  healthUrl: pulumi.Output<string>;
  firewallIdentity: pulumi.Output<string>;
};

export type DeploymentStackIdentity = {
  environment: "dev" | "live";
  cloud: CloudProvider;
  placementId: string;
};

const STACK_NAME_PATTERN = /^(dev|live)-(aws|gcp|azure)-([a-z0-9][a-z0-9-]*)$/;

export function deploymentStackName({
  environment,
  cloud,
  placementId,
}: DeploymentStackIdentity): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(placementId)) {
    throw new Error(
      `placementId ${placementId} must contain only lowercase letters, numbers, and hyphens.`,
    );
  }
  return `${environment}-${cloud}-${placementId}`;
}

export function parseDeploymentStackName(
  stack: string,
): DeploymentStackIdentity {
  const match = STACK_NAME_PATTERN.exec(stack);
  if (!match) {
    throw new Error(
      `Stack ${stack} must follow <environment>-<cloud>-<placement>, for example live-aws-us-east-1b.`,
    );
  }

  return {
    environment: match[1] as DeploymentStackIdentity["environment"],
    cloud: match[2] as CloudProvider,
    placementId: match[3],
  };
}

export function isLiveDeploymentStack(stack: string): boolean {
  return stack === "live" || stack.startsWith("live-");
}
