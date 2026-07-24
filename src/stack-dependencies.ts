import * as pulumi from "@pulumi/pulumi";

export type GlobalCloudNetworkOutputs = {
  vpcId: pulumi.Output<string>;
  privateSubnetIds: pulumi.Output<string[]>;
};

export type GlobalCloudIdentityOutputs = {
  pulumiOidcProviderArn: pulumi.Output<string>;
  pulumiOidcAudience: pulumi.Output<string>;
};

export function getGlobalCloudNetworkOutputs(
  stackRef: string,
): GlobalCloudNetworkOutputs {
  const network = new pulumi.StackReference(stackRef);
  return {
    vpcId: network.requireOutput("vpcId") as pulumi.Output<string>,
    privateSubnetIds: network.requireOutput(
      "privateSubnetIds",
    ) as pulumi.Output<string[]>,
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
