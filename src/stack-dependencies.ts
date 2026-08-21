import * as pulumi from "@pulumi/pulumi";

import {
  type PrivateInferenceTransport,
  validatePrivateInferenceTransport,
} from "./private-inference-transport";

export type GlobalCloudNetworkOutputs = {
  vpcId: pulumi.Output<string>;
  privateSubnetIds: pulumi.Output<string[]>;
  privateInferenceTransport: pulumi.Output<PrivateInferenceTransport>;
};

type RegionalNetwork = {
  vpcId: string;
  privateSubnetIds: string[];
};

type RegionalNetworks = Record<string, RegionalNetwork>;
type PrivateInferenceTransports = Record<string, PrivateInferenceTransport>;

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

  const vpcId = regionalNetwork.apply(({ vpcId }) => vpcId);
  const privateInferenceTransport = pulumi
    .all([
      network.requireOutput(
        "privateInferenceTransport",
      ) as pulumi.Output<PrivateInferenceTransports>,
      vpcId,
    ])
    .apply(([transports, expectedVpcId]) => {
      const transport = transports[region];
      if (!transport) {
        throw new Error(
          `Network stack ${stackRef} does not export a private inference transport for ${region}.`,
        );
      }
      return validatePrivateInferenceTransport(transport, expectedVpcId);
    });

  return {
    vpcId,
    privateSubnetIds: regionalNetwork.apply(
      ({ privateSubnetIds }) => privateSubnetIds,
    ),
    privateInferenceTransport,
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
