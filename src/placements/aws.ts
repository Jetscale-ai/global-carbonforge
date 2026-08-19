import type { AwsPlacement } from "../core/placement";

export type QuotaStatus = "ready-32" | "appeal-to-32";

export type RegionalPlacement = Omit<
  AwsPlacement,
  "id" | "readiness" | "machineType" | "accelerator" | "gpuCount"
> & {
  amiId: string;
  availabilityZone: string;
  documentation:
    "capacity-blocks" | "capacity-blocks-and-on-demand" | "on-demand";
  quotaStatus: QuotaStatus;
  region: string;
};

export const REGIONAL_PLACEMENTS = {
  "us-east-1a": {
    cloud: "aws",
    amiId: "ami-02c52c305263fdec5",
    availabilityZone: "us-east-1a",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-1",
  },
  "us-east-1b": {
    cloud: "aws",
    amiId: "ami-02c52c305263fdec5",
    availabilityZone: "us-east-1b",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-1",
  },
  "us-east-1c": {
    cloud: "aws",
    amiId: "ami-02c52c305263fdec5",
    availabilityZone: "us-east-1c",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-1",
  },
  "us-east-1d": {
    cloud: "aws",
    amiId: "ami-02c52c305263fdec5",
    availabilityZone: "us-east-1d",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-1",
  },
  "us-east-1e": {
    cloud: "aws",
    amiId: "ami-02c52c305263fdec5",
    availabilityZone: "us-east-1e",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-1",
  },
  "us-east-1f": {
    cloud: "aws",
    amiId: "ami-02c52c305263fdec5",
    availabilityZone: "us-east-1f",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-1",
  },
  "us-east-2a": {
    cloud: "aws",
    amiId: "ami-095f757d9450363f1",
    availabilityZone: "us-east-2a",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-2",
  },
  "us-east-2b": {
    cloud: "aws",
    amiId: "ami-095f757d9450363f1",
    availabilityZone: "us-east-2b",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-2",
  },
  "us-east-2c": {
    cloud: "aws",
    amiId: "ami-095f757d9450363f1",
    availabilityZone: "us-east-2c",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-east-2",
  },
  "us-west-2a": {
    cloud: "aws",
    amiId: "ami-0428babdb1241c52c",
    availabilityZone: "us-west-2a",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-west-2",
  },
  "us-west-2b": {
    cloud: "aws",
    amiId: "ami-0428babdb1241c52c",
    availabilityZone: "us-west-2b",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-west-2",
  },
  "us-west-2c": {
    cloud: "aws",
    amiId: "ami-0428babdb1241c52c",
    availabilityZone: "us-west-2c",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-west-2",
  },
  "us-west-2d": {
    cloud: "aws",
    amiId: "ami-0428babdb1241c52c",
    availabilityZone: "us-west-2d",
    documentation: "capacity-blocks",
    quotaStatus: "ready-32",
    region: "us-west-2",
  },
  "ap-northeast-1c": {
    cloud: "aws",
    amiId: "ami-02f7c19439521aee6",
    availabilityZone: "ap-northeast-1c",
    documentation: "capacity-blocks-and-on-demand",
    quotaStatus: "ready-32",
    region: "ap-northeast-1",
  },
  "ap-southeast-3a": {
    cloud: "aws",
    amiId: "ami-06bc172b9832559df",
    availabilityZone: "ap-southeast-3a",
    documentation: "on-demand",
    quotaStatus: "ready-32",
    region: "ap-southeast-3",
  },
  "eu-west-2a": {
    cloud: "aws",
    amiId: "ami-0cea32ec69ab2f9b1",
    availabilityZone: "eu-west-2a",
    documentation: "capacity-blocks-and-on-demand",
    quotaStatus: "ready-32",
    region: "eu-west-2",
  },
  "eu-west-2b": {
    cloud: "aws",
    amiId: "ami-0cea32ec69ab2f9b1",
    availabilityZone: "eu-west-2b",
    documentation: "capacity-blocks-and-on-demand",
    quotaStatus: "ready-32",
    region: "eu-west-2",
  },
  "eu-west-2c": {
    cloud: "aws",
    amiId: "ami-0cea32ec69ab2f9b1",
    availabilityZone: "eu-west-2c",
    documentation: "capacity-blocks-and-on-demand",
    quotaStatus: "ready-32",
    region: "eu-west-2",
  },
  "ap-south-1a": {
    cloud: "aws",
    amiId: "ami-0272495ab313de931",
    availabilityZone: "ap-south-1a",
    documentation: "capacity-blocks-and-on-demand",
    quotaStatus: "ready-32",
    region: "ap-south-1",
  },
  "ap-south-1b": {
    cloud: "aws",
    amiId: "ami-0272495ab313de931",
    availabilityZone: "ap-south-1b",
    documentation: "capacity-blocks-and-on-demand",
    quotaStatus: "ready-32",
    region: "ap-south-1",
  },
  "ap-south-1c": {
    cloud: "aws",
    amiId: "ami-0272495ab313de931",
    availabilityZone: "ap-south-1c",
    documentation: "capacity-blocks-and-on-demand",
    quotaStatus: "ready-32",
    region: "ap-south-1",
  },
  "ap-southeast-2b": {
    cloud: "aws",
    amiId: "ami-0ea9f1a89ebad6aa0",
    availabilityZone: "ap-southeast-2b",
    documentation: "capacity-blocks",
    quotaStatus: "appeal-to-32",
    region: "ap-southeast-2",
  },
  "sa-east-1c": {
    cloud: "aws",
    amiId: "ami-011ba3cfa392a96a0",
    availabilityZone: "sa-east-1c",
    documentation: "capacity-blocks-and-on-demand",
    quotaStatus: "ready-32",
    region: "sa-east-1",
  },
} as const satisfies Record<string, RegionalPlacement>;

export type PlacementId = keyof typeof REGIONAL_PLACEMENTS;

export type SelectedAwsPlacement = RegionalPlacement &
  AwsPlacement & {
    id: PlacementId;
    documentation: RegionalPlacement["documentation"];
    quotaStatus: QuotaStatus;
  };

export function selectRegionalPlacement(
  placementId: string,
): SelectedAwsPlacement {
  if (!(placementId in REGIONAL_PLACEMENTS)) {
    throw new Error(
      `Unknown activePlacement ${placementId}. Expected one of: ${Object.keys(REGIONAL_PLACEMENTS).join(", ")}.`,
    );
  }

  const id = placementId as PlacementId;
  const placement: RegionalPlacement = REGIONAL_PLACEMENTS[id];
  if (placement.quotaStatus !== "ready-32") {
    throw new Error(
      `activePlacement ${id} is specified but its 32-vCPU On-Demand P quota is still under appeal.`,
    );
  }
  return {
    ...placement,
    id,
    accelerator: "nvidia-h100",
    gpuCount: 1,
    machineType: "p5.4xlarge",
    readiness: "ready",
  };
}
