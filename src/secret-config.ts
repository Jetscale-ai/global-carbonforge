import * as pulumi from "@pulumi/pulumi";

export type RuntimeSecrets = {
  ghcrPullToken: pulumi.Output<string>;
  licenseKey: pulumi.Output<string>;
};

export function getRuntimeSecrets(config: pulumi.Config): RuntimeSecrets {
  return {
    ghcrPullToken: config.requireSecret("ghcrPullToken"),
    licenseKey: config.requireSecret("carbonforgeLicenseKey"),
  };
}
