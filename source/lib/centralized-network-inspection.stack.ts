/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Aws,
  CfnCondition,
  CfnMapping,
  CfnOutput,
  CfnParameter,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { BuildEnvironmentVariableType, BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { CfnRepository, Repository } from 'aws-cdk-lib/aws-codecommit';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, CodeCommitSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import {
  CfnFlowLog,
  CfnRoute,
  CfnRouteTable,
  CfnSubnet,
  CfnSubnetRouteTableAssociation,
  CfnTransitGatewayAttachment,
  CfnTransitGatewayRoute,
  CfnTransitGatewayRouteTableAssociation,
  CfnVPC,
} from 'aws-cdk-lib/aws-ec2';
import { AnyPrincipal, CfnPolicy, Effect, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CfnAlias, CfnKey, Key } from 'aws-cdk-lib/aws-kms';
import { CfnLogGroup } from 'aws-cdk-lib/aws-logs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  BucketPolicy,
  CfnBucket,
  CfnBucketPolicy,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CentralizedNetworkInspectionStackProps extends StackProps {
  solutionId: string;
  solutionTradeMarkName: string | undefined;
  solutionProvider: string | undefined;
  solutionBucket: string | undefined;
  solutionName: string | undefined;
  solutionVersion: string | undefined;
}

export class CentralizedNetworkInspectionStack extends Stack {
  constructor(scope: Construct, id: string, props: CentralizedNetworkInspectionStackProps) {
    super(scope, id, props);

    /**
     * Parameters - Values to pass to your template at runtime
     */

    const cidrBlock = new CfnParameter(this, 'cidrBlock', {
      type: 'String',
      default: '192.168.1.0/26', //NOSONAR
      description: 'CIDR Block for VPC. Must be /26 or larger CIDR block.',
      allowedPattern: '^(?:[0-9]{1,3}.){3}[0-9]{1,3}[/]([0-9]?[0-6]?|[1][7-9])$',
    });

    const logRetentionPeriod = new CfnParameter(this, 'LogRetentionPeriod', {
      type: 'Number',
      description: 'Log retention period in days.',
      allowedValues: [
        '1',
        '3',
        '5',
        '7',
        '14',
        '30',
        '60',
        '90',
        '120',
        '150',
        '180',
        '365',
        '400',
        '545',
        '731',
        '1827',
        '3653',
      ],
      default: 90,
    });

    const existingTransitGatewayId = new CfnParameter(this, 'ExistingTransitGateway', {
      description: 'Existing AWS Transit Gateway id.',
      type: 'String',
      default: '',
    });

    const transitGatewayRTIdForAssociation = new CfnParameter(this, 'TransitGatewayRouteTableIdForAssociation', {
      description:
        'Existing AWS Transit Gateway route table id. Example:' + ' Firewall Route Table. Format: tgw-rtb-0a1b2c3d',
      type: 'String',
      default: '',
    });

    const transitGatewayRTIdForDefaultRoute = new CfnParameter(this, 'TransitGatewayRTIdForDefaultRoute', {
      description:
        'Existing AWS Transit Gateway route table id.' + ' Example: Spoke VPC Route Table. Format: tgw-rtb-4e5f6g7h',
      type: 'String',
      default: '',
    });

    const logType = new CfnParameter(this, 'logType', {
      type: 'String',
      description:
        'The type of log to send. Alert logs report traffic that' +
        ' matches a StatefulRule with an action setting that sends an alert' +
        ' log message. Flow logs are standard network traffic flow logs.',
      allowedValues: ['ALERT', 'FLOW', 'EnableBoth'],
      default: 'FLOW',
    });

    const logDestinationType = new CfnParameter(this, 'logDestinationType', {
      type: 'String',
      description:
        'The type of storage destination to send these logs to.' +
        ' You can send logs to an Amazon S3 bucket ' +
        'or a CloudWatch log group.',
      allowedValues: ['S3', 'CloudWatchLogs', 'ConfigureManually'],
      default: 'CloudWatchLogs',
    });

    /**
     * Metadata - Objects that provide additional information about the
     * template.
     */

    this.templateOptions.metadata = {
      'AWS::CloudFormation::Interface': {
        ParameterGroups: [
          {
            Label: { default: 'VPC Configuration' },
            Parameters: [cidrBlock.logicalId],
          },
          {
            Label: { default: 'Transit Gateway Configuration' },
            Parameters: [
              existingTransitGatewayId.logicalId,
              transitGatewayRTIdForAssociation.logicalId,
              transitGatewayRTIdForDefaultRoute.logicalId,
            ],
          },
          {
            Label: { default: 'Firewall Logging Configuration' },
            Parameters: [logDestinationType.logicalId, logType.logicalId, logRetentionPeriod.logicalId],
          },
        ],
        ParameterLabels: {
          [cidrBlock.logicalId]: {
            default: 'Provide the CIDR block for the Inspection VPC',
          },
          [existingTransitGatewayId.logicalId]: {
            default: 'Provide the existing AWS Transit Gateway ID you wish to attach to the Inspection VPC',
          },
          [transitGatewayRTIdForAssociation.logicalId]: {
            default: 'Provide AWS Transit Gateway Route Table to be associated with the Inspection VPC TGW Attachment.',
          },
          [transitGatewayRTIdForDefaultRoute.logicalId]: {
            default:
              'Provide the AWS Transit Gateway Route Table to receive 0.0.0.0/0 route to the Inspection VPC TGW Attachment.',
          },
          [logType.logicalId]: {
            default: 'Select the type of log to send to the defined log destination.',
          },
          [logDestinationType.logicalId]: {
            default: 'Select the type of log destination for the Network Firewall',
          },
          [logRetentionPeriod.logicalId]: {
            default: 'Select the log retention period for Network Firewall Logs.',
          },
        },
      },
    };

    /**
     * Mappings - define fixed values
     */
    const mappings = new CfnMapping(this, 'SolutionMapping');
    mappings.setValue('Route', 'QuadZero', '0.0.0.0/0');
    mappings.setValue('Log', 'Level', 'info');
    mappings.setValue('CodeCommitRepo', 'Name', 'centralized-network-inspection-config-repo-');
    mappings.setValue('Metrics', 'URL', 'https://metrics.awssolutionsbuilder.com/generic');
    mappings.setValue('Solution', 'Identifier', props.solutionId);
    mappings.setValue('Solution', 'Version', props.solutionVersion);
    mappings.setValue('TransitGatewayAttachment', 'ApplianceMode', 'enable');
    mappings.setValue('ParameterKey', 'UniqueId', `Solutions/${props.solutionName}/UUID`);

    const sendAnonymizedData = new CfnMapping(this, 'AnonymizedData');
    sendAnonymizedData.setValue('SendAnonymizedData', 'Data', 'Yes');

    /**
     * Conditions - control whether certain resources are created or whether
     * certain resource properties are assigned a value during stack
     * creation or update.
     */

    const isLoggingInS3 = new CfnCondition(this, 'LoggingInS3', {
      expression: Fn.conditionEquals(logDestinationType.valueAsString, 'S3'),
    });

    const isLoggingInCloudWatch = new CfnCondition(this, 'LoggingInCloudWatch', {
      expression: Fn.conditionEquals(logDestinationType.valueAsString, 'CloudWatchLogs'),
    });

    const isNotLoggingConfigureManually = new CfnCondition(this, 'NotLoggingConfigureManually', {
      expression: Fn.conditionNot(Fn.conditionEquals(logDestinationType.valueAsString, 'ConfigureManually')),
    });

    /**
     * condition to determine if transit gateway id is provided or not if
     * provided use it to create transit gateway attachment else skip
     */

    const createTransitGatewayAttachment = new CfnCondition(this, 'CreateTransitGatewayAttachment', {
      expression: Fn.conditionNot(Fn.conditionEquals(existingTransitGatewayId.valueAsString, '')),
    });

    /**
     * condition to determine if transit gateway route table id is provided or
     * not. if provided use it to create route table association else skip
     */
    const createTransitGatewayRTAssociation = new CfnCondition(this, 'CreateTransitGatewayRTAssociation', {
      expression: Fn.conditionAnd(
        Fn.conditionNot(Fn.conditionEquals(transitGatewayRTIdForAssociation.valueAsString, '')),
        createTransitGatewayAttachment
      ),
    });

    /**
     * condition to determine if transit gateway route table id is provided or
     * not. if provided use it to create route table propagation else skip
     */
    const createDefaultRouteFirewallRT = new CfnCondition(this, 'CreateDefaultRouteFirewallRT', {
      expression: Fn.conditionAnd(
        Fn.conditionNot(Fn.conditionEquals(transitGatewayRTIdForDefaultRoute.valueAsString, '')),
        createTransitGatewayAttachment
      ),
    });

    /**
     * Resources - Specifies the stack resources and their properties
     */

    this.templateOptions.templateFormatVersion = '2010-09-09';

    // Create a new VPC

    const vpc = new CfnVPC(this, 'VPC', {
      cidrBlock: cidrBlock.valueAsString,
    });

    //KMS Key for the VPC Flow logs and Firewall Logs
    const KMSKeyForNetworkFirewallBuckets = new Key(this, 'KMSKeyForNetworkFirewallBuckets', {
      description: 'This key will be used for encrypting the vpc flow logs and firewall logs.',
      enableKeyRotation: true,
    });

    //Permissions for network firewall service to be able use this key for publishing logs to
    KMSKeyForNetworkFirewallBuckets.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        principals: [new ServicePrincipal('delivery.logs.amazonaws.com')],
        actions: ['kms:GenerateDataKey*'],
      })
    );
    //Permissions for network firewall service to be able use this key for publishing logs to cloudwatch.
    KMSKeyForNetworkFirewallBuckets.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new ServicePrincipal(`logs.${Aws.REGION}.amazonaws.com`)],
      })
    );

    // Create a new log group for Firewall logging
    const cloudWatchLogGroup = new CfnLogGroup(this, 'CloudWatchLogGroup', {
      retentionInDays: logRetentionPeriod.valueAsNumber,
      kmsKeyId: KMSKeyForNetworkFirewallBuckets.keyArn,
    });

    cloudWatchLogGroup.cfnOptions.condition = isLoggingInCloudWatch;

    // enforceSSL cannot be set to true for this resource, as the bucket is conditional and that condition is not passed to the created policy.
    // we add a manual policy to enforce SSL later in the stack
    // prettier-ignore
    const logsBucket = new Bucket(this, 'Logs', { //NOSONAR
      encryption: BucketEncryption.KMS,
      encryptionKey: KMSKeyForNetworkFirewallBuckets,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          expiration: Duration.days(logRetentionPeriod.valueAsNumber),
        },
      ],
    });

    const cfnLogsBucket = logsBucket.node.defaultChild as CfnBucket;
    cfnLogsBucket.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W35',
            reason: 'Logs bucket does not require logging configuration',
          },
          {
            id: 'W51',
            reason: 'Logs bucket is private and does not require a bucket policy',
          },
        ],
      },
    };
    cfnLogsBucket.cfnOptions.condition = isLoggingInS3;

    //Solution Logging Changes stop.

    vpc.applyRemovalPolicy(RemovalPolicy.RETAIN);
    vpc.tags.setTag('Name', `${Aws.STACK_NAME}-Inspection-VPC`);
    vpc.tags.setTag('created-by', `${props.solutionName}`);

    const cidrCount = 4;
    const cidrBits = '4';
    const availabilityZoneA = {
      'Fn::Select': [
        '0',
        {
          'Fn::GetAZs': '',
        },
      ],
    };
    const availabilityZoneB = {
      'Fn::Select': [
        '1',
        {
          'Fn::GetAZs': '',
        },
      ],
    };

    // Create Firewall Subnet 1
    const NetworkFirewallSubnet1 = new CfnSubnet(this, 'NetworkFirewallSubnet1', {
      vpcId: vpc.ref,
      cidrBlock: Fn.select(0, Fn.cidr(vpc.attrCidrBlock, cidrCount, cidrBits)),
    });
    NetworkFirewallSubnet1.tags.setTag('Name', `${Aws.STACK_NAME}-FirewallSubnet1`);
    NetworkFirewallSubnet1.applyRemovalPolicy(RemovalPolicy.RETAIN);
    NetworkFirewallSubnet1.addPropertyOverride('AvailabilityZone', availabilityZoneA);

    // Create Firewall Subnet 2
    const NetworkFirewallSubnet2 = new CfnSubnet(this, 'NetworkFirewallSubnet2', {
      vpcId: vpc.ref,
      cidrBlock: Fn.select(1, Fn.cidr(vpc.attrCidrBlock, cidrCount, cidrBits)),
    });

    NetworkFirewallSubnet2.tags.setTag('Name', `${Aws.STACK_NAME}-FirewallSubnet2`);
    NetworkFirewallSubnet2.applyRemovalPolicy(RemovalPolicy.RETAIN);
    NetworkFirewallSubnet2.addPropertyOverride('AvailabilityZone', availabilityZoneB);

    //Subnet Route Tables.
    const firewallSubnetRouteTable = new CfnRouteTable(this, 'FirewallSubnetRouteTable', {
      vpcId: vpc.ref,
    });
    firewallSubnetRouteTable.tags.setTag('Name', `${Aws.STACK_NAME}-FirewallSubnetRouteTable`);
    firewallSubnetRouteTable.applyRemovalPolicy(RemovalPolicy.RETAIN);

    //Subnet Route Table Associations.
    const NetworkFirewallSubnet1RouteTableAssociation = new CfnSubnetRouteTableAssociation(
      this,
      'NetworkFirewallSubnet1RouteTableAssociation',
      {
        subnetId: NetworkFirewallSubnet1.ref,
        routeTableId: firewallSubnetRouteTable.ref,
      }
    );
    NetworkFirewallSubnet1RouteTableAssociation.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const NetworkFirewallSubnet2RouteTableAssociation = new CfnSubnetRouteTableAssociation(
      this,
      'NetworkFirewallSubnet2RouteTableAssociation',
      {
        subnetId: NetworkFirewallSubnet2.ref,
        routeTableId: firewallSubnetRouteTable.ref,
      }
    );
    NetworkFirewallSubnet2RouteTableAssociation.applyRemovalPolicy(RemovalPolicy.RETAIN);

    // Create Transit Gateway Subnet 1
    const vpcTGWSubnet1 = new CfnSubnet(this, 'VPCTGWSubnet1', {
      vpcId: vpc.ref,
      cidrBlock: Fn.select(2, Fn.cidr(vpc.attrCidrBlock, cidrCount, cidrBits)),
    });
    vpcTGWSubnet1.tags.setTag('Name', `${Aws.STACK_NAME}-VPCTGWSubnet1`);
    vpcTGWSubnet1.applyRemovalPolicy(RemovalPolicy.RETAIN);
    vpcTGWSubnet1.addPropertyOverride('AvailabilityZone', availabilityZoneA);

    // Create Transit Gateway Subnet 2
    const vpcTGWSubnet2 = new CfnSubnet(this, 'VPCTGWSubnet2', {
      vpcId: vpc.ref,
      cidrBlock: Fn.select(3, Fn.cidr(vpc.attrCidrBlock, cidrCount, cidrBits)),
    });
    vpcTGWSubnet2.tags.setTag('Name', `${Aws.STACK_NAME}-VPCTGWSubnet2`);
    vpcTGWSubnet2.applyRemovalPolicy(RemovalPolicy.RETAIN);
    vpcTGWSubnet2.addPropertyOverride('AvailabilityZone', availabilityZoneB);

    //Route Tables for VPC Transit Gateway subnets.
    const vpcTGWRouteTable1 = new CfnRouteTable(this, 'VPCTGWRouteTable1', {
      vpcId: vpc.ref,
    });
    vpcTGWRouteTable1.tags.setTag('Name', `${Aws.STACK_NAME}-TGWSubnetRouteTable1`);
    vpcTGWRouteTable1.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const vpcTGWRouteTable2 = new CfnRouteTable(this, 'VPCTGWRouteTable2', {
      vpcId: vpc.ref,
    });
    vpcTGWRouteTable2.tags.setTag('Name', `${Aws.STACK_NAME}-TGWSubnetRouteTable2`);
    vpcTGWRouteTable2.applyRemovalPolicy(RemovalPolicy.RETAIN);

    //Subnet Route Table Associations for Transit Gateway Subnets
    const vpcTGWSubnet1RouteTableAssociation = new CfnSubnetRouteTableAssociation(
      this,
      'VPCTGWSubnet1RouteTableAssociation',
      {
        subnetId: vpcTGWSubnet1.ref,
        routeTableId: vpcTGWRouteTable1.ref,
      }
    );
    vpcTGWSubnet1RouteTableAssociation.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const vpcTGWSubnet2RouteTableAssociation = new CfnSubnetRouteTableAssociation(
      this,
      'VPCTGWSubnet2RouteTableAssociation',
      {
        subnetId: vpcTGWSubnet2.ref,
        routeTableId: vpcTGWRouteTable2.ref,
      }
    );
    vpcTGWSubnet2RouteTableAssociation.applyRemovalPolicy(RemovalPolicy.RETAIN);

    //VPC Flow Log
    const logGroup = new CfnLogGroup(this, 'LogGroupFlowLogs', {
      retentionInDays: logRetentionPeriod.valueAsNumber,
      logGroupName: Aws.STACK_NAME,
      kmsKeyId: KMSKeyForNetworkFirewallBuckets.keyArn,
    });

    const flowLogRole = new Role(this, 'RoleFlowLogs', {
      assumedBy: new ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    const policyStatement = new PolicyStatement({
      actions: [
        'logs:CreateLogStream',
        'logs:DescribeLogStreams',
        'logs:PutLogEvents',
        'logs:CreateLogGroup',
        'logs:DescribeLogGroups',
      ],
      resources: [logGroup.attrArn],
    });
    policyStatement.effect = Effect.ALLOW;
    flowLogRole.addToPolicy(policyStatement);

    new CfnFlowLog(this, 'FlowLog', {
      deliverLogsPermissionArn: flowLogRole.roleArn,
      logGroupName: logGroup.logGroupName,
      resourceId: vpc.ref,
      resourceType: 'VPC',
      trafficType: 'ALL',
    });

    //Start: associate for an existing transit gateway if user provides one.

    //Transit gateway attachment.
    const vpcTGWAttachment = new CfnTransitGatewayAttachment(this, 'VPC_TGW_ATTACHMENT', {
      transitGatewayId: existingTransitGatewayId.valueAsString,
      vpcId: vpc.ref,
      subnetIds: [vpcTGWSubnet1.ref, vpcTGWSubnet2.ref],
    });
    vpcTGWAttachment.cfnOptions.condition = createTransitGatewayAttachment;
    vpcTGWAttachment.tags.setTag('Name', `${Aws.STACK_NAME}-Inspection-VPC-Attachment`);
    vpcTGWAttachment.applyRemovalPolicy(RemovalPolicy.RETAIN);
    vpcTGWAttachment.addDeletionOverride('UpdateReplacePolicy');

    //add the transit gateway id provided by the user to the firewall route
    // table created for transit gateway interaction.
    const defaultTransitGatewayRoute = new CfnRoute(this, 'TGWRoute', {
      routeTableId: firewallSubnetRouteTable.ref,
      destinationCidrBlock: mappings.findInMap('Route', 'QuadZero'),
      transitGatewayId: existingTransitGatewayId.valueAsString,
    });
    defaultTransitGatewayRoute.cfnOptions.condition = createTransitGatewayAttachment;
    defaultTransitGatewayRoute.addDependsOn(vpcTGWAttachment);

    //Transit Gateway association with the TGW route table id provided by the user.
    const tgwRouteTableAssociation = new CfnTransitGatewayRouteTableAssociation(this, 'VPCTGWRouteTableAssociation', {
      transitGatewayAttachmentId: vpcTGWAttachment.ref,
      transitGatewayRouteTableId: transitGatewayRTIdForAssociation.valueAsString,
    });

    //createTransitGatewayRTAssociation
    tgwRouteTableAssociation.cfnOptions.condition = createTransitGatewayRTAssociation;
    tgwRouteTableAssociation.addOverride('DeletionPolicy', 'Retain');
    tgwRouteTableAssociation.addDeletionOverride('UpdateReplacePolicy');

    // Add default route to Instection VPC-TGW Attachment in the Spoke VPC
    // Route Transit Gateway Route Table
    const defaultRouteSpokeVPCTGWRouteTable = new CfnTransitGatewayRoute(this, 'DefaultRouteSpokeVPCTGWRouteTable', {
      transitGatewayRouteTableId: transitGatewayRTIdForDefaultRoute.valueAsString,
      destinationCidrBlock: mappings.findInMap('Route', 'QuadZero'),
      transitGatewayAttachmentId: vpcTGWAttachment.ref,
    });
    defaultRouteSpokeVPCTGWRouteTable.cfnOptions.condition = createDefaultRouteFirewallRT;
    defaultRouteSpokeVPCTGWRouteTable.addOverride('DeletionPolicy', 'Retain');

    //End: Transit gateway changes.

    //CodeCommit Repo and Code Pipeline with default policy created.
    const codeCommitRepo = new Repository(this, 'NetworkFirewallCodeRepository', {
      repositoryName: mappings.findInMap('CodeCommitRepo', 'Name') + Aws.STACK_NAME,
      description:
        'This repository is created by the AWS Network Firewall' +
        ' solution for AWS Transit Gateway, to store and trigger changes to' +
        ' the network firewall rules and configurations.',
    });

    const codeCommitRepo_cfn_ref = codeCommitRepo.node.defaultChild as CfnRepository;
    codeCommitRepo_cfn_ref.addOverride('Properties.Code.S3.Bucket', `${props.solutionBucket}-${this.region}`);
    codeCommitRepo_cfn_ref.addOverride(
      'Properties.Code.S3.Key',
      `${props.solutionName}/%%VERSION%%/centralized-network-inspection-configuration.zip`
    );
    codeCommitRepo_cfn_ref.addOverride('DeletionPolicy', 'Retain');
    codeCommitRepo_cfn_ref.addOverride('UpdateReplacePolicy', 'Retain');

    // enforceSSL cannot be set to true for this resource, it will create deploy time errors.
    // we add a manual policy to enforce SSL later in the stack
    // prettier-ignore
    const codeBuildStagesSourceCodeBucket = new Bucket(this, 'CodeBuildStagesSourceCodeBucket', { //NOSONAR
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const sourceOutputArtifact = new Artifact('SourceArtifact');
    const buildOutputArtifact = new Artifact('BuildArtifact');

    const subnetIds = NetworkFirewallSubnet1.ref + ',' + NetworkFirewallSubnet2.ref;
    const codeBuildEnvVariables = {
      ['LOG_LEVEL']: {
        value: mappings.findInMap('Log', 'Level'),
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['VPC_ID']: {
        value: vpc.ref,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['SUBNET_IDS']: {
        value: subnetIds,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['LOG_TYPE']: {
        value: logType.valueAsString,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['LOG_DESTINATION_TYPE']: {
        value: logDestinationType.valueAsString,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['S3_LOG_BUCKET_NAME']: {
        value: Fn.conditionIf('LoggingInS3', logsBucket.bucketName, 'NotConfigured'),
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['CLOUDWATCH_LOG_GROUP_NAME']: {
        value: Fn.conditionIf('LoggingInCloudWatch', cloudWatchLogGroup.ref, 'NotConfigured'),
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['VPC_TGW_ATTACHMENT_AZ_1']: {
        value: Fn.getAtt('NetworkFirewallSubnet1', 'AvailabilityZone').toString(),
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['VPC_TGW_ATTACHMENT_AZ_2']: {
        value: Fn.getAtt('NetworkFirewallSubnet2', 'AvailabilityZone').toString(),
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['VPC_TGW_ATTACHMENT_ROUTE_TABLE_ID_1']: {
        value: vpcTGWRouteTable1.ref,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['VPC_TGW_ATTACHMENT_ROUTE_TABLE_ID_2']: {
        value: vpcTGWRouteTable2.ref,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['CODE_BUILD_SOURCE_CODE_S3_KEY']: {
        value: `${props.solutionName}/${props.solutionVersion}`,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['STACK_ID']: {
        value: `${Aws.STACK_ID}`,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['SSM_PARAM_FOR_UUID']: {
        value: `/${mappings.findInMap('ParameterKey', 'UniqueId')}`,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['SEND_ANONYMIZED_METRICS']: {
        value: `${sendAnonymizedData.findInMap('SendAnonymizedData', 'Data')}`,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['SOLUTION_ID']: {
        value: `${mappings.findInMap('Solution', 'Identifier')}`,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['METRICS_URL']: {
        value: `${mappings.findInMap('Metrics', 'URL')}`,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['TRANSIT_GATEWAY_ATTACHMENT_ID']: {
        value: Fn.conditionIf(createTransitGatewayAttachment.logicalId, vpcTGWAttachment.ref, ''),
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['TRANSIT_GATEWAY_ATTACHMENT_APPLIANCE_MODE']: {
        value: mappings.findInMap('TransitGatewayAttachment', 'ApplianceMode'),
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
      ['CUSTOM_SDK_USER_AGENT']: {
        value: `AwsSolution/${mappings.findInMap('Solution', 'Identifier')}/${mappings.findInMap(
          'Solution',
          'Version'
        )}`,
        type: BuildEnvironmentVariableType.PLAINTEXT,
      },
    };

    // Code build project, code build role will be created by the construct.
    const buildProject = new PipelineProject(this, 'BuildProject', {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '18',
            },
            commands: [`export current=$(pwd)`, `export sourceCodeKey=$CODE_BUILD_SOURCE_CODE_S3_KEY`],
          },
          pre_build: {
            commands: [
              `cd $current`,
              `pwd; ls -ltr`,
              `echo 'Download Centralized Network Inspection Solution Package'`,
              `aws s3 cp s3://${codeBuildStagesSourceCodeBucket.bucketName}/$sourceCodeKey/centralized-network-inspection.zip $current || true`,
              `if [ -f $current/centralized-network-inspection.zip ];then exit 0;else echo \"Copy file to s3 bucket\"; aws s3 cp s3://${props.solutionBucket}-${Aws.REGION}/$sourceCodeKey/centralized-network-inspection.zip s3://${codeBuildStagesSourceCodeBucket.bucketName}/$sourceCodeKey/centralized-network-inspection.zip --copy-props none; aws s3 cp s3://${codeBuildStagesSourceCodeBucket.bucketName}/$sourceCodeKey/centralized-network-inspection.zip $current; fi;`,
              `unzip -o $current/centralized-network-inspection.zip -d $current`,
              `pwd; ls -ltr`,
            ],
          },
          build: {
            commands: [`echo "Validating the firewall config"`, `node build.js`],
          },
        },
        artifacts: {
          files: '**/*',
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
      },
      environmentVariables: codeBuildEnvVariables,
    });

    const buildStageIAMPolicy = new Policy(this, 'buildStageIAMPolicy', {
      statements: [
        new PolicyStatement({
          actions: ['network-firewall:CreateFirewallPolicy', 'network-firewall:CreateRuleGroup'],
          resources: [
            Fn.sub('arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:stateful-rulegroup/*'),
            Fn.sub('arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:firewall-policy/*'),
            Fn.sub('arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:stateless-rulegroup/*'),
          ],
          effect: Effect.ALLOW,
        }),
        new PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [
            Fn.sub('arn:${AWS::Partition}:s3:::${CodeBucketName}/${KeyName}/*', {
              CodeBucketName: `${props.solutionBucket}-${this.region}`,
              KeyName: `${props.solutionName}`,
            }),
            `arn:${Aws.PARTITION}:s3:::${codeBuildStagesSourceCodeBucket.bucketName}/*`,
          ],
        }),
        new PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [`arn:${Aws.PARTITION}:s3:::${codeBuildStagesSourceCodeBucket.bucketName}/*`],
          effect: Effect.ALLOW,
        }),
        new PolicyStatement({
          actions: ['ssm:PutParameter', 'ssm:GetParameter'],
          effect: Effect.ALLOW,
          resources: [
            Fn.sub('arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter/${ParameterKey}-*', {
              ParameterKey: `${mappings.findInMap('ParameterKey', 'UniqueId')}`,
            }),
          ],
        }),
      ],
    });

    buildProject.role?.attachInlinePolicy(buildStageIAMPolicy);

    //IAM Policy and Role to execute deploy stage

    const deployStageFirewallPolicy = new Policy(this, 'deployStageFirewallPolicy', {
      statements: [
        new PolicyStatement({
          actions: [
            'network-firewall:CreateFirewall',
            'network-firewall:UpdateFirewallDeleteProtection',
            'network-firewall:DeleteRuleGroup',
            'network-firewall:DescribeLoggingConfiguration',
            'network-firewall:UpdateFirewallDescription',
            'network-firewall:CreateRuleGroup',
            'network-firewall:DescribeFirewall',
            'network-firewall:DeleteFirewallPolicy',
            'network-firewall:UpdateRuleGroup',
            'network-firewall:DescribeRuleGroup',
            'network-firewall:ListRuleGroups',
            'network-firewall:UpdateSubnetChangeProtection',
            'network-firewall:UpdateFirewallPolicyChangeProtection',
            'network-firewall:AssociateFirewallPolicy',
            'network-firewall:DescribeFirewallPolicy',
            'network-firewall:UpdateFirewallPolicy',
            'network-firewall:DescribeResourcePolicy',
            'network-firewall:CreateFirewallPolicy',
            'network-firewall:UpdateLoggingConfiguration',
            'network-firewall:TagResource',
          ],
          resources: [
            Fn.sub('arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:stateful-rulegroup/*'),
            Fn.sub('arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:firewall-policy/*'),
            Fn.sub('arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:firewall/*'),
            Fn.sub('arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:stateless-rulegroup/*'),
          ],
        }),
        new PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [
            Fn.sub('arn:${AWS::Partition}:s3:::${CodeBucketName}/${KeyName}/*', {
              CodeBucketName: `${props.solutionBucket}-${this.region}`,
              KeyName: `${props.solutionName}`,
            }),
            `arn:${Aws.PARTITION}:s3:::${codeBuildStagesSourceCodeBucket.bucketName}/*`,
          ],
        }),
        new PolicyStatement({
          actions: ['ec2:DescribeVpcs', 'ec2:DescribeSubnets', 'ec2:DescribeRouteTables'],
          resources: ['*'],
        }),
        new PolicyStatement({
          actions: ['ec2:CreateRoute', 'ec2:DeleteRoute'],
          effect: Effect.ALLOW,
          resources: [
            `arn:${Aws.PARTITION}:ec2:${Aws.REGION}:${Aws.ACCOUNT_ID}:route-table/${vpcTGWRouteTable1.ref}`,
            `arn:${Aws.PARTITION}:ec2:${Aws.REGION}:${Aws.ACCOUNT_ID}:route-table/${vpcTGWRouteTable2.ref}`,
          ],
        }),
        new PolicyStatement({
          actions: ['iam:CreateServiceLinkedRole'],
          resources: [
            Fn.sub(
              'arn:aws:iam::${AWS::AccountId}:role/aws-service-role/network-firewall.amazonaws.com/AWSServiceRoleForNetworkFirewall'
            ),
          ],
        }),
      ],
    });

    const deployStageFirewallPolicyResource = deployStageFirewallPolicy.node.findChild('Resource') as CfnPolicy;

    deployStageFirewallPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W12',
            reason: 'Resource * is required for describe APIs',
          },
        ],
      },
    };

    //add modify transit gateway attachement permission only if the transit gateway attachment is provided.
    const deployStageModifyTransitGatewayAttachmentPolicy = new Policy(
      this,
      'deployStageModifyTransitGatewayAttachmentPolicy',
      {
        statements: [
          new PolicyStatement({
            actions: ['ec2:ModifyTransitGatewayVpcAttachment'],
            effect: Effect.ALLOW,
            resources: [
              `arn:${Aws.PARTITION}:ec2:${Aws.REGION}:${Aws.ACCOUNT_ID}:transit-gateway-attachment/${vpcTGWAttachment.ref}`,
            ],
          }),
        ],
      }
    );
    const resourcePolicyModifyTGWAttachment = deployStageModifyTransitGatewayAttachmentPolicy.node.findChild(
      'Resource'
    ) as CfnPolicy;
    resourcePolicyModifyTGWAttachment.cfnOptions.condition = createTransitGatewayAttachment;

    const deployStageFirewallLoggingPolicy = new Policy(this, 'deployStageFirewallLoggingPolicy', {
      statements: [
        new PolicyStatement({
          actions: [
            'logs:CreateLogDelivery',
            'logs:GetLogDelivery',
            'logs:UpdateLogDelivery',
            'logs:DeleteLogDelivery',
            'logs:ListLogDeliveries',
          ],
          resources: ['*'], // Per IAM service must use All Resources
        }),
      ],
    });

    const deployStageFirewallLoggingResource = deployStageFirewallLoggingPolicy.node.findChild('Resource') as CfnPolicy;

    deployStageFirewallLoggingResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W12',
            reason: 'Resource * is required for these actions.',
          },
        ],
      },
    };

    // skip creating the 'deployStageFirewallLoggingPolicy' IAM policy if
    // logging destination type is set to configure manually
    deployStageFirewallLoggingResource.cfnOptions.condition = isNotLoggingConfigureManually;

    const deployStageFirewallLoggingS3Policy = new Policy(this, 'deployStageFirewallLoggingS3Policy', {
      statements: [
        new PolicyStatement({
          actions: ['s3:PutBucketPolicy', 's3:GetBucketPolicy'],
          resources: [logsBucket.bucketArn],
        }),
      ],
    });

    const deployStageFirewallLoggingS3PolicyResource = deployStageFirewallLoggingS3Policy.node.findChild(
      'Resource'
    ) as CfnPolicy;

    // create the 'deployStageFirewallLoggingS3Policy' IAM policy only if
    // logging destination type is set to S3
    deployStageFirewallLoggingS3PolicyResource.cfnOptions.condition = isLoggingInS3;

    const deployStageFirewallLoggingCWPolicy = new Policy(this, 'deployStageFirewallLoggingCWPolicy', {
      statements: [
        new PolicyStatement({
          actions: ['logs:PutResourcePolicy', 'logs:DescribeResourcePolicies'],
          resources: ['*'], // Per IAM service must use All Resources
        }),
        new PolicyStatement({
          actions: ['logs:DescribeLogGroups'],
          resources: [Fn.sub('arn:${AWS::Partition}:logs:*:${AWS::AccountId}:log-group:*')],
        }),
      ],
    });

    const deployStageFirewallLoggingCWPolicyResource = deployStageFirewallLoggingCWPolicy.node.findChild(
      'Resource'
    ) as CfnPolicy;

    deployStageFirewallLoggingCWPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W12',
            reason: 'Resource * is required for describe APIs',
          },
        ],
      },
    };

    // create the 'deployStageFirewallLoggingCWPolicy' IAM policy if
    // logging destination type is set to CloudWatch Logs
    deployStageFirewallLoggingCWPolicyResource.cfnOptions.condition = isLoggingInCloudWatch;

    // Code deploy build action project, role will be created by the construct.

    const deployProject = new PipelineProject(this, 'DeployProject', {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '18',
            },
            commands: [`export current=$(pwd)`, `export sourceCodeKey=$CODE_BUILD_SOURCE_CODE_S3_KEY`],
          },
          pre_build: {
            commands: [
              `cd $current`,
              `pwd; ls -ltr`,
              `echo 'Download Centralized Network Inspection Solution Package'`,
              `aws s3 cp s3://${codeBuildStagesSourceCodeBucket.bucketName}/$sourceCodeKey/centralized-network-inspection.zip $current`,
              `unzip -o $current/centralized-network-inspection.zip -d $current`,
              `pwd; ls -ltr`,
            ],
          },
          build: {
            commands: [`echo "Initiating Network Firewall Automation"`, `node index.js`],
          },
          post_build: {
            commands: [],
          },
        },
        artifacts: {
          files: '**/*',
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
      },
      environmentVariables: codeBuildEnvVariables,
    });

    // attach inline IAM policies with the default CodeBuild role.
    deployProject.role?.attachInlinePolicy(deployStageFirewallPolicy);
    deployProject.role?.attachInlinePolicy(deployStageFirewallLoggingPolicy);
    deployProject.role?.attachInlinePolicy(deployStageFirewallLoggingS3Policy);
    deployProject.role?.attachInlinePolicy(deployStageFirewallLoggingCWPolicy);
    deployProject.role?.attachInlinePolicy(deployStageModifyTransitGatewayAttachmentPolicy);

    const codePipeline = new Pipeline(this, `CentralizedNetworkInspectionCodePipeline`, {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new CodeCommitSourceAction({
              actionName: 'Source',
              repository: codeCommitRepo,
              branch: 'main',
              output: sourceOutputArtifact,
            }),
          ],
        },
        {
          stageName: 'Validation',
          actions: [
            new CodeBuildAction({
              actionName: 'CodeBuild',
              input: sourceOutputArtifact,
              project: buildProject,
              outputs: [buildOutputArtifact],
            }),
          ],
        },
        {
          stageName: 'Deployment',
          actions: [
            new CodeBuildAction({
              actionName: 'CodeDeploy',
              input: buildOutputArtifact,
              project: deployProject,
            }),
          ],
        },
      ],
    });

    //Adding bucket encryption
    const kmsKeyCfn_ref = codePipeline.artifactBucket.encryptionKey?.node.defaultChild as CfnKey;
    kmsKeyCfn_ref.addPropertyOverride('EnableKeyRotation', true);

    const stack = Stack.of(this);

    const codePipelineArtifactBucketKmsKeyAlias = stack.node
      .findChild('CentralizedNetworkInspectionCodePipeline')
      .node.findChild('ArtifactsBucketEncryptionKeyAlias').node.defaultChild as CfnAlias;
    codePipelineArtifactBucketKmsKeyAlias.addPropertyOverride('AliasName', {
      'Fn::Join': [
        '',
        [
          'alias/',
          {
            Ref: 'AWS::StackName',
          },
          '-artifactBucket-EncryptionKeyAlias',
        ],
      ],
    });

    const codeBuildStagesSourceCodeBucket_cfn_ref = codeBuildStagesSourceCodeBucket.node.defaultChild as CfnBucket;
    codeBuildStagesSourceCodeBucket_cfn_ref.bucketEncryption = {
      serverSideEncryptionConfiguration: [
        {
          serverSideEncryptionByDefault: {
            kmsMasterKeyId: codePipeline.artifactBucket.encryptionKey?.keyArn,
            sseAlgorithm: 'aws:kms',
          },
        },
      ],
    };

    codeBuildStagesSourceCodeBucket_cfn_ref.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W35',
            reason: 'Source Code bucket bucket does not require logging configuration',
          },
          {
            id: 'W51',
            reason: 'Source Code bucket is private and does not require a bucket policy',
          },
        ],
      },
    };

    const bucketPolicyForlogsBucket = new BucketPolicy(this, 'CloudWatchLogsForNetworkFirewallBucketPolicy', {
      bucket: logsBucket,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    bucketPolicyForlogsBucket.document.addStatements(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['s3:GetObject'],
        principals: [new AnyPrincipal()],
        resources: [`${logsBucket.bucketArn}/*`, `${logsBucket.bucketArn}`],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
      })
    );

    const bucketPolicyForlogsBucket_cfn_ref = bucketPolicyForlogsBucket.node.defaultChild as CfnBucketPolicy;
    bucketPolicyForlogsBucket_cfn_ref.cfnOptions.condition = isLoggingInS3;

    const bucketPolicyForSourceCodeBucket = new BucketPolicy(this, 'CodeBuildStageSourceCodeBucketPolicy', {
      bucket: codeBuildStagesSourceCodeBucket,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    bucketPolicyForSourceCodeBucket.document.addStatements(
      new PolicyStatement({
        effect: Effect.DENY,
        actions: ['s3:GetObject'],
        principals: [new AnyPrincipal()],
        resources: [`${codeBuildStagesSourceCodeBucket.bucketArn}`, `${codeBuildStagesSourceCodeBucket.bucketArn}/*`],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
      })
    );

    //disable W35 for the artifact bucket as it only store the artifact files.
    const w35Rule = {
      rules_to_suppress: [
        {
          id: 'W35',
          reason: "This S3 bucket is used as the destination for 'CentralizedNetworkInspectionCodePipelineArtifactsBucket'",
        },
      ],
    };
    const s3ArtifactBucket_cfn_ref = codePipeline.artifactBucket.node.defaultChild as CfnBucket;
    s3ArtifactBucket_cfn_ref.cfnOptions.metadata = {
      cfn_nag: w35Rule,
    };

    /**
     * Outputs - describes the values that are returned whenever you view
     * your stack's properties.
     */
    new CfnOutput(this, 'Inspection VPC ID', {
      value: vpc.ref,
      description: 'Inspection VPC ID to create Network Firewall.',
    });

    new CfnOutput(this, 'Firewall Subnet 1 ID', {
      value: NetworkFirewallSubnet1.ref,
      description: 'Subnet 1 associated with Network Firewall.',
    });

    new CfnOutput(this, 'Firewall Subnet 2 ID', {
      value: NetworkFirewallSubnet2.ref,
      description: 'Subnet 2 associated with Network Firewall.',
    });

    new CfnOutput(this, 'Transit Gateway Subnet 1 ID', {
      value: vpcTGWSubnet1.ref,
      description: 'Subnet 1 associated with Transit Gateway.',
    });

    new CfnOutput(this, 'Transit Gateway Subnet 2 ID', {
      value: vpcTGWSubnet2.ref,
      description: 'Subnet 1 associated with Transit Gateway.',
    });

    new CfnOutput(this, 'Network Firewall Availability Zone 1', {
      value: Fn.getAtt('NetworkFirewallSubnet1', 'AvailabilityZone').toString(),
      description: 'Availability Zone configured for Network Firewall subnet 1',
    });

    new CfnOutput(this, 'Network Firewall Availability Zone 2', {
      value: Fn.getAtt('NetworkFirewallSubnet2', 'AvailabilityZone').toString(),
      description: 'Availability Zone configured for Network Firewall subnet 2',
    });

    new CfnOutput(this, 'Artifact Bucket for CodePipeline', {
      value: codePipeline.artifactBucket.bucketName,
      description: 'Artifact bucket name configured for the CodePipeline.',
    });

    new CfnOutput(this, 'Code Build source code bucket', {
      value: codeBuildStagesSourceCodeBucket.bucketName,
      description: 'Code Build source code bucket',
    });

    new CfnOutput(this, 'S3 Bucket for Firewall Logs', {
      value: Fn.conditionIf('LoggingInS3', logsBucket.bucketName, 'NotConfigured').toString(),
      description: 'S3 Bucket used as the log destination for Firewall Logs.',
    });

    new CfnOutput(this, 'CloudWatch Log Group for Firewall Logs', {
      value: Fn.conditionIf('LoggingInCloudWatch', cloudWatchLogGroup.ref, 'NotConfigured').toString(),
      description: 'CloudWatch Log Group used as the log destination for Firewall Logs.',
    });
  }
}
