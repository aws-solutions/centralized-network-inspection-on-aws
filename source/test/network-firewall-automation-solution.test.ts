/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import {
  NetworkFirewallAutomationStack,
  NetworkFirewallAutomationStackProps,
} from '../lib/network-firewall-automation-solution-stack';

function getTestStack(): Stack {
  const app = new App();
  const props: NetworkFirewallAutomationStackProps = {
    env: { account: '1234', region: 'eu-west-1' },
    solutionBucket: 'solutions',
    solutionId: 'SO0108',
    solutionName: 'network-firewall-automation',
    solutionProvider: 'AWS Solutions Builders',
    solutionTradeMarkName: 'network-firewall-automation',
    solutionVersion: 'v1.0.3',
  };
  return new NetworkFirewallAutomationStack(app, 'MyTestStack', props);
}

describe('Firewall Automation for Network Traffic on AWS', () => {
  const stack = getTestStack();
  const template = Template.fromStack(stack);
  /*
   * Snapshot test
   */
  test('NetworkFirewallAutomationStack Snapshot test', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});
