#!/usr/bin/env node
 /*
  * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
  * SPDX-License-Identifier: Apache-2.0
  */

import { App, DefaultStackSynthesizer } from 'aws-cdk-lib';
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

const app = new App();

let NetworkFirewallAutomationStackProperties: NetworkFirewallAutomationStackProps = {
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false
  }),
  solutionId: SOLUTION_ID,
  solutionTradeMarkName: SOLUTION_TMN,
  solutionProvider: SOLUTION_PROVIDER,
  solutionBucket: SOLUTION_BUCKET,
  solutionName: SOLUTION_NAME,
  solutionVersion: SOLUTION_VERSION,
  description: `(${SOLUTION_ID}) - The AWS CloudFormation template for deployment of the ${SOLUTION_NAME}, Version: ${SOLUTION_VERSION}`
};

new NetworkFirewallAutomationStack(
  app,
  'firewall-automation-for-network-traffic-on-aws',
  NetworkFirewallAutomationStackProperties
);
