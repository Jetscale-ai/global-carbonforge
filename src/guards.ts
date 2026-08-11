import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export type RuntimeIdentityDecision = "allow" | "allow-breakglass";

export type RuntimeIdentityInput = {
  accountId: string;
  arn: string;
  targetAccountId: string;
  project: string;
  stack: string;
  isDryRun: boolean;
  allowLocalLiveMutation: boolean;
};

export function authorizeRuntimeIdentity({
  accountId,
  arn,
  targetAccountId,
  project,
  stack,
  isDryRun,
  allowLocalLiveMutation,
}: RuntimeIdentityInput): RuntimeIdentityDecision {
  if (accountId !== targetAccountId) {
    throw new Error(
      `Wrong AWS account: expected ${targetAccountId}, received ${accountId}. Aborting to prevent a cross-account deployment.`,
    );
  }

  if (stack !== "live" || isDryRun) {
    return "allow";
  }

  if (arn.includes(`:assumed-role/${project}-${stack}-pulumi-deployment/`)) {
    return "allow";
  }

  if (
    allowLocalLiveMutation &&
    arn.includes(":assumed-role/global-breakglass-admin/")
  ) {
    return "allow-breakglass";
  }

  throw new Error(
    `Live mutations for JetScale/${project}/${stack} require the stack deployment role or an explicitly authorized governed break-glass admin session.`,
  );
}

export function enforceRuntimeIdentity(
  targetAccountId: string,
  project: string,
  stack: string,
): void {
  const identity = aws.getCallerIdentityOutput({});
  pulumi.all([identity.accountId, identity.arn]).apply(([accountId, arn]) => {
    const decision = authorizeRuntimeIdentity({
      accountId,
      arn,
      targetAccountId,
      project,
      stack,
      isDryRun: pulumi.runtime.isDryRun(),
      allowLocalLiveMutation:
        process.env.JETSCALE_ALLOW_LOCAL_LIVE_MUTATION === "1",
    });

    if (decision === "allow-breakglass") {
      pulumi.log.warn(
        `JETSCALE_ALLOW_LOCAL_LIVE_MUTATION=1 permits an authorized local live mutation for JetScale/${project}/${stack} through global-breakglass-admin.`,
      );
    }
  });
}
