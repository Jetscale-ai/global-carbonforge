export function selectPrivateSubnetId(
  exportedPrivateSubnetIds: readonly string[],
  subnetIdsInAvailabilityZone: readonly string[],
  placementId: string,
  availabilityZone: string,
): string {
  const subnetIdsInAvailabilityZoneSet = new Set(subnetIdsInAvailabilityZone);
  const matchingPrivateSubnetIds = exportedPrivateSubnetIds.filter((id) =>
    subnetIdsInAvailabilityZoneSet.has(id),
  );

  if (matchingPrivateSubnetIds.length !== 1) {
    throw new Error(
      `activePlacement ${placementId} requires exactly one private subnet exported by global-cloud-network in ${availabilityZone}; found ${matchingPrivateSubnetIds.length}.`,
    );
  }

  return matchingPrivateSubnetIds[0];
}
