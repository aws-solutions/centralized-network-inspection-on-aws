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
import { SynthUtils } from '@aws-cdk/assert';
import * as NetworkFirewallAutomationStack from "../lib/network-firewall-automation-solution-stack"
import '@aws-cdk/assert/jest';


function getTestStack(): cdk.Stack {
    const app = new cdk.App();
    const props: NetworkFirewallAutomationStack.NetworkFirewallAutomationStackProps = {
        env: { account: '1234', region: 'eu-west-1' },
        solutionBucket: 'solutions',
        solutionId: 'SO0108',
        solutionName: 'network-firewall-automation',
        solutionProvider: 'AWS Solutions Builders',
        solutionTradeMarkName: 'network-firewall-automation',
        solutionVersion: 'v1.0.0'
    };
    return new NetworkFirewallAutomationStack.NetworkFirewallAutomationStack(app, 'MyTestStack', props)
}
/*
 * Snapshot test
 */
test('NetworkFirewallAutomationStack Snapshot test', () => {
    expect(SynthUtils.toCloudFormation(getTestStack())).toMatchSnapshot();
});