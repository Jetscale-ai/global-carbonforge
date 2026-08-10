import * as pulumi from "@pulumi/pulumi";

export type GlobalCloudNetworkOutputs = {
  vpcId: pulumi.Output<string>;
  privateSubnetIds: pulumi.Output<string[]>;
};

type RegionalNetwork = {
  vpcId: string;
  privateSubnetIds: string[];
};

type RegionalNetworks = Record<string, RegionalNetwork>;

export type GlobalCloudIdentityOutputs = {
  pulumiOidcProviderArn: pulumi.Output<string>;
  pulumiOidcAudience: pulumi.Output<string>;
};

export function getGlobalCloudNetworkOutputs(
  stackRef: string,
  region: string,
): GlobalCloudNetworkOutputs {
  const network = new pulumi.StackReference(stackRef);
  const regionalNetwork = (
    network.requireOutput("regionalNetworks") as pulumi.Output<RegionalNetworks>
  ).apply((regionalNetworks) => {
    const selectedNetwork = regionalNetworks[region];
    if (!selectedNetwork) {
      throw new Error(
        `Network stack ${stackRef} does not export a network for ${region}.`,
      );
    }
    return selectedNetwork;
  });

  return {
    vpcId: regionalNetwork.apply(({ vpcId }) => vpcId),
    privateSubnetIds: regionalNetwork.apply(
      ({ privateSubnetIds }) => privateSubnetIds,
    ),
  };
}

export function getGlobalCloudIdentityOutputs(
  stackRef: string,
): GlobalCloudIdentityOutputs {
  const identity = new pulumi.StackReference(stackRef);
  return {
    pulumiOidcProviderArn: identity.requireOutput(
      "pulumiOidcProviderArn",
    ) as pulumi.Output<string>,
    pulumiOidcAudience: identity.requireOutput(
      "pulumiOidcAudience",
    ) as pulumi.Output<string>,
  };
}
