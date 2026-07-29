import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export type DeploymentRoleArgs = {
  oidcAudience: pulumi.Input<string>;
  oidcProviderArn: pulumi.Input<string>;
  targetAwsAccountId: string;
};

export class DeploymentRole extends pulumi.ComponentResource {
  public readonly roleArn: pulumi.Output<string>;

  constructor(
    name: string,
    args: DeploymentRoleArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("jetscale:carbonforge:DeploymentRole", name, {}, opts);

    const project = pulumi.getProject();
    const stack = pulumi.getStack();
    const tags = {
      Environment: stack,
      ManagedBy: "Pulumi",
      Owner: "global-services-platform",
      Project: project,
      Purpose: "pulumi-deployments",
    };

    const assumeRolePolicy = pulumi
      .all([args.oidcAudience, args.oidcProviderArn])
      .apply(([oidcAudience, oidcProviderArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { Federated: oidcProviderArn },
              Action: "sts:AssumeRoleWithWebIdentity",
              Condition: {
                StringEquals: {
                  "api.pulumi.com/oidc:aud": oidcAudience,
                },
                StringLike: {
                  "api.pulumi.com/oidc:sub": `pulumi:deploy:org:JetScale:project:${project}:stack:${stack}:*`,
                },
              },
            },
          ],
        }),
      );

    const role = new aws.iam.Role(
      `${name}-role`,
      {
        name: `${project}-${stack}-pulumi-deployment`,
        assumeRolePolicy,
        maxSessionDuration: 3600,
        tags,
      },
      { parent: this },
    );

    const runtimeRoleArn = `arn:aws:iam::${args.targetAwsAccountId}:role/${project}-${stack}-instance`;
    const deploymentRoleArn = `arn:aws:iam::${args.targetAwsAccountId}:role/${project}-${stack}-pulumi-deployment`;
    const instanceProfileArn = `arn:aws:iam::${args.targetAwsAccountId}:instance-profile/${project}-${stack}-instance`;
    const secretArnPrefix = `arn:aws:secretsmanager:*:${args.targetAwsAccountId}:secret:${project}/${stack}/`;

    new aws.iam.RolePolicy(
      `${name}-policy`,
      {
        role: role.id,
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "ManageEc2Runtime",
              Effect: "Allow",
              Action: [
                "ec2:AssociateIamInstanceProfile",
                "ec2:AttachNetworkInterface",
                "ec2:AuthorizeSecurityGroupEgress",
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:CreateSecurityGroup",
                "ec2:CreateTags",
                "ec2:DeleteSecurityGroup",
                "ec2:DeleteTags",
                "ec2:Describe*",
                "ec2:DisassociateIamInstanceProfile",
                "ec2:ModifyInstanceAttribute",
                "ec2:ModifyInstanceMetadataOptions",
                "ec2:RevokeSecurityGroupEgress",
                "ec2:RevokeSecurityGroupIngress",
                "ec2:RunInstances",
                "ec2:StartInstances",
                "ec2:StopInstances",
                "ec2:TerminateInstances",
              ],
              Resource: "*",
            },
            {
              Sid: "ManageRuntimeIdentity",
              Effect: "Allow",
              Action: [
                "iam:AddRoleToInstanceProfile",
                "iam:AttachRolePolicy",
                "iam:CreateInstanceProfile",
                "iam:CreateRole",
                "iam:DeleteInstanceProfile",
                "iam:DeleteRole",
                "iam:DeleteRolePolicy",
                "iam:DetachRolePolicy",
                "iam:GetInstanceProfile",
                "iam:GetRole",
                "iam:GetRolePolicy",
                "iam:ListAttachedRolePolicies",
                "iam:ListInstanceProfilesForRole",
                "iam:ListRolePolicies",
                "iam:PassRole",
                "iam:PutRolePolicy",
                "iam:RemoveRoleFromInstanceProfile",
                "iam:TagInstanceProfile",
                "iam:TagRole",
                "iam:UntagInstanceProfile",
                "iam:UntagRole",
                "iam:UpdateAssumeRolePolicy",
                "iam:UpdateRole",
              ],
              Resource: [runtimeRoleArn, deploymentRoleArn, instanceProfileArn],
            },
            {
              Sid: "CreateNamedRuntimeSecrets",
              Effect: "Allow",
              Action: "secretsmanager:CreateSecret",
              Resource: "*",
              Condition: {
                StringLike: {
                  "secretsmanager:Name": `${project}/${stack}/*`,
                },
              },
            },
            {
              Sid: "ManageRuntimeSecrets",
              Effect: "Allow",
              Action: [
                "secretsmanager:DeleteSecret",
                "secretsmanager:DescribeSecret",
                "secretsmanager:GetResourcePolicy",
                "secretsmanager:GetSecretValue",
                "secretsmanager:ListSecretVersionIds",
                "secretsmanager:PutSecretValue",
                "secretsmanager:TagResource",
                "secretsmanager:UntagResource",
                "secretsmanager:UpdateSecret",
              ],
              Resource: `${secretArnPrefix}*`,
            },
          ],
        }),
      },
      { parent: this },
    );

    this.roleArn = role.arn;
    this.registerOutputs({ roleArn: this.roleArn });
  }
}
