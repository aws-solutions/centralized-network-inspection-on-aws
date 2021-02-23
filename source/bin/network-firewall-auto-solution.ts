#!/usr/bin/env node
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
import {
  NetworkFirewallAutomationStack,
  NetworkFirewallAutomationStackProps
} from '../lib/network-firewall-automation-solution-stack';

const SOLUTION_VERSION = process.env['DIST_VERSION'];
const SOLUTION_NAME = process.env['SOLUTION_NAME'];
const SOLUTION_ID = process.env['SOLUTION_ID'] || 'SO0108';
const SOLUTION_BUCKET = process.env['DIST_OUTPUT_BUCKET'];
const SOLUTION_TMN = process.env['SOLUTION_TRADEMARKEDNAME'];
const SOLUTION_PROVIDER = 'AWS Solution Development';

const app = new cdk.App();

let NetworkFirewallAutomationStackProperties: NetworkFirewallAutomationStackProps = {
  solutionId: SOLUTION_ID,
  solutionTradeMarkName: SOLUTION_TMN,
  solutionProvider: SOLUTION_PROVIDER,
  solutionBucket: SOLUTION_BUCKET,
  solutionName: SOLUTION_NAME,
  solutionVersion: SOLUTION_VERSION,
  description: '(' + SOLUTION_ID + ') - The AWS CloudFormation template' +
    ' for deployment of the ' + SOLUTION_NAME + ', Version: ' + SOLUTION_VERSION,
}

new NetworkFirewallAutomationStack(app, 'aws-network-firewall-deployment-automations-for-aws-transit-gateway', NetworkFirewallAutomationStackProperties);
