import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { renderBootstrapScript } from "./bootstrap";

export type CarbonForgeRuntimeArgs = {
  amiId: pulumi.Input<string>;
  availabilityZone: pulumi.Input<string>;
  ghcrPullToken: pulumi.Input<string>;
  ghcrUsername: string;
  imageReference: string;
  instanceType: string;
  licenseKey: pulumi.Input<string>;
  modelName: string;
  modelRevision: string;
  region: string;
  rootVolumeSizeGiB: number;
  runtimePort: number;
  scheduler: string;
  maxModelLength: number;
  tensorParallelSize: number;
  gpuMemoryUtilization: number;
  maxConcurrentSequences: number;
  trustRemoteCode: boolean;
  languageModelOnly: boolean;
  reasoningParser: string;
  enableAutoToolChoice: boolean;
  toolCallParser: string;
  requestTraceMode: "disabled";
  subnetId: pulumi.Input<string>;
  vpcId: pulumi.Input<string>;
};

export class CarbonForgeRuntime extends pulumi.ComponentResource {
  public readonly healthUrl: pulumi.Output<string>;
  public readonly instanceId: pulumi.Output<string>;
  public readonly openAiBaseUrl: pulumi.Output<string>;
  public readonly privateIp: pulumi.Output<string>;
  public readonly securityGroupId: pulumi.Output<string>;

  constructor(
    name: string,
    args: CarbonForgeRuntimeArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("jetscale:carbonforge:Runtime", name, {}, opts);

    const tags = {
      Environment: pulumi.getStack(),
      ManagedBy: "Pulumi",
      Owner: "global-services-platform",
      Project: pulumi.getProject(),
      Purpose: "carbonforge-inference-poc",
    };

    const ghcrTokenSecret = new aws.secretsmanager.Secret(
      `${name}-ghcr-token`,
      {
        name: `${pulumi.getProject()}/${pulumi.getStack()}/ghcr-pull-token`,
        description:
          "Read-only GHCR token for the CarbonForge evaluation image",
        recoveryWindowInDays: 7,
        tags,
      },
      { parent: this },
    );
    const ghcrTokenVersion = new aws.secretsmanager.SecretVersion(
      `${name}-ghcr-token-version`,
      {
        secretId: ghcrTokenSecret.id,
        secretString: args.ghcrPullToken,
      },
      { parent: this },
    );

    const licenseSecret = new aws.secretsmanager.Secret(
      `${name}-license`,
      {
        name: `${pulumi.getProject()}/${pulumi.getStack()}/license-key`,
        description: "CarbonForge evaluation licence",
        recoveryWindowInDays: 7,
        tags,
      },
      { parent: this },
    );
    const licenseVersion = new aws.secretsmanager.SecretVersion(
      `${name}-license-version`,
      {
        secretId: licenseSecret.id,
        secretString: args.licenseKey,
      },
      { parent: this },
    );

    const instanceRole = new aws.iam.Role(
      `${name}-instance-role`,
      {
        name: `${pulumi.getProject()}-${pulumi.getStack()}-instance`,
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "ec2.amazonaws.com",
        }),
        tags,
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${name}-ssm`,
      {
        role: instanceRole.name,
        policyArn: aws.iam.ManagedPolicy.AmazonSSMManagedInstanceCore,
      },
      { parent: this },
    );

    new aws.iam.RolePolicy(
      `${name}-runtime-secrets`,
      {
        role: instanceRole.id,
        policy: pulumi
          .all([ghcrTokenSecret.arn, licenseSecret.arn])
          .apply(([ghcrTokenArn, licenseArn]) =>
            JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: "secretsmanager:GetSecretValue",
                  Resource: [ghcrTokenArn, licenseArn],
                },
              ],
            }),
          ),
      },
      { parent: this },
    );

    const instanceProfile = new aws.iam.InstanceProfile(
      `${name}-instance-profile`,
      {
        name: `${pulumi.getProject()}-${pulumi.getStack()}-instance`,
        role: instanceRole.name,
      },
      { parent: this },
    );

    const securityGroup = new aws.ec2.SecurityGroup(
      `${name}-sg`,
      {
        name: `${pulumi.getProject()}-${pulumi.getStack()}-runtime`,
        description:
          "CarbonForge runtime; ingress is owned by authorized consumers",
        vpcId: args.vpcId,
        tags,
      },
      { parent: this },
    );

    new aws.vpc.SecurityGroupEgressRule(
      `${name}-egress-ipv4`,
      {
        securityGroupId: securityGroup.id,
        ipProtocol: "-1",
        cidrIpv4: "0.0.0.0/0",
        description:
          "Bootstrap, registry, model, and AWS service access through private subnet egress",
        tags,
      },
      { parent: this },
    );

    const userData = pulumi
      .all([
        ghcrTokenSecret.arn,
        ghcrTokenVersion.versionId,
        licenseSecret.arn,
        licenseVersion.versionId,
      ])
      .apply(
        ([
          ghcrTokenSecretArn,
          ghcrTokenVersionId,
          licenseSecretArn,
          licenseVersionId,
        ]) =>
          renderBootstrapScript({
            region: args.region,
            imageReference: args.imageReference,
            modelName: args.modelName,
            modelRevision: args.modelRevision,
            scheduler: args.scheduler,
            runtimePort: args.runtimePort,
            maxModelLength: args.maxModelLength,
            tensorParallelSize: args.tensorParallelSize,
            gpuMemoryUtilization: args.gpuMemoryUtilization,
            maxConcurrentSequences: args.maxConcurrentSequences,
            trustRemoteCode: args.trustRemoteCode,
            languageModelOnly: args.languageModelOnly,
            reasoningParser: args.reasoningParser,
            enableAutoToolChoice: args.enableAutoToolChoice,
            toolCallParser: args.toolCallParser,
            requestTraceMode: args.requestTraceMode,
            ghcrUsername: args.ghcrUsername,
            ghcrTokenSecretArn,
            ghcrTokenVersionId,
            licenseSecretArn,
            licenseVersionId,
          }),
      );

    const instance = new aws.ec2.Instance(
      `${name}-instance`,
      {
        ami: args.amiId,
        availabilityZone: args.availabilityZone,
        instanceType: args.instanceType,
        subnetId: args.subnetId,
        associatePublicIpAddress: false,
        vpcSecurityGroupIds: [securityGroup.id],
        iamInstanceProfile: instanceProfile.name,
        ebsOptimized: true,
        monitoring: true,
        metadataOptions: {
          httpEndpoint: "enabled",
          httpTokens: "required",
          httpPutResponseHopLimit: 1,
          instanceMetadataTags: "disabled",
        },
        rootBlockDevice: {
          encrypted: true,
          volumeType: "gp3",
          volumeSize: args.rootVolumeSizeGiB,
          deleteOnTermination: true,
          tags,
        },
        userData,
        userDataReplaceOnChange: true,
        tags: { ...tags, Name: `${pulumi.getProject()}-${pulumi.getStack()}` },
      },
      {
        parent: this,
        dependsOn: [ghcrTokenVersion, licenseVersion],
        customTimeouts: {
          create: "3m",
        },
      },
    );

    this.instanceId = instance.id;
    this.privateIp = instance.privateIp;
    this.securityGroupId = securityGroup.id;
    this.openAiBaseUrl = pulumi.interpolate`http://${instance.privateIp}:${args.runtimePort}/v1`;
    this.healthUrl = pulumi.interpolate`${this.openAiBaseUrl}/models`;

    this.registerOutputs({
      healthUrl: this.healthUrl,
      instanceId: this.instanceId,
      openAiBaseUrl: this.openAiBaseUrl,
      privateIp: this.privateIp,
      securityGroupId: this.securityGroupId,
    });
  }
}
