/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { NetworkFirewallService } from '../lib/service/network-firewall-service';

jest.mock(
  'aws-sdk',
  () => {
    return {
      __esModule: true,
      NetworkFirewall: jest.fn().mockReturnValue({
        deleteRuleGroup: jest.fn().mockImplementation(data => {
          expect(data['RuleGroupArn']).toBeDefined();
          return {
            promise: jest.fn().mockImplementation(() => {
              return Promise.resolve({
                ResourceArn: '',
                ResourceName: 'rg1',
                Description: '',
                UpdateToken: '',
                RulesSource: {},
              });
            }),
          };
        }),
        describeRuleGroup: jest.fn().mockImplementation(ruleGroup => {
          if (ruleGroup['RuleGroupName'] === 'ThrottlingException') {
            throw {
              message: 'ThrottlingException',
            };
          }
          if (ruleGroup['RuleGroupName'] === 'ResourceNotFoundException') {
            throw { code: 'ResourceNotFoundException' };
          }
          if (ruleGroup['RuleGroupName'] === 'Error') {
            return Promise.reject({
              message: 'Error',
            });
          }
          if (
            ruleGroup['RuleGroupArn'] ===
            'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2'
          ) {
            return {
              promise: jest.fn().mockReturnValue({
                UpdateToken: 'aaaa',
                RuleGroupResponse: {
                  RuleGroupArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2',
                  RuleGroupName: 'StatelessExample2',
                  RuleGroupId: 111,
                },
              }),
            };
          }
          return {
            promise: jest.fn().mockReturnValue({
              RuleGroup: {
                RuleVariables: {
                  IPSets: [
                    {
                      foo: {
                        Definition: [''],
                        Reference: 'AWS_ARN',
                      },
                    },
                  ],
                  PortSets: [
                    {
                      foo: {
                        Definition: [''],
                      },
                    },
                  ],
                },
                RulesSource: {
                  RulesString: '',
                  RulesSourceList: [
                    {
                      Targets: [''],
                      TargetType: [''],
                      GeneratedRulesType: '',
                    },
                  ],
                  StatefulRules: [
                    {
                      Action: '',
                      Header: {
                        Protocol: '',
                        Source: '',
                        SourcePort: '',
                        Direction: '',
                        Destination: '',
                        DestinationPort: '',
                      },
                      RuleOptions: [
                        {
                          Keyword: '',
                          Settings: [''],
                        },
                      ],
                    },
                  ],
                  StatelessRulesAndCustomActions: {
                    StatelessRules: [
                      {
                        RuleDefinition: {
                          MatchAttributes: {
                            Sources: [''],
                            Destinations: [''],
                            SourcePorts: [
                              {
                                FromPort: 0,
                                ToPort: 999,
                              },
                            ],
                            DestinationPorts: [
                              {
                                FromPort: 0,
                                ToPort: 999,
                              },
                            ],
                            Protocols: [0, 1, 2, 3],
                            TCPFlags: [
                              {
                                Flags: [''],
                                Masks: [''],
                              },
                            ],
                          },
                          Actions: [''],
                        },
                        Priority: 9999,
                      },
                    ],
                    CustomAction: {
                      PublishMetrics: {
                        Dimensions: [
                          {
                            Value: '',
                          },
                        ],
                      },
                    },
                  },
                },
              },
              RuleGroupResponse: {
                RuleGroupArn: '',
                RuleGroupName: '',
                RuleGroupId: '',
                Description: '',
                Type: '',
                Capacity: 9999,
                RuleGroupStatus: 'ACTIVE|DELETING|string',
                Tags: [
                  {
                    Key: '',
                    Value: '',
                  },
                ],
              },
              UpdateToken: 'aaa',
            }),
          };
        }),
        describeFirewallPolicy: jest.fn().mockImplementation(() => {
          return {
            promise: jest.fn().mockReturnValue({
              UpdateToken: 'aaaa',
              FirewallPolicyResponse: {
                FirewallPolicyName: 'test-firewall-policy',
                FirewallPolicyArn: '',
                FirewallPolicyId: '',
                Description: '',
                FirewallPolicyStatus: 'ACTIVE',
                Tags: [
                  {
                    Key: '',
                    Value: '',
                  },
                ],
              },
              FirewallPolicy: {
                StatelessRuleGroupReferences: [
                  {
                    ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2',
                    Priority: 999,
                  },
                ],
                StatelessDefaultActions: [''],
                StatelessFragmentDefaultActions: [''],
                StatelessCustomActions: [
                  {
                    ActionName: '',
                    CustomAction: {
                      PublishMetrics: {
                        Dimensions: [
                          {
                            Value: '',
                          },
                        ],
                      },
                    },
                  },
                ],
                StatefulRuleGroupReferences: [
                  {
                    ResourceArn: '',
                  },
                ],
              },
            }),
          };
        }),
        updateRuleGroup: jest.fn().mockImplementation(data => {
          if (data['UpdateToken'] === 'invalid token') {
            return {
              promise: jest.fn().mockReturnValue({
                message: 'Update token is invalid.',
              }),
            };
          }
          if (data['UpdateToken'] === 'error') {
            return {
              promise: jest.fn().mockReturnValue(Promise.reject()),
            };
          }

          return {
            promise: jest.fn().mockReturnValue({
              UpdateToken: '',
              RuleGroupResponse: {
                RuleGroupArn: '',
                RuleGroupName: '',
                RuleGroupId: '',
                Description: '',
                Type: '"STATELESS"|"STATEFUL"|string',
                Capacity: 999,
                RuleGroupStatus: '"ACTIVE"|"DELETING"|string',
                Tags: [
                  {
                    Key: '',
                    Value: '',
                  },
                ],
              },
            }),
          };
        }),
        updateFirewallPolicy: jest.fn().mockImplementation(data => {
          if (data && data['UpdateToken'] === 'test invalid token scenario') {
            throw {
              message: 'Update token is invalid.',
            };
          }
          if (data && data['UpdateToken'] === 'error') {
            throw {
              message: 'error',
            };
          }

          return {
            promise: jest.fn().mockReturnValue({
              UpdateToken: 'aaa',
              FirewallPolicyResponse: {
                FirewallPolicyName: '',
                FirewallPolicyArn: '',
                FirewallPolicyId: '',
                Description: '',
                FirewallPolicyStatus: '"ACTIVE"|"DELETING"|string',
                Tags: [
                  {
                    Key: '',
                    Value: '',
                  },
                ],
              },
            }),
          };
        }),
        listFirewalls: jest.fn().mockReturnValue({
          promise: jest.fn().mockReturnValue({}),
        }),
        createFirewall: jest.fn().mockImplementation(data => {
          if (data['Description'] === 'Error') {
            throw Error('ResourceNotFoundException');
          }
          return {
            promise: jest.fn().mockReturnValue({}),
          };
        }),
        createFirewallPolicy: jest.fn().mockReturnValue({
          promise: jest.fn().mockReturnValue({}),
        }),
        createRuleGroup: jest.fn().mockReturnValue({
          promise: jest.fn().mockReturnValue({}),
        }),
        describeFirewall: jest.fn().mockImplementation(data => {
          if (data['FirewallName'] === 'error') {
            throw Error('ResourceNotFoundException');
          }
          expect(data['FirewallName']).toBeDefined();
          return {
            promise: jest.fn().mockReturnValue({}),
          };
        }),
        describeLoggingConfiguration: jest.fn().mockReturnValue({
          promise: jest.fn().mockReturnValue({
            LoggingConfiguration: {
              LogDestinationConfigs: [
                {
                  LogType: 'ALERT',
                  LogDestinationType: 'CloudWatchLogs',
                  LogDestination: {
                    logGroup: 'centralized-network-inspection-solution',
                    prefix: 'alerts',
                  },
                },
              ],
            },
          }),
        }),
        updateLoggingConfiguration: jest.fn().mockImplementation(config => {
          if (config['LoggingConfiguration']['LogDestinationConfigs'][0] === undefined) {
            return {
              promise: jest.fn().mockReturnValue({
                LoggingConfiguration: {
                  LogDestinationConfigs: [],
                },
              }),
            };
          }
          if (config['LoggingConfiguration']['LogDestinationConfigs'][0]['LogDestinationType'] === 'CloudWatchLogs') {
            return {
              promise: jest.fn().mockReturnValue({
                LoggingConfiguration: {
                  LogDestinationConfigs: [],
                },
              }),
            };
          }

          return {
            promise: jest.fn().mockReturnValue({
              LoggingConfiguration: {
                LogDestinationConfigs: [config['LoggingConfiguration']['LogDestinationConfigs'][0]],
              },
            }),
          };
        }),
        associateFirewallPolicy: jest.fn().mockImplementation(data => {
          if (data && data['FirewallName'] === 'error') {
            throw {
              message: 'error',
            };
          }
          return { promise: jest.fn().mockReturnValue({}) };
        }),
        updateSubnetChangeProtection: jest.fn().mockImplementation(data => {
          if (data && data['FirewallName'] === 'error') {
            throw {
              message: 'error',
            };
          }
          return { promise: jest.fn().mockReturnValue({}) };
        }),
        updateFirewallDescription: jest.fn().mockImplementation(data => {
          if (data && data['FirewallName'] === 'error') {
            throw {
              message: 'error',
            };
          }
          return { promise: jest.fn().mockReturnValue({}) };
        }),
        updateFirewallPolicyChangeProtection: jest.fn().mockImplementation(data => {
          if (data && data['FirewallName'] === 'error') {
            throw {
              message: 'error',
            };
          }
          return { promise: jest.fn().mockReturnValue({}) };
        }),
        updateFirewallDeleteProtection: jest.fn().mockImplementation(data => {
          if (data && data['FirewallName'] === 'error') {
            throw {
              message: 'error',
            };
          }
          return { promise: jest.fn().mockReturnValue({}) };
        }),
      }),
    };
  },
  { virtual: true }
);

test('test describe firewall policy', async () => {
  const service = new NetworkFirewallService();
  await expect(service.describeFirewallPolicy('test-network-firewall')).resolves.toBeDefined();
});

test('test describe rule group', async () => {
  const service = new NetworkFirewallService();
  await expect(service.describeRuleGroup('test-stateless-rg1', 'STATEFUL')).resolves.toBeDefined();
});

test('test describe rule group throttling error response', async () => {
  const service = new NetworkFirewallService();
  await expect(service.describeRuleGroup('ThrottlingException', 'STATEFUL')).rejects.toStrictEqual({
    message: 'Unable to resolve request and completed retries.',
  });
});
test('test describe rule group resource not found exception response', async () => {
  const service = new NetworkFirewallService();
  await expect(service.describeRuleGroup('ResourceNotFoundException', 'STATEFUL')).resolves.toBeUndefined();
});

test('create firewall ', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.createFirewall({
      FirewallName: 'VpcFirewall-1',
      FirewallPolicyArn: '__tests__/firewall-test-configuration/firewallPolicies/firewall-policy.example.json',
      Description: 'Network Firewall created by AWS Solutions',
      DeleteProtection: true,
      FirewallPolicyChangeProtection: true,
      SubnetChangeProtection: true,
      SubnetMappings: [],
      VpcId: '',
      Tags: [
        {
          Key: 'SampleKey',
          Value: 'SampleValue',
        },
      ],
    })
  ).resolves.toBeDefined();
});
test('create firewall handle error response from the sdk. ', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.createFirewall({
      FirewallName: 'VpcFirewall-1',
      FirewallPolicyArn: '__tests__/firewall-test-configuration/firewallPolicies/firewall-policy.example.json',
      Description: 'Error',
      DeleteProtection: true,
      FirewallPolicyChangeProtection: true,
      SubnetChangeProtection: true,
      SubnetMappings: [],
      VpcId: '',
      Tags: [
        {
          Key: 'SampleKey',
          Value: 'SampleValue',
        },
      ],
    })
  ).rejects.toThrowError('ResourceNotFoundException');
});

test('create Firewall policy', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.createFirewallPolicy({
      FirewallPolicyName: 'Firewall-Policy-1',
      FirewallPolicy: {
        StatelessDefaultActions: ['aws:drop'],
        StatelessFragmentDefaultActions: ['aws:drop'],
        StatelessRuleGroupReferences: [
          {
            Priority: 30,
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2',
          },
          {
            Priority: 20,
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1',
          },
        ],
        StatefulRuleGroupReferences: [
          {
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1',
          },
        ],
      },
    })
  ).resolves.toBeDefined();
});

test('create rule group', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.createRuleGroup({
      RuleGroupName: 'StatefulRulesExample1',
      RuleGroup: {
        RulesSource: {
          RulesSourceList: {
            Targets: ['test.example.com'],
            TargetTypes: ['HTTP_HOST', 'TLS_SNI'],
            GeneratedRulesType: 'DENYLIST',
          },
        },
      },
      Type: 'STATEFUL',
      Description: 'Stateful Rule3',
      Capacity: 100,
    })
  ).resolves.toBeDefined();
});

test(' describe firewall', async () => {
  const service = new NetworkFirewallService();
  await expect(service.describeFirewall('firewall-name')).resolves.toBeDefined();
});

test(' describe firewall handle sdk error', async () => {
  const service = new NetworkFirewallService();
  await expect(service.describeFirewall('error')).rejects.toThrowError('ResourceNotFoundException');
});

test('Update firewall policy ', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallPolicy({
      UpdateToken: '',
      FirewallPolicyArn: '',
      FirewallPolicyName: 'test',
      FirewallPolicy: {
        StatelessDefaultActions: ['aws:drop'],
        StatelessFragmentDefaultActions: ['aws:drop'],
        StatelessRuleGroupReferences: [
          {
            Priority: 30,
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2',
          },
          {
            Priority: 20,
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1',
          },
        ],
        StatefulRuleGroupReferences: [
          {
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1',
          },
        ],
      },
    })
  ).resolves.toBeDefined();
});

test('Update firewall policy handle invalid token scenario.', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallPolicy({
      UpdateToken: 'test invalid token scenario',
      FirewallPolicyArn: '',
      FirewallPolicyName: 'test',
      FirewallPolicy: {
        StatelessDefaultActions: ['aws:drop'],
        StatelessFragmentDefaultActions: ['aws:drop'],
        StatelessRuleGroupReferences: [
          {
            Priority: 30,
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2',
          },
          {
            Priority: 20,
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1',
          },
        ],
        StatefulRuleGroupReferences: [
          {
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1',
          },
        ],
      },
    })
  ).resolves.toBeDefined();
});
test('Update firewall policy handle error.', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallPolicy({
      UpdateToken: 'error',
      FirewallPolicyArn: '',
      FirewallPolicyName: 'test',
      FirewallPolicy: {
        StatelessDefaultActions: ['aws:drop'],
        StatelessFragmentDefaultActions: ['aws:drop'],
        StatelessRuleGroupReferences: [
          {
            Priority: 30,
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2',
          },
          {
            Priority: 20,
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1',
          },
        ],
        StatefulRuleGroupReferences: [
          {
            ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1',
          },
        ],
      },
    })
  ).rejects.toBeDefined();
});

test('Update rule groups', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateRuleGroup({
      UpdateToken: '',
      RuleGroupName: 'test',
    })
  ).resolves.toBeDefined();
});
test('Update rule groups handle invalid token error', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateRuleGroup({
      UpdateToken: 'invalid token',
      RuleGroupName: 'test',
    })
  ).resolves.toBeDefined();
});
test('Update rule groups handle error', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateRuleGroup({
      UpdateToken: 'error',
      RuleGroupName: 'test',
    })
  ).rejects.toThrowError();
});

test('Update logging configuration', async () => {
  const service = new NetworkFirewallService();
  const response = await service.updateLoggingConfiguration('firewallName', {
    LogDestinationConfigs: [
      {
        LogType: 'ALERT',
        LogDestination: {
          bucketName: 'centralized-network-inspection-solution',
          prefix: 'alerts',
        },
        LogDestinationType: 'S3',
      },
    ],
  });
  expect(response).toStrictEqual({
    LoggingConfiguration: {
      LogDestinationConfigs: [
        {
          LogType: 'ALERT',
          LogDestination: { bucketName: 'centralized-network-inspection-solution', prefix: 'alerts' },
          LogDestinationType: 'S3',
        },
      ],
    },
  });
});

test('List rule groups for firewall Policy', async () => {
  const service = new NetworkFirewallService();
  await expect(service.listRuleGroupsForPolicy('FirewallName')).resolves.toBeDefined();
});

test('delete rule Group', async () => {
  const service = new NetworkFirewallService();
  await expect(service.deleteRuleGroup('')).resolves.toBeUndefined();
});

test('associate firewall policy', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.associateFirewallPolicy({
      FirewallPolicyArn: '',
      FirewallName: '',
    })
  ).resolves.toBeDefined();
});

test('associate firewall policy error response', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.associateFirewallPolicy({
      FirewallPolicyArn: '',
      FirewallName: 'error',
    })
  ).rejects.toBeDefined();
});

test('update firewall description.', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallDescription({
      Description: '',
      FirewallName: '',
    })
  ).resolves.toBeDefined();
});

test('associate firewall description error response', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallDescription({
      Description: '',
      FirewallName: 'error',
    })
  ).rejects.toBeDefined();
});

test('update firewall deletion protection.', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallDeleteProtection({
      DeleteProtection: false,
      FirewallName: '',
    })
  ).resolves.toBeDefined();
});

test('associate firewall deletion protection error response', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallDeleteProtection({
      DeleteProtection: false,
      FirewallName: 'error',
    })
  ).rejects.toBeDefined();
});

test('update firewall policy change protection.', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallPolicyChangeProtection({
      FirewallPolicyChangeProtection: false,
      FirewallName: '',
    })
  ).resolves.toBeDefined();
});

test('update firewall policy change protection error response.', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateFirewallPolicyChangeProtection({
      FirewallPolicyChangeProtection: false,
      FirewallName: 'error',
    })
  ).rejects.toBeDefined();
});

test('update subnet change protection.', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateSubnetChangeProtection({
      SubnetChangeProtection: false,
      FirewallName: '',
    })
  ).resolves.toBeDefined();
});

test('update subnet change protection error response.', async () => {
  const service = new NetworkFirewallService();
  await expect(
    service.updateSubnetChangeProtection({
      SubnetChangeProtection: false,
      FirewallName: 'error',
    })
  ).rejects.toBeDefined();
});
