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

import { FirewallConfigValidation } from "../lib/common/firewall-config-validation"

jest.mock("aws-sdk", () => {
    return {
        __esModule: true,
        NetworkFirewall: jest.fn().mockReturnValue({
            createRuleGroup: jest.fn().mockImplementation(() => {
                //console.log(`Inside rule group mock ${JSON.stringify(data)}` )
            }),
            createFirewallPolicy: jest.fn().mockImplementation(() => {
                //console.log(`Inside firewall policy mock ${JSON.stringify(data)}` )
            }),
        })
    }
})

test('test firewall config validation.', async () => {
    const firewallConfigValidation = new FirewallConfigValidation();
    try {
        await firewallConfigValidation.execute("/__tests__/firewall-test-configuration/firewalls/")
    } catch (error) {
        expect(firewallConfigValidation.getInvalidFiles()).toStrictEqual([
                { 
                    "path": "__tests__/firewall-test-configuration/ruleGroups/stateless-fwd-to-stateful.invalid.json",
                    "referencedInFile": "__tests__/firewall-test-configuration/firewallPolicies/firewall-invalid-policy.json",
                    "error": "The file in the attribute path is not available in the configuration." 
                },
                {
                    "path": "__tests__/firewall-test-configuration/firewallPolicies/firewall-notavailable.json",
                    "referencedInFile": "__tests__/firewall-test-configuration/firewallPolicies/firewall-notavailable.json",
                    "error": "The file in the attribute path is not available in the configuration." 
                }
            ])
    }

})