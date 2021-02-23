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

/**
 * @description
 * AWS Network Firewall Manager Solution
 * @author aws-solutions
 */

import {
  EnvironmentProps,
  NetworkFirewallManager
} from "./lib/network-firewall-manager"
import {
  Ec2EnvironmentProps,
  Ec2Manager
} from "./lib/ec2-manager"
import { ConfigReader, ConfigPath } from "./lib/common/configReader/config-reader"
import { Logger, LOG_LEVEL } from "./lib/common/logger"


async function firewallManager() {

  // declare environment variables
  let envProps: EnvironmentProps = {
    vpcId: process.env.VPC_ID,
    subnetIds: process.env.SUBNET_IDS,
    logDestinationType: process.env.LOG_DESTINATION_TYPE, //S3 or CloudWatchLogs
    logDestination: process.env.S3_LOG_BUCKET_NAME !== 'NotConfigured' ? process.env.S3_LOG_BUCKET_NAME : process.env.CLOUDWATCH_LOG_GROUP_NAME, //S3 bucket name or CloudWatchLogs group name
    logType: process.env.LOG_TYPE, //ALERT OR FLOW
    logRetentionPeriod: process.env.LOG_RETENTION_IN_DAYS,
    stackId: process.env.STACK_ID ? process.env.STACK_ID : ""
  }

  const transitGatewayAttachmentId = process.env.TRANSIT_GATEWAY_ATTACHMENT_ID ? process.env.TRANSIT_GATEWAY_ATTACHMENT_ID : "";
  const applianceMode = process.env.TRANSIT_GATEWAY_ATTACHMENT_APPLIANCE_MODE ? process.env.TRANSIT_GATEWAY_ATTACHMENT_APPLIANCE_MODE : "enable";
  Ec2Manager.updateTransitGatewayAttachementApplianceMode(transitGatewayAttachmentId, applianceMode);
  

  let ec2EnvProps: Ec2EnvironmentProps[] = [
    {
    availabilityZone: process.env.VPC_TGW_ATTACHMENT_AZ_1,
    routeTableId: process.env.VPC_TGW_ATTACHMENT_ROUTE_TABLE_ID_1
    },
    {
      availabilityZone: process.env.VPC_TGW_ATTACHMENT_AZ_2,
      routeTableId: process.env.VPC_TGW_ATTACHMENT_ROUTE_TABLE_ID_2
    }]

  try {
    const currentPath = process.cwd()
    const directoryPath = currentPath.concat(ConfigPath.firewallDirectory)

    const fileHandler = new ConfigReader()
    const firewallFiles = fileHandler.getJSONFileNames(directoryPath)

    for (let filePath of firewallFiles) {

      Logger.log(LOG_LEVEL.INFO, `Processing ${filePath}`)
      let firewallObject = fileHandler.convertFileToObject(filePath)
      Logger.log(LOG_LEVEL.INFO, firewallObject)
      let firewallMgr = new NetworkFirewallManager(envProps, firewallObject, fileHandler)
      const syncStates = await firewallMgr.firewallOperations()
      Logger.log(LOG_LEVEL.INFO, syncStates)
      Logger.log(LOG_LEVEL.INFO, `Creating route to firewall endpoint.`)
      if (syncStates) {
        const ec2Mgr = new Ec2Manager(ec2EnvProps, syncStates)
        await ec2Mgr.routeTableOperations()
      }
    }
  } catch (error) {
    Logger.log(LOG_LEVEL.ERROR, `Failed to deploy/update Network Firewall`, error)
    process.exit(1)
  }
}

// Initiating Network Firewall Manager Solution
firewallManager()