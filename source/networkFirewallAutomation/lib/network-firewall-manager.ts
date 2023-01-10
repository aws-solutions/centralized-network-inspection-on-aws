/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { NetworkFirewall } from 'aws-sdk';
import { NetworkFirewallService } from './service/network-firewall-service';
import { ConfigReader } from './common/configReader/config-reader';
import { Time } from './service/awsClientConfig';
import { LOG_LEVEL, Logger } from './common/logger';
import { StringUtils } from './common/stringUtils';

enum LogType {
  alert = 'ALERT',
  flow = 'FLOW',
}

export interface EnvironmentProps {
  vpcId: string | undefined;
  subnetIds: string | undefined;
  logDestinationType: 'S3' | 'CloudWatchLogs' | string | undefined;
  logDestination: string | undefined; //bucket name or cloudwatch log group name.
  logType: 'Alert' | 'Flow' | 'EnableBoth' | string | undefined;
  logRetentionPeriod: string | undefined;
  stackId: string;
}

enum RuleGroupType {
  Stateless = 'STATELESS',
  Stateful = 'STATEFUL',
}

/**
 * @description This class contains all the Network Firewall methods to
 * perform CRUD operations for the Network Firewall resources.
 */
export enum FirewallStatus {
  Ready = 'READY',
  ConfigInSync = 'IN_SYNC',
}

export class NetworkFirewallManager {
  private stringUtils: StringUtils;
  private service: NetworkFirewallService;
  private ruleGroupArnsInFirewall: string[] = [];

  constructor(
    public envProps: EnvironmentProps,
    public firewallObject: NetworkFirewall.Types.CreateFirewallRequest,
    public fileHandler: ConfigReader
  ) {
    this.service = new NetworkFirewallService();
    this.stringUtils = new StringUtils(envProps.stackId);
  }

  /** get vpc id */
  getVpcId(): NetworkFirewall.VpcId {
    let vpcId;
    if (this.envProps.vpcId) {
      vpcId = this.envProps.vpcId;
    } else {
      const error_msg = 'VPC ID must be in the environment variables';
      Logger.log(LOG_LEVEL.ERROR, error_msg);
      throw Error(error_msg);
    }
    return vpcId;
  }

  /** get subnet mapping */
  getSubnetMapping(): NetworkFirewall.SubnetMappings {
    let subnetIdArray;
    let subnetMappings;

    if (this.envProps.subnetIds) {
      subnetIdArray = this.envProps.subnetIds.split(',');
      subnetMappings = subnetIdArray.map((subnetId: string) => {
        return {
          SubnetId: subnetId,
        };
      });
    } else {
      const error_msg = 'Subnet IDs must be in the environment variables';
      Logger.log(LOG_LEVEL.ERROR, error_msg);
      throw Error(error_msg);
    }
    return subnetMappings;
  }

  /** Function to add delay for waiting on process. */
  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Function will create network firewall and wait until the status of the firewall is provisioned before returning the response to the calling
   * function.
   */
  async createNetworkFirewall(firewallPolicyArn: string): Promise<NetworkFirewall.SyncStates | void> {
    this.firewallObject['VpcId'] = this.getVpcId() || '';
    this.firewallObject['SubnetMappings'] = this.getSubnetMapping();
    this.firewallObject.FirewallPolicyArn = firewallPolicyArn;

    // create network firewall
    await this.service.createFirewall(this.firewallObject);

    // check
    return this.checkFirewallStatus();
  }

  /** Function will check if firewall exists, if not will start the process to create rule groups, create the firewall policy
   * and then create the firewall. If firewall exists the configs are updated starting with rule groups, firewall policy and finally firewall.
   */
  async firewallOperations(): Promise<NetworkFirewall.SyncStates | void> {
    let response;
    try {
      // update firewall name to unique firewall name
      this.firewallObject.FirewallName = this.stringUtils.getUniqueResourceName(this.firewallObject.FirewallName);
      const firewallName = this.firewallObject.FirewallName;
      const firewallResponse = await this.service.describeFirewall(firewallName);
      if (firewallResponse && firewallResponse.Firewall) {
        Logger.log(LOG_LEVEL.INFO, `Updating existing firewall: ${firewallName}`);
        const firewallPolicyArn = await this.firewallPolicyOperations(this.firewallObject.FirewallPolicyArn);
        Logger.log(LOG_LEVEL.INFO, `Checking Firewall Status: ${firewallPolicyArn}`);
        response = await this.checkFirewallStatus();
        await this.updateFirewall(firewallResponse, firewallPolicyArn);
      } else {
        Logger.log(LOG_LEVEL.INFO, `Firewall does not exist: ${firewallName}`);
        Logger.log(LOG_LEVEL.INFO, `Checking if firewall policy exist`);
        const firewallPolicyArn = await this.firewallPolicyOperations(this.firewallObject.FirewallPolicyArn);
        Logger.log(LOG_LEVEL.INFO, `Creating Firewall: ${firewallName}`);
        response = await this.createNetworkFirewall(firewallPolicyArn);
      }
      await this.setupLoggingConfigurations(firewallName);
      return response;
    } catch (error: any) {
      Logger.log(LOG_LEVEL.ERROR, error);
      throw new Error(error);
    }
  }

  /**
   * This method will check if the firewall status is in READY state, firewall  config sync state  is 'IN_SYNC',  and
   * also waits until all the attachments created in each availability zone is also in IN_SYNC state.
   */

  async checkFirewallStatus(): Promise<NetworkFirewall.SyncStates | undefined> {
    let firewallStatus: string | undefined = '';
    let firewallConfigSyncState: string | undefined = '';
    let syncStates: NetworkFirewall.SyncStates | undefined = {};
    let areAttachmentsInReadyStatus = false;

    do {
      // sleep
      await this.delay(Time.Seconds15);
      let attachmentStatus = [];
      //describe firewall
      const firewallResponse = await this.service.describeFirewall(this.firewallObject.FirewallName);
      if (firewallResponse && firewallResponse.FirewallStatus) {
        firewallStatus = firewallResponse.FirewallStatus.Status;
        firewallConfigSyncState = firewallResponse.FirewallStatus.ConfigurationSyncStateSummary;
        syncStates = firewallResponse.FirewallStatus.SyncStates;
        Logger.log(LOG_LEVEL.INFO, firewallResponse.FirewallStatus);
      }

      if (syncStates) {
        Logger.log(LOG_LEVEL.INFO, `Sync States for the firewall. `, syncStates);
        for (let availabilityZone in syncStates) {
          if (syncStates[availabilityZone].Attachment) {
            attachmentStatus.push(syncStates[availabilityZone].Attachment?.Status);
          }
        }
      }
      areAttachmentsInReadyStatus = attachmentStatus.every(status => status === 'READY');
    } while (
      firewallStatus != FirewallStatus.Ready ||
      firewallConfigSyncState != FirewallStatus.ConfigInSync ||
      !areAttachmentsInReadyStatus
    );

    Logger.log(
      LOG_LEVEL.INFO,
      'Firewall is ready and configuration is in sync across' +
        ' all the availability zones. Returning the sync states for all' +
        ' the availability zones.'
    );
    return syncStates;
  }

  /** Function to create/update firewall policy */
  async firewallPolicyOperations(policyPath: string): Promise<string> {
    let describePolicyResponse;
    try {
      Logger.log(LOG_LEVEL.INFO, `Getting Firewall Policy Object`);
      const policyObject: NetworkFirewall.CreateFirewallPolicyRequest = await this.ruleGroupOperations(
        this.fileHandler.convertFileToObject(policyPath)
      );
      // update policy name to unique policy name
      policyObject.FirewallPolicyName = this.stringUtils.getUniqueResourceName(policyObject.FirewallPolicyName);
      Logger.log(LOG_LEVEL.INFO, `Checking if Firewall Policy exist: ${policyObject.FirewallPolicyName}`);
      Logger.log(LOG_LEVEL.INFO, `Found Firewall Policy, trying to update the policy.`);
      describePolicyResponse = await this.service.describeFirewallPolicy(policyObject.FirewallPolicyName);
      Logger.log(LOG_LEVEL.INFO, `Describe policy response`, describePolicyResponse);
      if (describePolicyResponse && describePolicyResponse.FirewallPolicyResponse.FirewallPolicyArn) {
        describePolicyResponse.FirewallPolicy = policyObject.FirewallPolicy;
        describePolicyResponse.FirewallPolicyResponse.Description = policyObject.Description;
        describePolicyResponse.FirewallPolicyResponse.Tags = policyObject.Tags;
        let firewallPolicyUpdateResponse = await this.service.updateFirewallPolicy({
          FirewallPolicyArn: describePolicyResponse.FirewallPolicyResponse.FirewallPolicyArn,
          FirewallPolicy: policyObject.FirewallPolicy,
          UpdateToken: describePolicyResponse.UpdateToken,
          Description: policyObject.Description,
          FirewallPolicyName: describePolicyResponse.FirewallPolicyResponse.FirewallPolicyName,
        });
        Logger.log(LOG_LEVEL.INFO, `Firewall update policy response:`, firewallPolicyUpdateResponse);
        //delete the rule groups which are currently in the firewall  but not in the new firewall policy file
        await this.deleteRuleGroups(policyObject);
        return describePolicyResponse.FirewallPolicyResponse.FirewallPolicyArn;
      } else {
        Logger.log(LOG_LEVEL.INFO, `Firewall Policy does not exist,  trying to create the policy.`);
        const responseCreateFirewallPolicy = await this.service.createFirewallPolicy(policyObject);
        return responseCreateFirewallPolicy.FirewallPolicyResponse.FirewallPolicyArn;
      }
    } catch (error: any) {
      Logger.log(LOG_LEVEL.INFO, error);
      throw new Error(error);
    }
  }

  /** Function to create/update Rule Groups with a back out feature in case there is a failure. */
  async ruleGroupOperations(
    policyObject: NetworkFirewall.CreateFirewallPolicyRequest
  ): Promise<NetworkFirewall.CreateFirewallPolicyRequest> {
    Logger.log(LOG_LEVEL.INFO, `Checking rule groups found in the firewall policy`);
    let statelessRuleGroupsForRollback: NetworkFirewall.DescribeRuleGroupResponse[] = [];
    let statefulRuleGroupsForRollback: NetworkFirewall.DescribeRuleGroupResponse[] = [];
    this.ruleGroupArnsInFirewall = await this.service.listRuleGroupsForPolicy(policyObject.FirewallPolicyName);

    try {
      if (policyObject.FirewallPolicy.StatelessRuleGroupReferences) {
        await this.handleStatelessRuleGroupReferences(policyObject, statelessRuleGroupsForRollback);
      }
      if (policyObject.FirewallPolicy.StatefulRuleGroupReferences) {
        await this.handleStatefulRuleGroupReferences(policyObject, statefulRuleGroupsForRollback);
      }
    } catch (error: any) {
      Logger.log(LOG_LEVEL.ERROR, error);
      await this.rollbackRuleGroups(statelessRuleGroupsForRollback, statefulRuleGroupsForRollback);
      throw Error(error);
    }

    return policyObject;
  }

  private async handleStatelessRuleGroupReferences(
    policyObject: NetworkFirewall.CreateFirewallPolicyRequest,
    statelessRuleGroupsForRollback: NetworkFirewall.DescribeRuleGroupResponse[]
  ) {
    if (!policyObject.FirewallPolicy.StatelessRuleGroupReferences) {
      return;
    }

    for (let statelessRuleGroupReference of policyObject.FirewallPolicy.StatelessRuleGroupReferences) {
      let statelessRuleGroupObject: NetworkFirewall.CreateRuleGroupRequest = await this.fileHandler.convertFileToObject(
        statelessRuleGroupReference.ResourceArn
      );
      Logger.log(LOG_LEVEL.INFO, `Checking if stateless rule group exists: ${statelessRuleGroupObject.RuleGroupName}`);
      let describeRuleGroupResponse = await this.service.describeRuleGroup(
        statelessRuleGroupObject.RuleGroupName,
        RuleGroupType.Stateless
      );
      Logger.log(LOG_LEVEL.INFO, `Describe Rule group response`, describeRuleGroupResponse);
      if (describeRuleGroupResponse) {
        statelessRuleGroupsForRollback.push(describeRuleGroupResponse);
        Logger.log(LOG_LEVEL.INFO, `Found existing stateless rule group, trying to update it.`);
        await this.service.updateRuleGroup({
          UpdateToken: describeRuleGroupResponse.UpdateToken,
          Description: statelessRuleGroupObject.Description,
          RuleGroup: statelessRuleGroupObject.RuleGroup,
          RuleGroupArn: describeRuleGroupResponse.RuleGroupResponse.RuleGroupArn,
          Type: statelessRuleGroupObject.Type,
        });
        statelessRuleGroupReference.ResourceArn = describeRuleGroupResponse.RuleGroupResponse.RuleGroupArn;
      } else {
        await this.createStatelessRuleGroup(statelessRuleGroupObject, statelessRuleGroupReference);
      }
    }
  }

  private async createStatelessRuleGroup(
    ruleGroupObject: NetworkFirewall.CreateRuleGroupRequest,
    ruleGroupReference: NetworkFirewall.StatelessRuleGroupReference
  ) {
    Logger.log(LOG_LEVEL.INFO, `Creating rule group: ${ruleGroupObject.RuleGroupName}`);
    let createRuleGroupResponse = await this.service.createRuleGroup(ruleGroupObject);
    ruleGroupReference.ResourceArn = createRuleGroupResponse.RuleGroupResponse.RuleGroupArn;
    Logger.log(LOG_LEVEL.INFO, ruleGroupReference);
    Logger.log(LOG_LEVEL.INFO, `Create Rule group response`, createRuleGroupResponse);
  }

  private async handleStatefulRuleGroupReferences(
    policyObject: NetworkFirewall.CreateFirewallPolicyRequest,
    statefulRuleGroupsForRollback: NetworkFirewall.DescribeRuleGroupResponse[]
  ) {
    if (!policyObject.FirewallPolicy.StatefulRuleGroupReferences) {
      return;
    }
    for (let statefulRuleGroupReference of policyObject.FirewallPolicy.StatefulRuleGroupReferences) {
      let statefulRuleGroupObject: NetworkFirewall.CreateRuleGroupRequest = this.fileHandler.convertFileToObject(
        statefulRuleGroupReference.ResourceArn
      );
      if (statefulRuleGroupObject.Rules) {
        statefulRuleGroupObject.Rules = this.fileHandler.copyFileContentToString(statefulRuleGroupObject.Rules);
      }
      Logger.log(LOG_LEVEL.INFO, `Checking if stateful rule group exists: ${statefulRuleGroupObject.RuleGroupName}`);
      let describeRuleGroupResponse = await this.service.describeRuleGroup(
        statefulRuleGroupObject.RuleGroupName,
        RuleGroupType.Stateful
      );
      Logger.log(LOG_LEVEL.INFO, `Describe Rule group response`, describeRuleGroupResponse);
      if (describeRuleGroupResponse) {
        statefulRuleGroupsForRollback.push(describeRuleGroupResponse);
        //if its a suricata rule group just update the statefulRuleGroupObject.Rules
        if (statefulRuleGroupObject.Rules) {
          await this.service.updateRuleGroup({
            UpdateToken: describeRuleGroupResponse.UpdateToken,
            Description: statefulRuleGroupObject.Description,
            RuleGroupArn: describeRuleGroupResponse.RuleGroupResponse.RuleGroupArn,
            Rules: statefulRuleGroupObject.Rules,
            Type: statefulRuleGroupObject.Type,
          });
        } else {
          await this.service.updateRuleGroup({
            UpdateToken: describeRuleGroupResponse.UpdateToken,
            Description: statefulRuleGroupObject.Description,
            RuleGroup: statefulRuleGroupObject.RuleGroup,
            RuleGroupArn: describeRuleGroupResponse.RuleGroupResponse.RuleGroupArn,
            Type: statefulRuleGroupObject.Type,
          });
        }

        statefulRuleGroupReference.ResourceArn = describeRuleGroupResponse.RuleGroupResponse.RuleGroupArn;
        Logger.log(LOG_LEVEL.INFO, `Found existing stateful rule group, trying to update it.`);
      } else {
        await this.createStatefulRuleGroup(statefulRuleGroupObject, statefulRuleGroupReference);
      }
    }
  }

  private async createStatefulRuleGroup(
    statefulRuleGroupObject: NetworkFirewall.CreateRuleGroupRequest,
    statefulRuleGroupReference: NetworkFirewall.StatefulRuleGroupReference
  ) {
    Logger.log(LOG_LEVEL.INFO, `Creating rule group`);
    let createRuleGroupResponse = await this.service.createRuleGroup(statefulRuleGroupObject);
    statefulRuleGroupReference.ResourceArn = createRuleGroupResponse.RuleGroupResponse.RuleGroupArn;
    Logger.log(LOG_LEVEL.INFO, statefulRuleGroupReference);
    Logger.log(LOG_LEVEL.INFO, `Create Rule group response`, createRuleGroupResponse);
  }

  private async rollbackRuleGroups(
    statelessRuleGroupsForRollback: NetworkFirewall.DescribeRuleGroupResponse[],
    statefulRuleGroupsForRollback: NetworkFirewall.DescribeRuleGroupResponse[]
  ) {
    for (let statelessRuleGroup of statelessRuleGroupsForRollback) {
      Logger.log(LOG_LEVEL.WARN, `Rolling back stateless rule group`, statelessRuleGroup);
      await this.service.updateRuleGroup(statelessRuleGroup);
    }
    Logger.log(LOG_LEVEL.WARN, `Rolling back stateful rule groups`, statefulRuleGroupsForRollback);
    for (let statefulRuleGroup of statefulRuleGroupsForRollback) {
      Logger.log(LOG_LEVEL.WARN, `Rolling back stateful rule group`, statefulRuleGroup);
      await this.service.updateRuleGroup(statefulRuleGroup);
    }
  }

  /**
   * This method will take the rule groups configured for the firewall before any updates are made and compare with all the rule groups which are in the firewall policy file,
   * the missing rule groups in the firewall policy file will be deleted, if the rule groups are associated with any resource in the account out of scope of this
   * solution then the rule group will not be deleted.
   * @param policyObject -- NetworkFirewall.CreateFirewallPolicyRequest
   */
  async deleteRuleGroups(policyObject: NetworkFirewall.CreateFirewallPolicyRequest) {
    await this.delay(Time.Seconds15);
    Logger.log(LOG_LEVEL.DEBUG, `The rule groups currently configured  in the firewall `, this.ruleGroupArnsInFirewall);
    //retrieve the rule groups in policy Object
    let ruleGroupsInFirewallPolicyFile: { [key: string]: string } = {};
    if (policyObject.FirewallPolicy.StatefulRuleGroupReferences) {
      for (let ruleGroup of policyObject.FirewallPolicy.StatefulRuleGroupReferences) {
        ruleGroupsInFirewallPolicyFile[ruleGroup.ResourceArn] = ruleGroup.ResourceArn;
      }
    }
    if (policyObject.FirewallPolicy.StatelessRuleGroupReferences) {
      for (let ruleGroup of policyObject.FirewallPolicy.StatelessRuleGroupReferences) {
        ruleGroupsInFirewallPolicyFile[ruleGroup.ResourceArn] = ruleGroup.ResourceArn;
      }
    }

    Logger.log(
      LOG_LEVEL.DEBUG,
      `The rule groups configured  in the new firewall policy file `,
      ruleGroupsInFirewallPolicyFile
    );
    for (let oldRuleGroupArn of this.ruleGroupArnsInFirewall) {
      if (!ruleGroupsInFirewallPolicyFile[oldRuleGroupArn]) {
        await this.service.deleteRuleGroup(oldRuleGroupArn);
      }
    }
  }

  /*
   * This method will setup the logging configuration for the firewall, based on the environment properties in EnvironmentProps.
   * If there is any error in updating the logging configurations it will log a warning and still continue the rest of the process.
   */
  async setupLoggingConfigurations(firewallName: string) {
    let loggingConfiguration = await this.createLoggingConfigurations();
    try {
      await this.service.updateLoggingConfiguration(firewallName, {
        LogDestinationConfigs: loggingConfiguration,
      });
    } catch (error) {
      Logger.log(LOG_LEVEL.INFO, `Logging configuration: `, loggingConfiguration);
      Logger.log(LOG_LEVEL.ERROR, `Failed to update logging configuration`, error);
    }
  }

  async createLoggingConfigurations() {
    let loggingConfiguration = [];
    Logger.log(LOG_LEVEL.INFO, this.envProps);
    if (this.envProps.logType && this.envProps.logType.toUpperCase() === 'ENABLEBOTH') {
      let alertConfig = {
        LogType: LogType.alert,
        LogDestinationType: '',
        LogDestination: {},
      };
      let flowConfig = {
        LogType: LogType.flow,
        LogDestinationType: '',
        LogDestination: {},
      };
      loggingConfiguration.push(alertConfig);
      loggingConfiguration.push(flowConfig);
    } else {
      let config = {
        LogType: this.envProps.logType ? this.envProps.logType.toUpperCase() : LogType.alert,
        LogDestinationType: '',
        LogDestination: {},
      };
      loggingConfiguration.push(config);
    }

    loggingConfiguration.forEach(config => {
      switch (this.envProps.logDestinationType?.toUpperCase()) {
        case 'S3':
          config.LogDestinationType = 'S3';
          config.LogDestination = {
            bucketName: this.envProps.logDestination,
            prefix: config.LogType === LogType.alert ? 'alerts' : 'flow',
          };
          break;
        case 'CLOUDWATCHLOGS':
          config.LogDestinationType = 'CloudWatchLogs';
          config.LogDestination = {
            logGroup: this.envProps.logDestination,
          };
          break;
      }
    });
    Logger.log(LOG_LEVEL.INFO, loggingConfiguration);
    return Promise.resolve(loggingConfiguration);
  }

  /**
   * Update firewall properties if they are different from the describeFirewallResponse.
   * Following attributes are updated.
   * DeleteProtection, FirewallPolicyChangeProtection, Description.
   * Associates a new firewall policy arn if the describeFirewallResponse
   * and the firewallPolicyArn parameter are not same.
   */
  async updateFirewall(
    describeFirewallResponse: NetworkFirewall.Types.DescribeFirewallResponse,
    firewallPolicyArn: string
  ) {
    if (!describeFirewallResponse.Firewall) {
      return;
    }

    await this.updateFirewallDeleteProtection(describeFirewallResponse);

    await this.updateFirewallPolicyChangeProtection(describeFirewallResponse);

    await this.updateSubnetChangeProtection(describeFirewallResponse);

    await this.updateFirewallDescription(describeFirewallResponse);

    await this.associateFirewallPolicyArn(describeFirewallResponse, firewallPolicyArn);

    await this.addTagsToFirewall(describeFirewallResponse);
  }

  private async addTagsToFirewall(describeFirewallResponse: NetworkFirewall.DescribeFirewallResponse) {
    if (this.firewallObject.Tags && describeFirewallResponse.Firewall?.FirewallArn) {
      const response = await this.service.tagResource({
        ResourceArn: describeFirewallResponse.Firewall.FirewallArn,
        Tags: this.firewallObject.Tags,
      });
      Logger.log(
        LOG_LEVEL.INFO,
        `Update Tags for firewall ${this.firewallObject.FirewallPolicyArn} for the firewall name: ${this.firewallObject.FirewallName} response:`,
        response
      );
    }
  }

  private async updateFirewallDeleteProtection(describeFirewallResponse: NetworkFirewall.DescribeFirewallResponse) {
    if (describeFirewallResponse.Firewall?.DeleteProtection !== this.firewallObject.DeleteProtection) {
      const response = await this.service.updateFirewallDeleteProtection({
        FirewallName: this.firewallObject.FirewallName,
        DeleteProtection: this.firewallObject.DeleteProtection ? this.firewallObject.DeleteProtection : false,
      });
      Logger.log(LOG_LEVEL.INFO, 'Update firewall delete protection response: ', response);
    }
  }

  private async updateFirewallPolicyChangeProtection(
    describeFirewallResponse: NetworkFirewall.DescribeFirewallResponse
  ) {
    if (
      describeFirewallResponse.Firewall?.FirewallPolicyChangeProtection !==
      this.firewallObject.FirewallPolicyChangeProtection
    ) {
      const response = await this.service.updateFirewallPolicyChangeProtection({
        FirewallName: this.firewallObject.FirewallName,
        FirewallPolicyChangeProtection: this.firewallObject.FirewallPolicyChangeProtection
          ? this.firewallObject.FirewallPolicyChangeProtection
          : false,
      });
      Logger.log(LOG_LEVEL.INFO, 'Update firewall policy change protection response: ', response);
    }
  }

  private async updateSubnetChangeProtection(describeFirewallResponse: NetworkFirewall.DescribeFirewallResponse) {
    if (describeFirewallResponse.Firewall?.SubnetChangeProtection !== this.firewallObject.SubnetChangeProtection) {
      const response = await this.service.updateSubnetChangeProtection({
        FirewallName: this.firewallObject.FirewallName,
        SubnetChangeProtection: this.firewallObject.SubnetChangeProtection
          ? this.firewallObject.SubnetChangeProtection
          : false,
      });
      Logger.log(LOG_LEVEL.INFO, 'Update firewall policy change protection response: ', response);
    }
  }

  private async updateFirewallDescription(describeFirewallResponse: NetworkFirewall.DescribeFirewallResponse) {
    if (describeFirewallResponse.Firewall?.Description !== this.firewallObject.Description) {
      const response = await this.service.updateFirewallDescription({
        Description: this.firewallObject.Description,
        FirewallName: this.firewallObject.FirewallName,
      });
      Logger.log(LOG_LEVEL.INFO, 'Update firewall description response: ', response);
    }
  }

  private async associateFirewallPolicyArn(
    describeFirewallResponse: NetworkFirewall.DescribeFirewallResponse,
    firewallPolicyArn: string
  ) {
    if (describeFirewallResponse.Firewall?.FirewallPolicyArn !== firewallPolicyArn) {
      const response = await this.service.associateFirewallPolicy({
        FirewallPolicyArn: firewallPolicyArn,
        FirewallName: this.firewallObject.FirewallName,
      });
      Logger.log(
        LOG_LEVEL.INFO,
        `associate/update new firewall policy ${this.firewallObject.FirewallPolicyArn} for the firewall name: ${this.firewallObject.FirewallName} response:`,
        response
      );
    }
  }
}
