import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function enforceLiveMutationGuard(project: string, stack: string): void {
  const isLiveStack = stack === "live";
  const isRemoteDeployment =
    process.env.PULUMI_CI_SYSTEM === "Pulumi Deployments";
  const isBreakglass = process.env.DR014_BREAKGLASS === "1";

  if (!isLiveStack || pulumi.runtime.isDryRun() || isRemoteDeployment) {
    return;
  }
  if (isBreakglass) {
    pulumi.log.warn(
      `DR014_BREAKGLASS=1 permits a local live mutation for JetScale/${project}/${stack}; this must be a ticketed break-glass action.`,
    );
    return;
  }
  throw new Error(
    `Live mutations for JetScale/${project}/${stack} must run through Pulumi Deployments (DR-014).`,
  );
}

export function enforceTargetAwsAccount(targetAccountId: string): void {
  aws.getCallerIdentityOutput({}).accountId.apply((accountId) => {
    if (accountId !== targetAccountId) {
      throw new Error(
        `Wrong AWS account: expected ${targetAccountId}, received ${accountId}. Aborting to prevent a cross-account deployment.`,
      );
    }
  });
}
