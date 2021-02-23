/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import * as cdk from '@aws-cdk/core';
import { RemovalPolicy } from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';
import * as logs from '@aws-cdk/aws-logs';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_action from '@aws-cdk/aws-codepipeline-actions';
import {
  BuildEnvironmentVariableType,
  BuildSpec,
  LinuxBuildImage,
  PipelineProject
} from '@aws-cdk/aws-codebuild';


export interface NetworkFirewallAutomationStackProps extends cdk.StackProps {
  solutionId: string;
  solutionTradeMarkName: string | undefined;
  solutionProvider: string | undefined;
  solutionBucket: string | undefined;
  solutionName: string | undefined;
  solutionVersion: string | undefined;
}

export class NetworkFirewallAutomationStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: NetworkFirewallAutomationStackProps) {
    super(scope, id, props);

    /**
     * Parameters - Values to pass to your template at runtime
     */

    const cidrBlock = new cdk.CfnParameter(this, 'cidrBlock', {
      type: 'String',
      default: '192.168.1.0/26',
      description: 'CIDR Block for VPC. Must be /26 or larger CIDR block.',
      allowedPattern: '^(?:[0-9]{1,3}\.){3}[0-9]{1,3}[\/]([0-9]?[0-6]?|[1][7-9])$'
    })

    const logRetentionPeriod = new cdk.CfnParameter(this, "LogRetentionPeriod", {
      type: "Number",
      description: "Log retention period in days.",
      allowedValues: ["1", "3", "5", "7", "14", "30", "60", "90", "120", "150", "180", "365", "400", "545", "731", "1827", "3653"],
      default: 90
    });

    const existingTransitGatewayId = new cdk.CfnParameter(this, "ExistingTransitGateway", {
      description: 'Existing AWS Transit Gateway id.',
      type: 'String',
      default: ""
    })

    const transitGatewayRTIdForAssociation = new cdk.CfnParameter(this, "TransitGatewayRouteTableIdForAssociation", {
      description: 'Existing AWS Transit Gateway route table id. Example:' +
        ' Firewall Route Table. Format: tgw-rtb-0a1b2c3d',
      type: 'String',
      default: ""
    })

    const transitGatewayRTIdForDefaultRoute = new cdk.CfnParameter(this, "TransitGatewayRTIdForDefaultRoute", {
      description: 'Existing AWS Transit Gateway route table id.' +
        ' Example: Spoke VPC Route Table. Format: tgw-rtb-4e5f6g7h',
      type: 'String',
      default: ""
    })

    const logType = new cdk.CfnParameter(this, "logType", {
      type: "String",
      description: 'The type of log to send. Alert logs report traffic that' +
        ' matches a StatefulRule with an action setting that sends an alert' +
        ' log message. Flow logs are standard network traffic flow logs.',
      allowedValues: ['ALERT', 'FLOW', 'EnableBoth'],
      default: 'FLOW',
    })

    const logDestinationType = new cdk.CfnParameter(this, "logDestinationType", {
      type: "String",
      description: 'The type of storage destination to send these logs to.' +
        ' You can send logs to an Amazon S3 bucket ' +
        'or a CloudWatch log group.',
      allowedValues: ['S3', 'CloudWatchLogs', 'ConfigureManually'],
      default: 'CloudWatchLogs',
    })

    /**
     * Metadata - Objects that provide additional information about the
     * template.
     */

    this.templateOptions.metadata = {
      "AWS::CloudFormation::Interface": {
        ParameterGroups: [
          {
            Label: { default: "VPC Configuration" },
            Parameters: [cidrBlock.logicalId]
          },
          {
            Label: { default: "Transit Gateway Configuration" },
            Parameters: [
              existingTransitGatewayId.logicalId,
              transitGatewayRTIdForAssociation.logicalId,
              transitGatewayRTIdForDefaultRoute.logicalId
            ]
          },
          {
            Label: { default: "Firewall Logging Configuration" },
            Parameters: [
              logDestinationType.logicalId,
              logType.logicalId,
              logRetentionPeriod.logicalId
            ]
          }
        ],
        ParameterLabels: {
          [cidrBlock.logicalId]: {
            default: "Provide the CIDR block for the Inspection VPC",
          },
          [existingTransitGatewayId.logicalId]: {
            default: "Provide the existing AWS Transit Gateway ID you wish to" +
              " attach to the Inspection VPC",
          },
          [transitGatewayRTIdForAssociation.logicalId]: {
            default: "Provide AWS Transit Gateway Route Table to be" +
              " associated with the Inspection VPC TGW Attachment.",
          },
          [transitGatewayRTIdForDefaultRoute.logicalId]: {
            default: "Provide the AWS Transit Gateway Route Table to receive 0.0.0.0/0 route to the Inspection VPC TGW Attachment.",
          },
          [logType.logicalId]: {
            default: "Select the type of log to send to the defined log" +
              " destination.",
          },
          [logDestinationType.logicalId]: {
            default: "Select the type of log destination for the Network" +
              " Firewall",
          },
          [logRetentionPeriod.logicalId]: {
            default: "Select the log retention period for Network Firewall" +
              " Logs.",
          }
        },
      },
    };

    /**
     * Mappings - define fixed values
     */
    const mappings = new cdk.CfnMapping(this, 'SolutionMapping')
    mappings.setValue('Version', 'Latest', 'latest')
    mappings.setValue('Route', 'QuadZero', '0.0.0.0/0')
    mappings.setValue('Log', 'Level', 'info')
    mappings.setValue('CodeCommitRepo', 'Name', 'network-firewall-config-repo-')
    mappings.setValue('Metrics', 'URL', 'https://metrics.awssolutionsbuilder.com/generic')
    mappings.setValue('Solution', 'Identifier', 'SO0108')
    mappings.setValue('TransitGatewayAttachment', 'ApplianceMode', 'enable')

    const send = new cdk.CfnMapping(this, 'Send')
    send.setValue('AnonymousUsage', 'Data', 'Yes')
    send.setValue('ParameterKey', 'UniqueId', `/Solutions/${props.solutionName}/UUID`)


    /**
     * Conditions - control whether certain resources are created or whether
     * certain resource properties are assigned a value during stack
     * creation or update.
     */

    const isLoggingInS3 = new cdk.CfnCondition(this,
      "LoggingInS3",
      {
        expression: cdk.Fn.conditionEquals(logDestinationType.valueAsString, 'S3')
      })

    const isLoggingInCloudWatch = new cdk.CfnCondition(this,
      "LoggingInCloudWatch",
      {
        expression: cdk.Fn.conditionEquals(logDestinationType.valueAsString, 'CloudWatchLogs')
      })

    const isNotLoggingConfigureManually = new cdk.CfnCondition(this,
      "NotLoggingConfigureManually",
      {
        expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(logDestinationType.valueAsString, 'ConfigureManually'))
      })

    /**
     * condition to determine if transit gateway id is provided or not if
     * provided use it to create transit gateway attachment else skip
     */

    const createTransitGatewayAttachment = new cdk.CfnCondition(this,
      "CreateTransitGatewayAttachment",
      {
        expression: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(existingTransitGatewayId.valueAsString, ''))
      })

    /**
     * condition to determine if transit gateway route table id is provided or
     * not. if provided use it to create route table association else skip
     */
    const createTransitGatewayRTAssociation = new cdk.CfnCondition(this,
      "CreateTransitGatewayRTAssociation",
      {
        expression: cdk.Fn.conditionAnd(
          cdk.Fn.conditionNot(
            cdk.Fn.conditionEquals(
              transitGatewayRTIdForAssociation.valueAsString, '')), createTransitGatewayAttachment)
      })

    /**
     * condition to determine if transit gateway route table id is provided or
     * not. if provided use it to create route table propagation else skip
     */
    const createDefaultRouteFirewallRT = new cdk.CfnCondition(this,
      "CreateDefaultRouteFirewallRT",
      {
        expression: cdk.Fn.conditionAnd(
          cdk.Fn.conditionNot(
            cdk.Fn.conditionEquals(
              transitGatewayRTIdForDefaultRoute.valueAsString, '')), createTransitGatewayAttachment)
      })

    /**
     * Resources - Specifies the stack resources and their properties
     */

    this.templateOptions.templateFormatVersion = '2010-09-09';

    // Create a new VPC

    const vpc = new ec2.CfnVPC(this, 'VPC', {
      cidrBlock: cidrBlock.valueAsString,
    });

    //KMS Key for the VPC Flow logs and Firewall Logs
    const KMSKeyForNetworkFirewallLogDestinations = new kms.Key(this, "KMSKeyForNetworkFirewallLogDestinations", {
      description: "This key will be used for encrypting the vpc flow logs and firewall logs.",
      enableKeyRotation: true
    })

    //Permissions for network firewall service to be able use this key for publishing logs to S3.
    KMSKeyForNetworkFirewallLogDestinations.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      principals: [new iam.ServicePrincipal("delivery.logs.amazonaws.com")],
      actions: ["kms:GenerateDataKey*"]
    }))
    //Permissions for network firewall service to be able use this key for publishing logs to cloudwatch.
    KMSKeyForNetworkFirewallLogDestinations.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      actions: [
        "kms:Encrypt*",
        "kms:Decrypt*",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:Describe*"
      ],
      principals: [
        new iam.ServicePrincipal(`logs.${cdk.Aws.REGION}.amazonaws.com`)
      ]
    }))

    // Create a new log group for Firewall logging
    const cloudWatchLogGroup = new logs.CfnLogGroup(this, 'CloudWatchLogGroup', {
      retentionInDays: logRetentionPeriod.valueAsNumber,
      kmsKeyId: KMSKeyForNetworkFirewallLogDestinations.keyArn
    })

    cloudWatchLogGroup.cfnOptions.condition = isLoggingInCloudWatch;

    const logsBucket = new s3.Bucket(this, 'Logs', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: KMSKeyForNetworkFirewallLogDestinations,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{
        expiration: cdk.Duration.days(logRetentionPeriod.valueAsNumber)
      }]
    });

    const cfnLogsBucket = logsBucket.node.defaultChild as s3.CfnBucket;
    cfnLogsBucket.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W35',
          reason: 'Logs bucket does not require logging configuration'
        }, {
          id: 'W51',
          reason: 'Logs bucket is private and does not require a bucket policy'
        }]
      }
    };
    cfnLogsBucket.cfnOptions.condition = isLoggingInS3;

    //Solution Logging Changes stop.


    vpc.applyRemovalPolicy(RemovalPolicy.RETAIN)
    vpc.tags.setTag('Name', `${cdk.Aws.STACK_NAME}-Inspection-VPC`)
    vpc.tags.setTag('created-by', `${props.solutionName}`)

    const cidrCount = 4
    const cidrBits = '4'
    const availabilityZoneA = {
      "Fn::Select": [
        "0",
        {
          "Fn::GetAZs": ""
        }
      ]
    }
    const availabilityZoneB = {
      "Fn::Select": [
        "1",
        {
          "Fn::GetAZs": ""
        }
      ]
    }

    // Create Firewall Subnet 1
    const NetworkFirewallSubnet1 = new ec2.CfnSubnet(this, "NetworkFirewallSubnet1", {
      vpcId: vpc.ref,
      cidrBlock: cdk.Fn.select(
        0,
        cdk.Fn.cidr(
          vpc.attrCidrBlock,
          cidrCount,
          cidrBits
        )
      )
    })
    NetworkFirewallSubnet1.tags.setTag("Name", `${cdk.Aws.STACK_NAME}-FirewallSubnet1`)
    NetworkFirewallSubnet1.applyRemovalPolicy(RemovalPolicy.RETAIN)
    NetworkFirewallSubnet1.addPropertyOverride('AvailabilityZone', availabilityZoneA)


    // Create Firewall Subnet 2
    const NetworkFirewallSubnet2 = new ec2.CfnSubnet(this, "NetworkFirewallSubnet2", {
      vpcId: vpc.ref,
      cidrBlock: cdk.Fn.select(
        1,
        cdk.Fn.cidr(
          vpc.attrCidrBlock,
          cidrCount,
          cidrBits
        )
      )
    })

    NetworkFirewallSubnet2.tags.setTag("Name", `${cdk.Aws.STACK_NAME}-FirewallSubnet2`)
    NetworkFirewallSubnet2.applyRemovalPolicy(RemovalPolicy.RETAIN)
    NetworkFirewallSubnet2.addPropertyOverride('AvailabilityZone', availabilityZoneB)

    //Subnet Route Tables.
    const firewallSubnetRouteTable = new ec2.CfnRouteTable(this, "FirewallSubnetRouteTable", {
      vpcId: vpc.ref
    })
    firewallSubnetRouteTable.tags.setTag("Name", `${cdk.Aws.STACK_NAME}-FirewallSubnetRouteTable`)
    firewallSubnetRouteTable.applyRemovalPolicy(RemovalPolicy.RETAIN)

    //Subnet Route Table Associations.
    const NetworkFirewallSubnet1RouteTableAssociation = new ec2.CfnSubnetRouteTableAssociation(this, "NetworkFirewallSubnet1RouteTableAssociation", {
      subnetId: NetworkFirewallSubnet1.ref,
      routeTableId: firewallSubnetRouteTable.ref
    })
    NetworkFirewallSubnet1RouteTableAssociation.applyRemovalPolicy(RemovalPolicy.RETAIN)

    const NetworkFirewallSubnet2RouteTableAssociation = new ec2.CfnSubnetRouteTableAssociation(this, "NetworkFirewallSubnet2RouteTableAssociation", {
      subnetId: NetworkFirewallSubnet2.ref,
      routeTableId: firewallSubnetRouteTable.ref
    })
    NetworkFirewallSubnet2RouteTableAssociation.applyRemovalPolicy(RemovalPolicy.RETAIN)

    // Create Transit Gateway Subnet 1
    const vpcTGWSubnet1 = new ec2.CfnSubnet(this, "VPCTGWSubnet1", {
      vpcId: vpc.ref,
      cidrBlock: cdk.Fn.select(
        2,
        cdk.Fn.cidr(
          vpc.attrCidrBlock,
          cidrCount,
          cidrBits
        )
      )
    })
    vpcTGWSubnet1.tags.setTag("Name", `${cdk.Aws.STACK_NAME}-VPCTGWSubnet1`)
    vpcTGWSubnet1.applyRemovalPolicy(RemovalPolicy.RETAIN)
    vpcTGWSubnet1.addPropertyOverride('AvailabilityZone', availabilityZoneA)

    // Create Transit Gateway Subnet 2
    const vpcTGWSubnet2 = new ec2.CfnSubnet(this, "VPCTGWSubnet2", {
      vpcId: vpc.ref,
      cidrBlock: cdk.Fn.select(
        3,
        cdk.Fn.cidr(
          vpc.attrCidrBlock,
          cidrCount,
          cidrBits
        )
      )
    })
    vpcTGWSubnet2.tags.setTag("Name", `${cdk.Aws.STACK_NAME}-VPCTGWSubnet2`)
    vpcTGWSubnet2.applyRemovalPolicy(RemovalPolicy.RETAIN)
    vpcTGWSubnet2.addPropertyOverride('AvailabilityZone', availabilityZoneB)

    //Route Tables for VPC Transit Gateway subnets.
    const vpcTGWRouteTable1 = new ec2.CfnRouteTable(this, "VPCTGWRouteTable1", {
      vpcId: vpc.ref
    })
    vpcTGWRouteTable1.tags.setTag("Name", `${cdk.Aws.STACK_NAME}-TGWSubnetRouteTable1`)
    vpcTGWRouteTable1.applyRemovalPolicy(RemovalPolicy.RETAIN)

    const vpcTGWRouteTable2 = new ec2.CfnRouteTable(this, "VPCTGWRouteTable2", {
      vpcId: vpc.ref
    })
    vpcTGWRouteTable2.tags.setTag("Name", `${cdk.Aws.STACK_NAME}-TGWSubnetRouteTable2`)
    vpcTGWRouteTable2.applyRemovalPolicy(RemovalPolicy.RETAIN)

    //Subnet Route Table Associations for Transit Gateway Subnets
    const vpcTGWSubnet1RouteTableAssociation = new ec2.CfnSubnetRouteTableAssociation(this, "VPCTGWSubnet1RouteTableAssociation", {
      subnetId: vpcTGWSubnet1.ref,
      routeTableId: vpcTGWRouteTable1.ref
    })
    vpcTGWSubnet1RouteTableAssociation.applyRemovalPolicy(RemovalPolicy.RETAIN)

    const vpcTGWSubnet2RouteTableAssociation = new ec2.CfnSubnetRouteTableAssociation(this, "VPCTGWSubnet2RouteTableAssociation", {
      subnetId: vpcTGWSubnet2.ref,
      routeTableId: vpcTGWRouteTable2.ref,
    })
    vpcTGWSubnet2RouteTableAssociation.applyRemovalPolicy(RemovalPolicy.RETAIN)

    //VPC Flow Log
    const logGroup = new logs.CfnLogGroup(this, "LogGroupFlowLogs", {
      retentionInDays: logRetentionPeriod.valueAsNumber,
      logGroupName: cdk.Aws.STACK_NAME,
      kmsKeyId: KMSKeyForNetworkFirewallLogDestinations.keyArn
    })

    const flowLogRole = new iam.Role(this, "RoleFlowLogs", {
      assumedBy: new iam.ServicePrincipal("vpc-flow-logs.amazonaws.com")
    });

    const policyStatement = new iam.PolicyStatement({
      actions: [
        "logs:CreateLogStream",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents",
        "logs:CreateLogGroup",
        "logs:DescribeLogGroups"],
      resources: [logGroup.attrArn]
    });
    policyStatement.effect = iam.Effect.ALLOW;
    flowLogRole.addToPolicy(policyStatement);


    new ec2.CfnFlowLog(this, "FlowLog", {
      deliverLogsPermissionArn: flowLogRole.roleArn,
      logGroupName: logGroup.logGroupName,
      resourceId: vpc.ref,
      resourceType: "VPC",
      trafficType: "ALL"
    });

    //Start: associate for an existing transit gateway if user provides one.


    //Transit gateway attachment.
    const vpcTGWAttachment = new ec2.CfnTransitGatewayAttachment(this, 'VPC_TGW_ATTACHMENT', {
      transitGatewayId: existingTransitGatewayId.valueAsString,
      vpcId: vpc.ref,
      subnetIds: [
        vpcTGWSubnet1.ref,
        vpcTGWSubnet2.ref
      ]
    })
    vpcTGWAttachment.cfnOptions.condition = createTransitGatewayAttachment
    vpcTGWAttachment.tags.setTag('Name', `${cdk.Aws.STACK_NAME}-Inspection-VPC-Attachment`)
    vpcTGWAttachment.applyRemovalPolicy(RemovalPolicy.RETAIN)
    vpcTGWAttachment.addDeletionOverride("UpdateReplacePolicy")

    //add the transit gateway id provided by the user to the firewall route
    // table created for transit gateway interaction.
    const defaultTransitGatewayRoute = new ec2.CfnRoute(this, 'TGWRoute', {
      routeTableId: firewallSubnetRouteTable.ref,
      destinationCidrBlock: mappings.findInMap('Route', 'QuadZero'),
      transitGatewayId: existingTransitGatewayId.valueAsString
    })
    defaultTransitGatewayRoute.cfnOptions.condition = createTransitGatewayAttachment
    defaultTransitGatewayRoute.addDependsOn(vpcTGWAttachment)


    //Transit Gateway association with the TGW route table id provided by the user.
    const tgwRouteTableAssociation = new ec2.CfnTransitGatewayRouteTableAssociation(this, 'VPCTGWRouteTableAssociation', {
      transitGatewayAttachmentId: vpcTGWAttachment.ref,
      transitGatewayRouteTableId: transitGatewayRTIdForAssociation.valueAsString
    })

    //createTransitGatewayRTAssociation
    tgwRouteTableAssociation.cfnOptions.condition = createTransitGatewayRTAssociation
    tgwRouteTableAssociation.addOverride("DeletionPolicy", "Retain")
    tgwRouteTableAssociation.addDeletionOverride("UpdateReplacePolicy")

    // Add default route to Instection VPC-TGW Attachment in the Spoke VPC
    // Route Transit Gateway Route Table
    const defaultRouteSpokeVPCTGWRouteTable = new ec2.CfnTransitGatewayRoute(this, 'DefaultRouteSpokeVPCTGWRouteTable', {
      transitGatewayRouteTableId: transitGatewayRTIdForDefaultRoute.valueAsString,
      destinationCidrBlock: mappings.findInMap('Route', 'QuadZero'),
      transitGatewayAttachmentId: vpcTGWAttachment.ref
    })
    defaultRouteSpokeVPCTGWRouteTable.cfnOptions.condition = createDefaultRouteFirewallRT
    defaultRouteSpokeVPCTGWRouteTable.addOverride("DeletionPolicy", "Retain")

    //End: Transit gateway changes.

    //CodeCommit Repo and Code Pipeline with default policy created.
    const codeCommitRepo = new codecommit.Repository(this, 'NetworkFirewallCodeRepository', {
      repositoryName: mappings.findInMap("CodeCommitRepo", "Name") + cdk.Aws.STACK_NAME,
      description: 'This repository is created by the AWS Network Firewall' +
        ' solution for AWS Transit Gateway, to store and trigger changes to' +
        ' the network firewall rules and configurations.'
    })

    const codeCommitRepo_cfn_ref = codeCommitRepo.node.defaultChild as codecommit.CfnRepository
    codeCommitRepo_cfn_ref.addOverride("Properties.Code.S3.Bucket", `${props.solutionBucket}-${this.region}`)
    codeCommitRepo_cfn_ref.addOverride("Properties.Code.S3.Key", `${props.solutionName}/${mappings.findInMap('Version', 'Latest')}/network-firewall-configuration.zip`)
    codeCommitRepo_cfn_ref.addOverride("DeletionPolicy", "Retain")
    codeCommitRepo_cfn_ref.addOverride("UpdateReplacePolicy", "Retain")

    const codeBuildStagesSourceCodeBucket = new s3.Bucket(this, 'CodeBuildStagesSourceCodeBucket', {
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    const sourceOutputArtifact = new codepipeline.Artifact('SourceArtifact')
    const buildOutputArtifact = new codepipeline.Artifact('BuildArtifact')

    const subnetIds = NetworkFirewallSubnet1.ref + ',' + NetworkFirewallSubnet2.ref
    const codeBuildEnvVariables = {
      ['LOG_LEVEL']:
      {
        value: mappings.findInMap('Log', 'Level'),
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['VPC_ID']:
      {
        value: vpc.ref,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['SUBNET_IDS']:
      {
        value: subnetIds,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['LOG_TYPE']:
      {
        value: logType.valueAsString,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['LOG_DESTINATION_TYPE']:
      {
        value: logDestinationType.valueAsString,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['S3_LOG_BUCKET_NAME']:
      {
        value: cdk.Fn.conditionIf('LoggingInS3', logsBucket.bucketName, 'NotConfigured'),
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['CLOUDWATCH_LOG_GROUP_NAME']:
      {
        value: cdk.Fn.conditionIf('LoggingInCloudWatch', cloudWatchLogGroup.ref, 'NotConfigured'),
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['VPC_TGW_ATTACHMENT_AZ_1']:
      {
        value: cdk.Fn.getAtt(
          'NetworkFirewallSubnet1',
          'AvailabilityZone').toString(),
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['VPC_TGW_ATTACHMENT_AZ_2']:
      {
        value: cdk.Fn.getAtt(
          'NetworkFirewallSubnet2',
          'AvailabilityZone').toString(),
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['VPC_TGW_ATTACHMENT_ROUTE_TABLE_ID_1']:
      {
        value: vpcTGWRouteTable1.ref,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['VPC_TGW_ATTACHMENT_ROUTE_TABLE_ID_2']:
      {
        value: vpcTGWRouteTable2.ref,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['CODE_BUILD_SOURCE_CODE_S3_KEY']: {
        value: `${props.solutionName}/${props.solutionVersion}`,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['STACK_ID']: {
        value: `${cdk.Aws.STACK_ID}`,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['SSM_PARAM_FOR_UUID']: {
        value: send.findInMap('ParameterKey', 'UniqueId'),
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['SEND_ANONYMOUS_METRICS']: {
        value: `${send.findInMap('AnonymousUsage', 'Data')}`,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['SOLUTION_ID']: {
        value: `${mappings.findInMap('Solution', 'Identifier')}`,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['METRICS_URL']: {
        value: `${mappings.findInMap('Metrics', 'URL')}`,
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['TRANSIT_GATEWAY_ATTACHMENT_ID']: {
        value: cdk.Fn.conditionIf(createTransitGatewayAttachment.logicalId, vpcTGWAttachment.ref, ''),
        type: BuildEnvironmentVariableType.PLAINTEXT
      },
      ['TRANSIT_GATEWAY_ATTACHMENT_APPLIANCE_MODE']: {
        value: mappings.findInMap('TransitGatewayAttachment', 'ApplianceMode'),
        type: BuildEnvironmentVariableType.PLAINTEXT
      }
    }

    // Code build project, code build role will be created by the construct.
    const buildProject = new PipelineProject(this, 'BuildProject', {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '12'
            },
            commands: [`export current=$(pwd)`, `export sourceCodeKey=$CODE_BUILD_SOURCE_CODE_S3_KEY`]
          },
          pre_build: {
            commands: [
              `cd $current`,
              `pwd; ls -ltr`,
              `echo 'Download Network Firewall Solution Package'`,
              `aws s3 cp s3://${codeBuildStagesSourceCodeBucket.bucketName}/$sourceCodeKey/network-firewall-automation.zip $current || true`,
              `if [ -f $current/network-firewall-automation.zip ];then exit 0;else echo \"Copy file to s3 bucket\"; aws s3 cp s3://${props.solutionBucket}-${cdk.Aws.REGION}/$sourceCodeKey/network-firewall-automation.zip s3://${codeBuildStagesSourceCodeBucket.bucketName}/$sourceCodeKey/network-firewall-automation.zip; aws s3 cp s3://${codeBuildStagesSourceCodeBucket.bucketName}/$sourceCodeKey/network-firewall-automation.zip $current; fi;`,
              `unzip -o $current/network-firewall-automation.zip -d $current`,
              `pwd; ls -ltr`,
            ]
          },
          build: {
            commands: [
              `echo "Validating the firewall config"`,
              `node build.js`
            ]
          }
        },
        artifacts: {
          files: "**/*"
        }
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_4_0
      },
      environmentVariables: codeBuildEnvVariables
    })

    const buildStageIAMPolicy = new iam.Policy(this, 'buildStageIAMPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "network-firewall:CreateFirewallPolicy",
            "network-firewall:CreateRuleGroup"
          ],
          resources: [
            cdk.Fn.sub("arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:stateful-rulegroup/*"),
            cdk.Fn.sub("arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:firewall-policy/*"),
            cdk.Fn.sub("arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:stateless-rulegroup/*")
          ],
          effect: iam.Effect.ALLOW
        }),
        new iam.PolicyStatement({
          actions: ["s3:GetObject"],
          resources: [cdk.Fn.sub("arn:${AWS::Partition}:s3:::${CodeBucketName}/${KeyName}/*", {
            CodeBucketName: `${props.solutionBucket}-${this.region}`,
            KeyName: `${props.solutionName}`
          }),
          `arn:${cdk.Aws.PARTITION}:s3:::${codeBuildStagesSourceCodeBucket.bucketName}/*`]
        }),
        new iam.PolicyStatement({
          actions: ["s3:PutObject"],
          resources: [
            `arn:${cdk.Aws.PARTITION}:s3:::${codeBuildStagesSourceCodeBucket.bucketName}/*`
          ],
          effect: iam.Effect.ALLOW
        }),
        new iam.PolicyStatement({
          actions: [
            "ssm:PutParameter",
            "ssm:GetParameter",
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            cdk.Fn.sub("arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter/${ParameterKey}", {
              ParameterKey: `${send.findInMap('ParameterKey', 'UniqueId')}`
            })
          ]
        }),
      ]
    })

    buildProject.role?.attachInlinePolicy(buildStageIAMPolicy)

    //IAM Policy and Role to execute deploy stage

    const deployStageFirewallPolicy = new iam.Policy(this,
      'deployStageFirewallPolicy',
      {
        statements: [
          new iam.PolicyStatement({
            actions: [
              "network-firewall:CreateFirewall",
              "network-firewall:UpdateFirewallDeleteProtection",
              "network-firewall:DeleteRuleGroup",
              "network-firewall:DescribeLoggingConfiguration",
              "network-firewall:UpdateFirewallDescription",
              "network-firewall:CreateRuleGroup",
              "network-firewall:DescribeFirewall",
              "network-firewall:DeleteFirewallPolicy",
              "network-firewall:UpdateRuleGroup",
              "network-firewall:DescribeRuleGroup",
              "network-firewall:ListRuleGroups",
              "network-firewall:UpdateSubnetChangeProtection",
              "network-firewall:UpdateFirewallPolicyChangeProtection",
              "network-firewall:AssociateFirewallPolicy",
              "network-firewall:DescribeFirewallPolicy",
              "network-firewall:UpdateFirewallPolicy",
              "network-firewall:DescribeResourcePolicy",
              "network-firewall:CreateFirewallPolicy",
              "network-firewall:UpdateLoggingConfiguration",
              "network-firewall:TagResource"
            ],
            resources: [
              cdk.Fn.sub("arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:stateful-rulegroup/*"),
              cdk.Fn.sub("arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:firewall-policy/*"),
              cdk.Fn.sub("arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:firewall/*"),
              cdk.Fn.sub("arn:${AWS::Partition}:network-firewall:${AWS::Region}:${AWS::AccountId}:stateless-rulegroup/*")
            ]
          }),
          new iam.PolicyStatement({
            actions: ["s3:GetObject"],
            resources: [cdk.Fn.sub("arn:${AWS::Partition}:s3:::${CodeBucketName}/${KeyName}/*", {
              CodeBucketName: `${props.solutionBucket}-${this.region}`,
              KeyName: `${props.solutionName}`
            }),
            `arn:${cdk.Aws.PARTITION}:s3:::${codeBuildStagesSourceCodeBucket.bucketName}/*`]
          }),
          new iam.PolicyStatement({
            actions: [
              "ec2:DescribeVpcs",
              "ec2:DescribeSubnets",
              "ec2:DescribeRouteTables"
            ],
            resources: ["*"]
          }),
          new iam.PolicyStatement({
            actions: [
              "ec2:CreateRoute",
              "ec2:DeleteRoute",
            ],
            effect: iam.Effect.ALLOW,
            resources: [
              `arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:route-table/${vpcTGWRouteTable1.ref}`,
              `arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:route-table/${vpcTGWRouteTable2.ref}`
            ]
          }),
          new iam.PolicyStatement({
            actions: ["iam:CreateServiceLinkedRole"],
            resources: [cdk.Fn.sub("arn:aws:iam::${AWS::AccountId}:role/aws-service-role/network-firewall.amazonaws.com/AWSServiceRoleForNetworkFirewall")]
          })
        ]
      })

    const deployStageFirewallPolicyResource = deployStageFirewallPolicy.node.findChild('Resource') as iam.CfnPolicy;

    deployStageFirewallPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W12',
            reason: 'Resource * is required for describe APIs'
          }]
      }
    };

    //add modify transit gateway attachement permission only if the transit gateway attachment is provided.
    const deployStageModifyTransitGatewayAttachmentPolicy = new iam.Policy(this, 'deployStageModifyTransitGatewayAttachmentPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "ec2:ModifyTransitGatewayVpcAttachment"
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:transit-gateway-attachment/${vpcTGWAttachment.ref}`,
          ]
        })
      ]
    })
    const resourcePolicyModifyTGWAttachment = deployStageModifyTransitGatewayAttachmentPolicy.node.findChild('Resource') as iam.CfnPolicy;
    resourcePolicyModifyTGWAttachment.cfnOptions.condition = createTransitGatewayAttachment

    const deployStageFirewallLoggingPolicy = new iam.Policy(this,
      'deployStageFirewallLoggingPolicy',
      {
        statements: [
          new iam.PolicyStatement({
            actions: [
              "logs:CreateLogDelivery",
              "logs:GetLogDelivery",
              "logs:UpdateLogDelivery",
              "logs:DeleteLogDelivery",
              "logs:ListLogDeliveries"
            ],
            resources: ["*"] // Per IAM service must use All Resources
          })
        ]
      })

    const deployStageFirewallLoggingResource = deployStageFirewallLoggingPolicy.node.findChild('Resource') as iam.CfnPolicy;

    deployStageFirewallLoggingResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W12',
            reason: 'Resource * is required for these actions.'
          }]
      }
    };

    // skip creating the 'deployStageFirewallLoggingPolicy' IAM policy if
    // logging destination type is set to configure manually
    deployStageFirewallLoggingResource.cfnOptions.condition = isNotLoggingConfigureManually

    const deployStageFirewallLoggingS3Policy = new iam.Policy(this,
      'deployStageFirewallLoggingS3Policy',
      {
        statements: [
          new iam.PolicyStatement({
            actions: [
              "s3:PutBucketPolicy",
              "s3:GetBucketPolicy"
            ],
            resources: [logsBucket.bucketArn]
          })
        ]
      })

    const deployStageFirewallLoggingS3PolicyResource = deployStageFirewallLoggingS3Policy.node.findChild('Resource') as iam.CfnPolicy;

    // create the 'deployStageFirewallLoggingS3Policy' IAM policy only if
    // logging destination type is set to S3
    deployStageFirewallLoggingS3PolicyResource.cfnOptions.condition = isLoggingInS3

    const deployStageFirewallLoggingCWPolicy = new iam.Policy(this,
      'deployStageFirewallLoggingCWPolicy',
      {
        statements: [
          new iam.PolicyStatement({
            actions: [
              "logs:PutResourcePolicy",
              "logs:DescribeResourcePolicies"
            ],
            resources: ["*"] // Per IAM service must use All Resources
          }),
          new iam.PolicyStatement({
            actions: [
              "logs:DescribeLogGroups"
            ],
            resources: [
              cdk.Fn.sub("arn:${AWS::Partition}:logs:*:${AWS::AccountId}:log-group:*")
            ]
          })
        ]
      })

    const deployStageFirewallLoggingCWPolicyResource = deployStageFirewallLoggingCWPolicy.node.findChild('Resource') as iam.CfnPolicy;

    deployStageFirewallLoggingCWPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W12',
            reason: 'Resource * is required for describe APIs'
          }]
      }
    };

    // create the 'deployStageFirewallLoggingCWPolicy' IAM policy if
    // logging destination type is set to CloudWatch Logs
    deployStageFirewallLoggingCWPolicyResource.cfnOptions.condition = isLoggingInCloudWatch

    // Code deploy build action project, role will be created by the construct.

    const deployProject = new PipelineProject(this, 'DeployProject', {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '12'
            },
            commands: [`export current=$(pwd)`, `export sourceCodeKey=$CODE_BUILD_SOURCE_CODE_S3_KEY`]
          },
          pre_build: {
            commands: [
              `cd $current`,
              `pwd; ls -ltr`,
              `echo 'Download Network Firewall Solution Package'`,
              `aws s3 cp s3://${codeBuildStagesSourceCodeBucket.bucketName}/$sourceCodeKey/network-firewall-automation.zip $current`,
              `unzip -o $current/network-firewall-automation.zip -d $current`,
              `pwd; ls -ltr`,
            ]
          },
          build: {
            commands: [
              `echo "Initiating Network Firewall Automation"`,
              `node index.js`
            ]
          },
          post_build: {
            commands: []
          }
        },
        artifacts: {
          files: "**/*"
        }
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_4_0
      },
      environmentVariables: codeBuildEnvVariables
    })

    // attach inline IAM policies with the default CodeBuild role.
    deployProject.role?.attachInlinePolicy(deployStageFirewallPolicy)
    deployProject.role?.attachInlinePolicy(deployStageFirewallLoggingPolicy)
    deployProject.role?.attachInlinePolicy(deployStageFirewallLoggingS3Policy)
    deployProject.role?.attachInlinePolicy(deployStageFirewallLoggingCWPolicy)
    deployProject.role?.attachInlinePolicy(deployStageModifyTransitGatewayAttachmentPolicy)


    const codePipeline = new codepipeline.Pipeline(this, `NetworkFirewallCodePipeline`, {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_action.CodeCommitSourceAction({
              actionName: 'Source',
              repository: codeCommitRepo,
              output: sourceOutputArtifact,
            })
          ]
        },
        {
          stageName: 'Validation',
          actions: [
            new codepipeline_action.CodeBuildAction({
              actionName: 'CodeBuild',
              input: sourceOutputArtifact,
              project: buildProject,
              outputs: [buildOutputArtifact]
            })
          ]
        },
        {
          stageName: 'Deployment',
          actions: [
            new codepipeline_action.CodeBuildAction({
              actionName: 'CodeDeploy',
              input: buildOutputArtifact,
              project: deployProject,
            })
          ]
        }]
    })

    //Adding bucket encryption
    const kmsKeyCfn_ref = codePipeline.artifactBucket.encryptionKey?.node.defaultChild as kms.CfnKey
    kmsKeyCfn_ref.addPropertyOverride('EnableKeyRotation', true)

    const stack = cdk.Stack.of(this);

    const codePipelineArtifactBucketKmsKeyAlias = stack.node.findChild("NetworkFirewallCodePipeline").node.findChild("ArtifactsBucketEncryptionKeyAlias").node.defaultChild as kms.CfnAlias
    codePipelineArtifactBucketKmsKeyAlias.addPropertyOverride("AliasName", {
      "Fn::Join": [
        "",
        [
          "alias/",
          {
            "Ref": "AWS::StackName"
          },
          "-artifactBucket-EncryptionKeyAlias"
        ]
      ]
    })

    const codeBuildStagesSourceCodeBucket_cfn_ref = codeBuildStagesSourceCodeBucket.node.defaultChild as s3.CfnBucket
    codeBuildStagesSourceCodeBucket_cfn_ref.bucketEncryption = {
      serverSideEncryptionConfiguration: [
        {
          serverSideEncryptionByDefault: {
            kmsMasterKeyId: codePipeline.artifactBucket.encryptionKey?.keyArn,
            sseAlgorithm: "aws:kms"
          }
        }
      ]
    }

    codeBuildStagesSourceCodeBucket_cfn_ref.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W35',
          reason: 'Source Code bucket bucket does not require logging configuration'
        }, {
          id: 'W51',
          reason: 'Source Code bucket is private and does not require a bucket policy'
        }]
      }
    };

    //S3 Bucket policy for the pipeline artifacts bucket
    const bucketPolicy = new s3.BucketPolicy(this, 'CodePipelineArtifactS3BucketPolicy', {
      bucket: codePipeline.artifactBucket,
      removalPolicy: RemovalPolicy.RETAIN
    })

    bucketPolicy.document.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:DeleteBucket'
        ],
        principals: [new iam.ServicePrincipal('cloudformation.amazonaws.com')],
        resources: [
          codePipeline.artifactBucket.bucketArn
        ]
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: [
          's3:GetObject'
        ],
        principals: [
          new iam.AnyPrincipal()
        ],
        resources: [
          `${codePipeline.artifactBucket.bucketArn}/*`,
          `${codePipeline.artifactBucket.bucketArn}`
        ],
        conditions: {
          Bool: {
            "aws:SecureTransport": false
          }
        }
      }));

    const bucketPolicyForlogsBucket = new s3.BucketPolicy(this, 'CloudWatchLogsForNetworkFirewallBucketPolicy', {
      bucket: logsBucket,
      removalPolicy: RemovalPolicy.RETAIN
    })

    bucketPolicyForlogsBucket.document.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: [
          's3:GetObject'
        ],
        principals: [
          new iam.AnyPrincipal()
        ],
        resources: [
          `${logsBucket.bucketArn}/*`,
          `${logsBucket.bucketArn}`
        ],
        conditions: {
          Bool: {
            "aws:SecureTransport": false
          }
        }
      }));

    const bucketPolicyForlogsBucket_cfn_ref = bucketPolicyForlogsBucket.node.defaultChild as s3.CfnBucketPolicy
    bucketPolicyForlogsBucket_cfn_ref.cfnOptions.condition = isLoggingInS3

    const bucketPolicyForSourceCodeBucket = new s3.BucketPolicy(this, 'CodeBuildStageSourceCodeBucketPolicy', {
      bucket: codeBuildStagesSourceCodeBucket,
      removalPolicy: RemovalPolicy.RETAIN
    });

    bucketPolicyForSourceCodeBucket.document.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: [
          's3:GetObject'
        ],
        principals: [
          new iam.AnyPrincipal()
        ],
        resources: [
          `${codeBuildStagesSourceCodeBucket.bucketArn}`,
          `${codeBuildStagesSourceCodeBucket.bucketArn}/*`
        ],
        conditions: {
          Bool: {
            "aws:SecureTransport": false
          }
        }
      }));

    //disable W35 for the artifact bucket as it only store the artifact files.
    const w35Rule = {
      rules_to_suppress: [{
        id: 'W35',
        reason: "This S3 bucket is used as the destination for 'NetworkFirewallCodePipelineArtifactsBucket'"
      }]
    }
    const s3ArtifactBucket_cfn_ref = codePipeline.artifactBucket.node.defaultChild as s3.CfnBucket
    s3ArtifactBucket_cfn_ref.cfnOptions.metadata = {
      cfn_nag: w35Rule
    }

    /**
     * Outputs - describes the values that are returned whenever you view
     * your stack's properties.
     */
    new cdk.CfnOutput(this, 'Inspection VPC ID', {
      value: vpc.ref,
      description: 'Inspection VPC ID to create Network Firewall.',
    })

    new cdk.CfnOutput(this, 'Firewall Subnet 1 ID', {
      value: NetworkFirewallSubnet1.ref,
      description: 'Subnet 1 associated with Network Firewall.',
    })

    new cdk.CfnOutput(this, 'Firewall Subnet 2 ID', {
      value: NetworkFirewallSubnet2.ref,
      description: 'Subnet 2 associated with Network Firewall.',
    })

    new cdk.CfnOutput(this, 'Transit Gateway Subnet 1 ID', {
      value: vpcTGWSubnet1.ref,
      description: 'Subnet 1 associated with Transit Gateway.',
    })

    new cdk.CfnOutput(this, 'Transit Gateway Subnet 2 ID', {
      value: vpcTGWSubnet2.ref,
      description: 'Subnet 1 associated with Transit Gateway.',
    })

    new cdk.CfnOutput(this, 'Network Firewall Availability Zone 1', {
      value: cdk.Fn.getAtt(
        'NetworkFirewallSubnet1',
        'AvailabilityZone').toString(),
      description: 'Availability Zone configured for Network Firewall subnet 1',
    })

    new cdk.CfnOutput(this, 'Network Firewall Availability Zone 2', {
      value: cdk.Fn.getAtt(
        'NetworkFirewallSubnet2',
        'AvailabilityZone').toString(),
      description: 'Availability Zone configured for Network Firewall subnet 2',
    })

    new cdk.CfnOutput(this, 'Artifact Bucket for CodePipeline', {
      value: codePipeline.artifactBucket.bucketName,
      description: 'Artifact bucket name configured for the CodePipeline.',
    })

    new cdk.CfnOutput(this, 'Code Build source code bucket', {
      value: codeBuildStagesSourceCodeBucket.bucketName,
      description: 'Code Build source code bucket',
    })

    new cdk.CfnOutput(this, 'S3 Bucket for Firewall Logs', {
      value: cdk.Fn.conditionIf('LoggingInS3', logsBucket.bucketName, 'NotConfigured').toString(),
      description: 'S3 Bucket used as the log destination for Firewall' +
        ' Logs.',
    })

    new cdk.CfnOutput(this, 'CloudWatch Log Group for Firewall Logs', {
      value: cdk.Fn.conditionIf('LoggingInCloudWatch', cloudWatchLogGroup.ref, 'NotConfigured').toString(),
      description: 'CloudWatch Log Group used as the log destination for Firewall' +
        ' Logs.',
    })

  }
}
