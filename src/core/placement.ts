import type { CloudProvider } from "./deployment";

export type PlacementReadiness = "ready" | "blocked";

export type PlacementBase = {
  cloud: CloudProvider;
  id: string;
  accelerator: "nvidia-h100";
  gpuCount: 1;
  machineType: string;
  readiness: PlacementReadiness;
};

export type AwsPlacement = PlacementBase & {
  cloud: "aws";
  region: string;
  availabilityZone: string;
  amiId: string;
};

export type GcpPlacement = PlacementBase & {
  cloud: "gcp";
  region: string;
  zone: string;
  image: string;
  provisioningModel: "spot" | "flex-start" | "standard";
};

export type AzurePlacement = PlacementBase & {
  cloud: "azure";
  location: string;
  zone: string;
  image: string;
};

export type Placement = AwsPlacement | GcpPlacement | AzurePlacement;

export function assertPlacementMatchesStack(
  placement: Placement,
  stackCloud: CloudProvider,
  stackPlacementId: string,
): void {
  if (placement.cloud !== stackCloud || placement.id !== stackPlacementId) {
    throw new Error(
      `Stack selects ${stackCloud}/${stackPlacementId}, but configuration resolved ${placement.cloud}/${placement.id}.`,
    );
  }
}
