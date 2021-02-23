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
import { MetricsManager } from "../lib/common/send-metrics"

jest.mock("aws-sdk", () => {
    return {
        __esModule: true,
        SSM: jest.fn().mockReturnValue({
            getParameter: jest.fn().mockImplementation((data) => {
                expect(data).toStrictEqual({ Name: 'network-firewall-solution-uuid-asds' })
                if ('network-firewall-solution-uuid-asds' === data["Name"]) {
                    return {
                        promise: jest.fn().mockReturnValue({
                            Parameter: {
                                Value: '5d358dfa-bc71-4a48-a00c-0931e8ec1456'
                            }
                        })
                    }
                } else {
                    return {
                        promise: jest.fn().mockReturnValue({
                            
                        })
                    }
                }
            })
        })
    }
}, { virtual: true });

jest.mock("uuid", () => {
    return {
        __esModule: true,
        v4: jest.fn().mockImplementation(() => {
            return '5d358dfa-bc71-4a48-a00c-0931e8ec1456'
        })
    }
}, { virtual: true });

jest.mock("axios", () => {
    return {
        __esModule: true,
        post: jest.fn().mockImplementation(() => {
            return {
                promise: jest.fn().mockReturnValue({

                })
            }
        })
    }
}, { virtual: true });

test('test sending the metrics when the uuid is already in the parameter store.', async () => {
    process.env.STACK_ID = 'asds'
    process.env.SEND_ANONYMOUS_METRICS = 'Yes'
    await MetricsManager.sendMetrics({
       numberOfFirewalls: 1,
       numberOfPolicies: 1,
       numberOfStatefulRuleGroups: 1,
       numberOfStatelessRuleGroups: 1,
       numberOfSuricataRules: 0
    })
})

