import * as pulumi from "@pulumi/pulumi";

import {
  type PrivateInferenceTransport,
  validatePrivateInferenceTransport,
} from "./private-inference-transport";

export type GlobalCloudNetworkOutputs = {
  vpcId: pulumi.Output<string>;
  privateSubnetIds: pulumi.Output<string[]>;
  allowedInferenceCidr: pulumi.Output<string>;
  privateInferenceTransport: pulumi.Output<
    PrivateInferenceTransport | undefined
  >;
};

export type RegionalNetwork = {
  vpcCidr?: string;
  vpcId: string;
  privateSubnetIds: string[];
};

type RegionalNetworks = Record<string, RegionalNetwork>;
type PrivateInferenceTransports = Record<string, PrivateInferenceTransport>;

export type GlobalCloudIdentityOutputs = {
  pulumiOidcProviderArn: pulumi.Output<string>;
  pulumiOidcAudience: pulumi.Output<string>;
};

export function selectAllowedInferenceCidr(
  stackRef: string,
  region: string,
  selectedNetwork: RegionalNetwork,
  transport?: PrivateInferenceTransport,
): string {
  if (transport) {
    return transport.requesterVpcCidr;
  }
  if (!selectedNetwork.vpcCidr) {
    throw new Error(
      `Network stack ${stackRef} does not export a same-VPC inference CIDR or private inference transport for ${region}.`,
    );
  }
  return selectedNetwork.vpcCidr;
}

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
        return undefined;
      }
      return validatePrivateInferenceTransport(transport, expectedVpcId);
    });
  const allowedInferenceCidr = pulumi
    .all([regionalNetwork, privateInferenceTransport])
    .apply(([selectedNetwork, transport]) =>
      selectAllowedInferenceCidr(stackRef, region, selectedNetwork, transport),
    );

  return {
    vpcId,
    privateSubnetIds: regionalNetwork.apply(
      ({ privateSubnetIds }) => privateSubnetIds,
    ),
    allowedInferenceCidr,
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
