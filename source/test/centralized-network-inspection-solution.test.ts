/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import {
  CentralizedNetworkInspectionStack,
  CentralizedNetworkInspectionStackProps,
} from '../lib/centralized-network-inspection.stack';

function getTestStack(): Stack {
  const app = new App();
  const props: CentralizedNetworkInspectionStackProps = {
    env: { account: '1234', region: 'eu-west-1' },
    solutionBucket: 'solutions',
    solutionId: 'SO0108',
    solutionName: 'centralized-network-inspection',
    solutionProvider: 'AWS Solutions Builders',
    solutionTradeMarkName: 'centralized-network-inspection',
    solutionVersion: 'v1.0.3',
  };
  return new CentralizedNetworkInspectionStack(app, 'MyTestStack', props);
}

describe('Centralized Network Inspection on AWS', () => {
  const stack = getTestStack();
  const template = Template.fromStack(stack);
  /*
   * Snapshot test
   */
  test('centralizedNetworkInspectionStack Snapshot test', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});
