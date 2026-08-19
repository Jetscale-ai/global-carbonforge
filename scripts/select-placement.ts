import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import {
  REGIONAL_PLACEMENTS,
  selectRegionalPlacement,
} from "../src/placements/aws";

const placementId = process.argv[2];
if (!placementId) {
  console.error("Usage: pnpm placement:select <placement-id>");
  console.error(`Available: ${Object.keys(REGIONAL_PLACEMENTS).join(", ")}`);
  process.exit(2);
}

const placement = selectRegionalPlacement(placementId);
const stackName = `live-aws-${placement.id}`;
const stackConfigPath = `Pulumi.${stackName}.yaml`;
if (!existsSync(stackConfigPath)) {
  console.error(
    `Placement ${placement.id} has no committed stack configuration at ${stackConfigPath}.`,
  );
  process.exit(2);
}
const stack = `JetScale/global-carbonforge/${stackName}`;
const configUpdates = [
  ["global-carbonforge:activePlacement", placement.id],
  ["aws:region", placement.region],
] as const;

for (const [key, value] of configUpdates) {
  const result = spawnSync(
    "pulumi",
    ["config", "set", key, value, "--stack", stack],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(
      `Failed to set ${key}; placement configuration may be incomplete.`,
    );
    process.exit(result.status ?? 1);
  }
}

console.log(
  `Selected ${placement.id}: ${placement.region}, ${placement.availabilityZone}, ${placement.amiId}`,
);
console.log(`Stack: ${stack}`);
console.log(`Next: pnpm pulumi preview --diff -s ${stack}`);
