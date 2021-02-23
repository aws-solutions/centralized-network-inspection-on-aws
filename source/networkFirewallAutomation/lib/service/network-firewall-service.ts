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

import { ConfigurationOptions, NetworkFirewall } from 'aws-sdk'
import { AwsClientConfig, Count } from './awsClientConfig'
import { LOG_LEVEL, Logger } from '../common/logger'

/**
 * Service class which handles all the Network Firewall API integrations.
 */
export class NetworkFirewallService {

  private NetworkFirewallInstance: NetworkFirewall
  config: ConfigurationOptions
  count: number

  constructor() {
    this.config = new AwsClientConfig().retry()
    this.count = 0
    this.NetworkFirewallInstance = new NetworkFirewall(this.config);
  }

  /** Creates Firewall configurations returns an void/undefined if the firewall doesn't not exist.  */
  async createFirewall(props: NetworkFirewall.CreateFirewallRequest) {
    Logger.log(LOG_LEVEL.INFO, 'Creating Firewall')
    Logger.log(LOG_LEVEL.INFO, `Print Props: ${JSON.stringify(props)}`)
    try {
      const response = await this.NetworkFirewallInstance.createFirewall(props).promise()
      return Promise.resolve(response)
    } catch (e) {
      if (e.code === "ResourceNotFoundException") {
        Logger.log(LOG_LEVEL.INFO, "Firewall Not Found")
        return
      }
      return Promise.reject(e)
    }
  }

  /** Creates a firewall policy and returns the response object received
   *  from the Network Firewall API. */
  async createFirewallPolicy(props: NetworkFirewall.CreateFirewallPolicyRequest) {
    Logger.log(LOG_LEVEL.INFO, 'Creating Firewall Policy')
    Logger.log(LOG_LEVEL.INFO, `Print Props: ${JSON.stringify(props)}`)
    return await this.NetworkFirewallInstance.createFirewallPolicy(props).promise()
  }

  /** Creates a rule group and returns the response object received from the Network Firewall API */
  async createRuleGroup(props: NetworkFirewall.CreateRuleGroupRequest) {
    Logger.log(LOG_LEVEL.INFO, 'Creating Firewall Rule Group')
    Logger.log(LOG_LEVEL.INFO, `Print createRuleGroup Props`)
    Logger.log(LOG_LEVEL.INFO, props)
    return await this.NetworkFirewallInstance.createRuleGroup(props).promise()
  }

  /** Describes the firewall based on the input param firewallName, return void/undefined if there is not firewall with the firewall Name defined. */
  async describeFirewall(firewallName: string): Promise<NetworkFirewall.Types.DescribeFirewallResponse | void> {
    Logger.log(LOG_LEVEL.INFO, 'Describe Firewall')
    Logger.log(LOG_LEVEL.INFO, `Print Firewall Name: ${firewallName}`)
    try {
      const response = await this.NetworkFirewallInstance.describeFirewall({
        FirewallName: firewallName
      }
      ).promise()
      return Promise.resolve(response)
    } catch (error) {
      Logger.log(LOG_LEVEL.INFO, JSON.stringify(error))
      if (error.code === "ResourceNotFoundException") {
        Logger.log(LOG_LEVEL.INFO, "Firewall Not Found.")
        return Promise.resolve()
      }
      return Promise.reject(error)
    }
  }

  /** Describes the firewall policy and returns void/undefined if there is no firewall policy with the Name and/or Arn defined */
  async describeFirewallPolicy(firewallPolicyName: string): Promise<NetworkFirewall.Types.DescribeFirewallPolicyResponse | void> {
    try {
      const response = await this.NetworkFirewallInstance.describeFirewallPolicy({
        FirewallPolicyName: firewallPolicyName
      }).promise();
      return Promise.resolve(response)
    } catch (error) {
      Logger.log(LOG_LEVEL.INFO, JSON.stringify(error))
      if (error.code === "ResourceNotFoundException") {
        Logger.log(LOG_LEVEL.INFO, "Firewall Policy Not Found.")
        return Promise.resolve()
      }
      return Promise.reject(error)
    }
  }

  /** Describes the rule group and returns an rule response object from the api, return void/undefined in case none is found, the
   *  method will retry API calls for a maximum of Count.minRetry value.
   */
  async describeRuleGroup(RuleGroupName: string, Type: string): Promise<NetworkFirewall.DescribeRuleGroupResponse | void> {
    do {
      try {
        Logger.log(LOG_LEVEL.INFO, `Describing Rule Group: ${RuleGroupName} | Type: ${Type}`)
        const response = await this.NetworkFirewallInstance.describeRuleGroup({
          RuleGroupName: RuleGroupName,
          Type: Type
        }
        ).promise()
        return Promise.resolve(response)
      } catch (error) {
        Logger.log(LOG_LEVEL.INFO, JSON.stringify(error))
        if (error.message === "ThrottlingException") {
          this.count++ //increment the count
          Logger.log(LOG_LEVEL.INFO, `Caught throttling exception, trying count: ${this.count}`)
        }
        if (error.code === "ResourceNotFoundException") {
          Logger.log(LOG_LEVEL.INFO, "Rule Group Not Found.")
          return Promise.resolve()
        }
        return Promise.reject(error)
      }
    } while (this.count == Count.minRetry)
  }

  /** Associates the firewall policy to the firewall. */
  async associateFirewallPolicy(request: NetworkFirewall.AssociateFirewallPolicyRequest) {
    try {
      return await this.NetworkFirewallInstance.associateFirewallPolicy(request).promise()
    } catch (error) {
      Logger.log(LOG_LEVEL.DEBUG, error)
      return Promise.reject(error)
    }
  }

  /** associate tags to the firewall resource. */
  async tagResource(request: NetworkFirewall.Types.TagResourceRequest) {
    try {
      return await this.NetworkFirewallInstance.tagResource(request).promise()
    } catch (error) {
      Logger.log(LOG_LEVEL.ERROR, `Failed to update tags for the firewall ${error}`)
      // returning resolve to avoid pipeline failure due to tag change failure.
      return Promise.resolve()
    }
  }

  /** Updates the firewall policy and will override any configurations done to  the firewall policy in the AWS console. Method will attempt multiple updates to the
   * firewall policy until successful.
    */
  async updateFirewallPolicy(request: NetworkFirewall.Types.UpdateFirewallPolicyRequest) {
    do {
      try {
        return await this.NetworkFirewallInstance.updateFirewallPolicy(request).promise()
      } catch (error) {
        if (error['message'] === 'Update token is invalid.') {
          const describeResponse = await this.NetworkFirewallInstance.describeFirewallPolicy({
            FirewallPolicyName: request.FirewallPolicyName
          }).promise()
          request.UpdateToken = describeResponse.UpdateToken
        } else {
          Logger.log(LOG_LEVEL.DEBUG, error)
          return Promise.reject(error)
        }
      }
    } while (request.UpdateToken)
    return Promise.resolve()
  }

  async updateRuleGroup(updateRuleGroupRequest: NetworkFirewall.Types.UpdateRuleGroupRequest) {
    let updateResponse;
    do {
      try {
        updateResponse = await this.NetworkFirewallInstance.updateRuleGroup(updateRuleGroupRequest).promise();
        updateRuleGroupRequest.UpdateToken = ''
      } catch (error) {
        if (error['message'] == 'Update token is invalid.') {
          const describeResponse = await this.NetworkFirewallInstance.describeRuleGroup({ RuleGroupArn: updateRuleGroupRequest.RuleGroupArn }).promise()
          updateRuleGroupRequest.UpdateToken = describeResponse.UpdateToken
        } else {
          Logger.log(LOG_LEVEL.INFO, `Error while trying to update the rule group ${updateRuleGroupRequest}: ${error}`)
          return Promise.reject(error)
        }
      }
    } while (updateRuleGroupRequest.UpdateToken)
    Logger.log(LOG_LEVEL.INFO, `update response ${JSON.stringify(updateResponse)}`)
    return Promise.resolve(updateResponse);
  }

  /**
   * Update the firewall description.
   * @param request NetworkFirewall.Types.UpdateFirewallDescriptionRequest
   */
  async updateFirewallDescription(request: NetworkFirewall.Types.UpdateFirewallDescriptionRequest) {
    try {
      return await this.NetworkFirewallInstance.updateFirewallDescription(request).promise();
    } catch (error) {
      Logger.log(LOG_LEVEL.DEBUG, error)
      return Promise.reject(error)
    }
  }
  /**
   * Update the firewall delete protection attribute.
   * @param request NetworkFirewall.Types.UpdateFirewallDeleteProtectionRequest
   */
  async updateFirewallDeleteProtection(request: NetworkFirewall.Types.UpdateFirewallDeleteProtectionRequest) {
    try {
      return await this.NetworkFirewallInstance.updateFirewallDeleteProtection(request).promise();
    } catch (error) {
      Logger.log(LOG_LEVEL.DEBUG, error)
      return Promise.reject(error)
    }
  }

  /**
   * Update the firewall policy change protection attribute.
   * @param request NetworkFirewall.Types.UpdateFirewallPolicyChangeProtectionRequest
   */
  async updateFirewallPolicyChangeProtection(request: NetworkFirewall.Types.UpdateFirewallPolicyChangeProtectionRequest) {
    try {
      return await this.NetworkFirewallInstance.updateFirewallPolicyChangeProtection(request).promise();
    } catch (error) {
      Logger.log(LOG_LEVEL.DEBUG, error)
      return Promise.reject(error)
    }
  }
  /**
   * Update the subnet change protection attribute.
   * @param request NetworkFirewall.Types.UpdateSubnetChangeProtectionRequest
   */
  async updateSubnetChangeProtection(request: NetworkFirewall.Types.UpdateSubnetChangeProtectionRequest) {
    try {
      return await this.NetworkFirewallInstance.updateSubnetChangeProtection(request).promise();
    } catch (error) {
      Logger.log(LOG_LEVEL.DEBUG, error)
      return Promise.reject(error)
    }
  }

  async updateLoggingConfiguration(firewallName: string, loggingConfiguration: NetworkFirewall.Types.LoggingConfiguration) {
    Logger.log(LOG_LEVEL.INFO, loggingConfiguration)
    let describeFirewallLoggingResponse
    try {
      describeFirewallLoggingResponse = await this.NetworkFirewallInstance.describeLoggingConfiguration({
        FirewallName: firewallName
      }).promise()
      Logger.log(LOG_LEVEL.INFO, describeFirewallLoggingResponse);
      //cleaning up the configuration stack currently in the firewall.
      while (describeFirewallLoggingResponse.LoggingConfiguration && describeFirewallLoggingResponse.LoggingConfiguration.LogDestinationConfigs.length > 0) {

        Logger.log(LOG_LEVEL.INFO, describeFirewallLoggingResponse)
        if (describeFirewallLoggingResponse.LoggingConfiguration) {
          describeFirewallLoggingResponse.LoggingConfiguration.LogDestinationConfigs.pop()
        }

        describeFirewallLoggingResponse = await this.NetworkFirewallInstance.updateLoggingConfiguration(describeFirewallLoggingResponse).promise()
      }

      for (let config of loggingConfiguration.LogDestinationConfigs) {
        describeFirewallLoggingResponse.LoggingConfiguration?.LogDestinationConfigs.push(config)
        describeFirewallLoggingResponse = await this.NetworkFirewallInstance.updateLoggingConfiguration(describeFirewallLoggingResponse).promise()
      }

      Logger.log(LOG_LEVEL.INFO, describeFirewallLoggingResponse)
    } catch (error) {
      Logger.log(LOG_LEVEL.INFO, `Failed to update firewall logging configuration`, error)
      return Promise.resolve()
    }
    return Promise.resolve(describeFirewallLoggingResponse)
  }

  async listRuleGroupsForPolicy(firewallPolicyName: string): Promise<string[]> {
    let ruleGroupArns: string[] = [];
    let response;

    try {
      response = await this.NetworkFirewallInstance.describeFirewallPolicy({ FirewallPolicyName: firewallPolicyName }).promise();
      if (response && response.FirewallPolicy) {
        response.FirewallPolicy?.StatefulRuleGroupReferences?.forEach((ruleGroup) => {
          ruleGroupArns.push(ruleGroup.ResourceArn)
        })
        response.FirewallPolicy?.StatelessRuleGroupReferences?.forEach((ruleGroup) => {
          ruleGroupArns.push(ruleGroup.ResourceArn)
        })
      } else {
        Logger.log(LOG_LEVEL.INFO, `No firewall policy of the name: ${firewallPolicyName}`)
        return Promise.resolve([])
      }
      return Promise.resolve(ruleGroupArns)
    } catch (error) {
      Logger.log(LOG_LEVEL.INFO, `Error trying to retrieve current rule groups configured ${JSON.stringify(error)}`)
      return Promise.resolve([])
    }

  }

  async deleteRuleGroup(ruleGroupArn: string) {
    try {
      await this.NetworkFirewallInstance.deleteRuleGroup({ RuleGroupArn: ruleGroupArn }).promise()
    } catch (error) {
      Logger.log(LOG_LEVEL.INFO, `Unable to delete rule group ${JSON.stringify(error)}`)
    }
  }

}
