/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { NetworkFirewallManager } from '../lib/network-firewall-manager';
import { ConfigReader } from '../lib/common/configReader/config-reader';

jest.mock(
  'aws-sdk',
  () => {
    return {
      __esModule: true,
      NetworkFirewall: jest.fn().mockReturnValue({}),
    };
  },
  { virtual: true }
);

jest.mock(
  '../lib/service/network-firewall-service',
  () => {
    return {
      __esModule: true,
      NetworkFirewallService: jest.fn().mockReturnValue({
        describeRuleGroup: jest.fn().mockImplementation(data => {
          const StatelessExample2Describe = {
            UpdateToken: 'c7007261-d236-4997-8eab-7e15445c84a2',
            RuleGroupResponse: {
              RuleGroupArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2',
              RuleGroupName: 'StatelessExample2',
              RuleGroupId: '206bd83b-3b59-4000-9ff3-3fe369f34719',
              Description: 'Stateless Rule with Forward to Stateful3',
              Type: 'STATELESS',
              Capacity: 220,
              RuleGroupStatus: 'ACTIVE',
              Tags: [],
            },
          };
          const StatelessExample1Describe = {
            UpdateToken: '9b5bc310-99d4-45c9-a16e-bdb58f883a48',
            RuleGroup: {
              RulesSource: {
                StatelessRulesAndCustomActions: {
                  StatelessRules: [
                    {
                      RuleDefinition: {
                        MatchAttributes: {
                          Sources: [{ AddressDefinition: '192.0.2.0/8' }],
                          Destinations: [{ AddressDefinition: '198.51.100.0/16' }],
                          SourcePorts: [
                            { FromPort: 53, ToPort: 53 },
                            { FromPort: 1001, ToPort: 1053 },
                          ],
                          DestinationPorts: [
                            { FromPort: 53, ToPort: 53 },
                            { FromPort: 1001, ToPort: 1053 },
                          ],
                          Protocols: [6],
                          TCPFlags: [{ Flags: ['SYN'], Masks: ['SYN', 'ACK'] }],
                        },
                        Actions: ['aws:drop'],
                      },
                      Priority: 19,
                    },
                  ],
                  CustomActions: [
                    {
                      ActionName: 'CustomAction',
                      ActionDefinition: { PublishMetricAction: { Dimensions: [{ Value: 'test' }] } },
                    },
                  ],
                },
              },
            },
            RuleGroupResponse: {
              RuleGroupArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1',
              RuleGroupName: 'StatelessExample1',
              RuleGroupId: '7246cfe2-00c7-4ef9-8d47-2b80bf8840e5',
              Description: 'Stateless Rule with Custom Action2',
              Type: 'STATELESS',
              Capacity: 199,
              RuleGroupStatus: 'ACTIVE',
              Tags: [],
            },
          };
          const StatefulRulesExample1Describe = {
            UpdateToken: 'dd7696c5-e2cd-4882-a560-21e28570fc0f',
            RuleGroup: {
              RulesSource: {
                RulesSourceList: {
                  Targets: ['test.example.com'],
                  TargetTypes: ['HTTP_HOST', 'TLS_SNI'],
                  GeneratedRulesType: 'DENYLIST',
                },
              },
            },
            RuleGroupResponse: {
              RuleGroupArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1',
              RuleGroupName: 'StatefulRulesExample1',
              RuleGroupId: '2560e622-5d9e-4c5c-9680-958bcb5c231b',
              Description: 'Stateful Rule2',
              Type: 'STATEFUL',
              Capacity: 100,
              RuleGroupStatus: 'ACTIVE',
              Tags: [],
            },
          };
          const suricataRuleGroup = {
            UpdateToken: '72e4e89b-acec-4184-b033-2dab8dd2a35f',
            RuleGroupResponse: {
              RuleGroupArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/suricata-icmp-rules2',
              RuleGroupName: 'suricata-icmp-rules2',
              RuleGroupId: 'f593c04a-079c-423f-8558-b02a8c0edb0e',
              Type: 'STATEFUL',
              Capacity: 300,
              RuleGroupStatus: 'ACTIVE',
            },
          };

          if (data === 'StatelessExample2') {
            return StatelessExample2Describe;
          } else if (data === 'StatelessExample1') {
            return StatelessExample1Describe;
          } else if (data === 'StatefulRulesExample1') {
            return StatefulRulesExample1Describe;
          } else if (data === 'suricata-icmp-rules2') {
            return suricataRuleGroup;
          }
          return '';
        }),
        updateRuleGroup: jest.fn().mockImplementation(data => {
          const StatelessExample2Update = {
            UpdateToken: '7fa52fd2-6b3a-41c5-8356-359d17a01ac0',
            RuleGroup: {
              RulesSource: {
                StatelessRulesAndCustomActions: {
                  StatelessRules: [
                    {
                      RuleDefinition: {
                        MatchAttributes: {
                          Sources: [{ AddressDefinition: '192.0.2.0/8' }],
                          Destinations: [
                            { AddressDefinition: '124.1.1.5/32' },
                            { AddressDefinition: '198.51.100.0/16' },
                          ],
                          Protocols: [6, 17],
                        },
                        Actions: ['aws:forward_to_sfe'],
                      },
                      Priority: 100,
                    },
                  ],
                },
              },
            },
            RuleGroupResponse: {
              RuleGroupArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2',
              RuleGroupName: 'StatelessExample2',
              RuleGroupId: '206bd83b-3b59-4000-9ff3-3fe369f34719',
              Description: 'Stateless Rule with Forward to Stateful2',
              Type: 'STATELESS',
              Capacity: 220,
              RuleGroupStatus: 'ACTIVE',
              Tags: [],
            },
          };
          const StatelessExample1Update = {
            UpdateToken: '327d0dca-e671-46bc-9ed7-83cf51773868',
            RuleGroupResponse: {
              RuleGroupArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1',
              RuleGroupName: 'StatelessExample1',
              RuleGroupId: '7246cfe2-00c7-4ef9-8d47-2b80bf8840e5',
              Description: 'Stateless Rule with Custom Action3',
              Type: 'STATELESS',
              Capacity: 199,
              RuleGroupStatus: 'ACTIVE',
              Tags: [],
            },
          };
          const StatefulRulesExample1Update = {
            UpdateToken: 'cc4687e1-f370-4e10-abfc-12984e1d62e7',
            RuleGroupResponse: {
              RuleGroupArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1',
              RuleGroupName: 'StatefulRulesExample1',
              RuleGroupId: '2560e622-5d9e-4c5c-9680-958bcb5c231b',
              Description: 'Stateful Rule3',
              Type: 'STATEFUL',
              Capacity: 100,
              RuleGroupStatus: 'ACTIVE',
              Tags: [],
            },
          };
          if (
            data['RuleGroupArn'] === 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2'
          ) {
            return StatelessExample2Update;
          } else if (
            data['RuleGroupArn'] === 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1'
          ) {
            return StatelessExample1Update;
          } else if (
            data['RuleGroupArn'] === 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1'
          ) {
            return StatefulRulesExample1Update;
          }
          return '';
        }),
        createRuleGroup: jest.fn().mockImplementation(() => {
          //console.log(`Inside createRuleGroup mock ${JSON.stringify(data)}`);
        }),
        listRuleGroupsForPolicy: jest.fn().mockImplementation(() => {
          return '';
        }),
        describeFirewall: jest.fn().mockImplementation(() => {
          //console.log(`Inside describeFirewall mock ${JSON.stringify(data)}`);
          return {
            Firewall: {
              FirewallName: 'VpcFirewall-1',
              FirewallPolicyArn: 'arn:aws:network-firewall:us-east-1:1234::firewall/*',
              Description: 'NetworkFirewallcreatedbyAWSSolutions',
              VpcId: 'vpc-1',
              SubnetMappings: [{ SubnetId: 'subnet-1' }, { SubnetId: 'subnet-2' }],
              DeleteProtection: true,
              SubnetChangeProtection: true,
              FirewallPolicyChangeProtection: true,
              FirewallId: 'string',
              Tags: [{ Key: 'string', Value: 'string' }],
            },
            FirewallStatus: {
              Status: 'READY',
              ConfigurationSyncStateSummary: 'IN_SYNC',
              SyncStates: {
                'us-east-1a': {
                  Attachment: { SubnetId: 'subnet-1', EndpointId: 'vpce-1', Status: 'READY' },
                  Config: {
                    'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1': {
                      SyncStatus: 'IN_SYNC',
                    },
                    'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1': {
                      SyncStatus: 'IN_SYNC',
                    },
                    'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1': {
                      SyncStatus: 'IN_SYNC',
                    },
                    'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2': {
                      SyncStatus: 'IN_SYNC',
                    },
                  },
                },
                'us-east-1b': {
                  Attachment: { SubnetId: 'subnet-2', EndpointId: 'vpce-2', Status: 'READY' },
                  Config: {
                    'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1': {
                      SyncStatus: 'IN_SYNC',
                    },
                    'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1': {
                      SyncStatus: 'IN_SYNC',
                    },
                    'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1': {
                      SyncStatus: 'IN_SYNC',
                    },
                    'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2': {
                      SyncStatus: 'IN_SYNC',
                    },
                  },
                },
              },
            },
          };
        }),
        describeFirewallPolicy: jest.fn().mockImplementation(data => {
          if (data && data === 'Firewall-Policy-2') {
            return Promise.resolve({
              UpdateToken: 'aaa',
              FirewallPolicyResponse: {
                FirewallPolicyName: 'Firewall-Policy-2',
                FirewallPolicyArn: 'arn:aws',
                FirewallPolicyId: 100,
              },
            });
          }
          return Promise.resolve();
        }),
        createFirewallPolicy: jest.fn().mockImplementation(() => {
          //console.log(`Inside describeFirewallPolicy mock ${JSON.stringify(data)}`);
          return {
            FirewallPolicyResponse: {
              FirewallPolicyName: 'Firewall-Policy-1',
              Description: 'FirewallPolicy1',
              FirewallPolicyArn: 'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1',
              FirewallPolicyStatus: 'ACTIVE',
              Tags: [{ Key: 'string', Value: 'string' }],
            },
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
                { ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1' },
              ],
            },
          };
        }),
        createFirewall: jest.fn().mockImplementation(() => {
          //console.log(`Inside describeFirewallPolicy mock ${JSON.stringify(data)}`);
          return {
            FirewallResponse: {
              Firewall: {
                FirewallName: 'VpcFirewall-1',
                FirewallPolicyArn: 'arn:aws:network-firewall:us-east-1:1234::firewall/*',
                Description: 'NetworkFirewallcreatedbyAWSSolutions',
                VpcId: 'vpc-1',
                SubnetMappings: [{ SubnetId: 'subnet-1' }, { SubnetId: 'subnet-2' }],
                DeleteProtection: true,
                SubnetChangeProtection: true,
                FirewallPolicyChangeProtection: true,
                FirewallId: 'string',
                Tags: [{ Key: 'string', Value: 'string' }],
              },
              FirewallStatus: {
                Status: 'READY',
                ConfigurationSyncStateSummary: 'IN_SYNC',
                SyncStates: {
                  'us-east-1a': {
                    Attachment: { SubnetId: 'subnet-1', EndpointId: 'vpce-1', Status: 'READY' },
                    Config: {
                      'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1': {
                        SyncStatus: 'IN_SYNC',
                      },
                      'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1': {
                        SyncStatus: 'IN_SYNC',
                      },
                      'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1': {
                        SyncStatus: 'IN_SYNC',
                      },
                      'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2': {
                        SyncStatus: 'IN_SYNC',
                      },
                    },
                  },
                  'us-east-1b': {
                    Attachment: { SubnetId: 'subnet-2', EndpointId: 'vpce-2', Status: 'READY' },
                    Config: {
                      'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1': {
                        SyncStatus: 'IN_SYNC',
                      },
                      'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1': {
                        SyncStatus: 'IN_SYNC',
                      },
                      'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1': {
                        SyncStatus: 'IN_SYNC',
                      },
                      'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2': {
                        SyncStatus: 'IN_SYNC',
                      },
                    },
                  },
                },
              },
            },
          };
        }),
        updateLoggingConfiguration: jest.fn().mockImplementation(() => {
          return {};
        }),
        updateFirewallPolicy: jest.fn().mockImplementation(() => {
          return {};
        }),
        associateFirewallPolicy: jest.fn().mockImplementation(data => {
          expect(data['FirewallPolicyArn']).toBe(
            'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1'
          );
        }),
        updateFirewallDeleteProtection: jest.fn().mockImplementation(data => {
          expect(data['DeleteProtection']).toBeTruthy();
        }),
        updateFirewallPolicyChangeProtection: jest.fn().mockImplementation(data => {
          expect(data['FirewallPolicyChangeProtection']).toBeTruthy();
        }),
        updateSubnetChangeProtection: jest.fn().mockImplementation(data => {
          expect(data['SubnetChangeProtection']).toBeTruthy();
        }),
        updateFirewallDescription: jest.fn().mockImplementation(data => {
          expect(data['Description']).toBe('Network Firewall created by AWS Solutions');
        }),
      }),
    };
  },
  { virtual: true }
);

test('test the method ruleGroupExist.', async () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: '',
      subnetIds: '',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: '',
    },
    firewallObject,
    new ConfigReader()
  );

  //load the firewall policy
  const policyObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewallPolicies/firewall-policy.example.json'
  );

  const response = await managerInstance.ruleGroupOperations(policyObject);

  expect(response).toStrictEqual({
    FirewallPolicyName: 'Firewall-Policy-1',
    FirewallPolicy: {
      StatelessDefaultActions: ['aws:drop'],
      StatelessFragmentDefaultActions: ['aws:drop'],
      StatelessRuleGroupReferences: [
        { Priority: 30, ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2' },
        { Priority: 20, ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1' },
      ],
      StatefulRuleGroupReferences: [
        { ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1' },
        { ResourceArn: 'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/suricata-icmp-rules2' },
      ],
    },
  });
});

test('test the method ruleGroupExist error scenario.', async () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: '',
      subnetIds: '',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: '',
    },
    firewallObject,
    new ConfigReader()
  );

  const policyObject = {
    FirewallPolicyName: 'Firewall-Policy-1',
    FirewallPolicy: {
      StatelessDefaultActions: ['aws:drop'],
      StatelessFragmentDefaultActions: ['aws:drop'],
      StatelessRuleGroupReferences: [
        {
          Priority: 30,
          ResourceArn: '__tests__/firewall-test-configuration/ruleGroups/stateless-fwd-to-stateful.example.json',
        },
        {
          Priority: 20,
          ResourceArn: '__tests__/firewall-test-configuration/ruleGroups/stateless-pass-action.example.json',
        },
      ],
      StatefulRuleGroupReferences: [
        {
          ResourceArn: 'error',
        },
      ],
    },
  };

  await expect(managerInstance.ruleGroupOperations(policyObject)).rejects.toThrowError(
    "Error: ENOENT: no such file or directory, open 'error'"
  );
});

test('test the method firewallExist.', async () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: 'vpc-1',
      subnetIds: 'subnet-1, subnet-2',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );

  const response = await managerInstance.firewallOperations();
  expect(response).toStrictEqual({
    'us-east-1a': {
      Attachment: { SubnetId: 'subnet-1', EndpointId: 'vpce-1', Status: 'READY' },
      Config: {
        'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2': { SyncStatus: 'IN_SYNC' },
      },
    },
    'us-east-1b': {
      Attachment: { SubnetId: 'subnet-2', EndpointId: 'vpce-2', Status: 'READY' },
      Config: {
        'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2': { SyncStatus: 'IN_SYNC' },
      },
    },
  });
});

test('firewall policy already exists', async () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: 'vpc-1',
      subnetIds: 'subnet-1, subnet-2',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );

  const response = await managerInstance.firewallPolicyOperations(
    '__tests__/firewall-test-configuration/firewallPolicies/firewall-policy-2.json'
  );
  expect(response).toBe('arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1');
});

test('test the logging configuration object creation from environment variables', async () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  let managerInstance = new NetworkFirewallManager(
    {
      vpcId: '',
      subnetIds: '',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );

  let loggingConfiguration = await managerInstance.createLoggingConfigurations();

  expect(loggingConfiguration.length).toBe(1);
  expect(loggingConfiguration[0].LogType).toBe('ALERT');
  expect(loggingConfiguration[0].LogDestinationType).toBe('S3');
  expect(JSON.stringify(loggingConfiguration[0].LogDestination)).toStrictEqual(
    '{"bucketName":"test-bucket","prefix":"alerts"}'
  );

  managerInstance = new NetworkFirewallManager(
    {
      vpcId: '',
      subnetIds: '',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'FLOW',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );

  loggingConfiguration = await managerInstance.createLoggingConfigurations();

  expect(loggingConfiguration.length).toBe(1);
  expect(loggingConfiguration[0].LogType).toBe('FLOW');
  expect(loggingConfiguration[0].LogDestinationType).toBe('S3');
  expect(JSON.stringify(loggingConfiguration[0].LogDestination)).toStrictEqual(
    '{"bucketName":"test-bucket","prefix":"flow"}'
  );

  managerInstance = new NetworkFirewallManager(
    {
      vpcId: '',
      subnetIds: '',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'EnableBoth',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );

  loggingConfiguration = await managerInstance.createLoggingConfigurations();

  expect(loggingConfiguration.length).toBe(2);
  expect(loggingConfiguration[0].LogType).toBe('ALERT');
  expect(loggingConfiguration[0].LogDestinationType).toBe('S3');
  expect(JSON.stringify(loggingConfiguration[0].LogDestination)).toStrictEqual(
    '{"bucketName":"test-bucket","prefix":"alerts"}'
  );
  expect(loggingConfiguration[1].LogType).toBe('FLOW');
  expect(loggingConfiguration[1].LogDestinationType).toBe('S3');
  expect(JSON.stringify(loggingConfiguration[1].LogDestination)).toStrictEqual(
    '{"bucketName":"test-bucket","prefix":"flow"}'
  );

  managerInstance = new NetworkFirewallManager(
    {
      vpcId: '',
      subnetIds: '',
      logDestinationType: 'CloudWatchLogs',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'EnableBoth',
      logDestination: 'log-group-name',
    },
    firewallObject,
    new ConfigReader()
  );

  loggingConfiguration = await managerInstance.createLoggingConfigurations();

  expect(loggingConfiguration.length).toBe(2);
  expect(loggingConfiguration[0].LogType).toBe('ALERT');
  expect(loggingConfiguration[0].LogDestinationType).toBe('CloudWatchLogs');
  expect(JSON.stringify(loggingConfiguration[0].LogDestination)).toStrictEqual('{"logGroup":"log-group-name"}');

  expect(loggingConfiguration[1].LogType).toBe('FLOW');
  expect(loggingConfiguration[1].LogDestinationType).toBe('CloudWatchLogs');
  expect(JSON.stringify(loggingConfiguration[1].LogDestination)).toStrictEqual('{"logGroup":"log-group-name"}');
});

test('subnet mappings function should return an array', () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: 'vpc-1',
      subnetIds: 'subnet-1, subnet-2',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );
  expect(managerInstance.getSubnetMapping()).toStrictEqual([{ SubnetId: 'subnet-1' }, { SubnetId: ' subnet-2' }]);
});
test('subnet mappings function should return an array --error scenario', () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: 'vpc-1',
      subnetIds: '',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );
  try {
    managerInstance.getSubnetMapping();
  } catch (error: any) {
    expect(error['message']).toBe('Subnet IDs must be in the environment variables');
  }
});

test('vpc id should be return from environment variable', () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: 'vpc-1',
      subnetIds: 'subnet-1, subnet-2',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );
  expect(managerInstance.getVpcId()).toBe('vpc-1');
});

test('vpc id should be return from environment variable --error scenario', () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: '',
      subnetIds: 'subnet-1, subnet-2',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );
  try {
    managerInstance.getVpcId();
  } catch (error: any) {
    expect(error['message']).toBe('VPC ID must be in the environment variables');
  }
});

test('Update firewall properties', async () => {
  const fileHandler = new ConfigReader();
  let firewallObject = fileHandler.convertFileToObject(
    '__tests__/firewall-test-configuration/firewalls/firewall.example.json'
  );
  const managerInstance = new NetworkFirewallManager(
    {
      vpcId: '',
      subnetIds: 'subnet-1, subnet-2',
      logDestinationType: 'S3',
      logRetentionPeriod: '90',
      stackId: 'f449b250-b969-11e0-a185-5081d0136786',
      logType: 'ALERT',
      logDestination: 'test-bucket',
    },
    firewallObject,
    new ConfigReader()
  );

  await managerInstance.updateFirewall(
    {
      Firewall: {
        FirewallId: '12345',
        FirewallPolicyArn: 'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-2',
        SubnetMappings: [],
        VpcId: '',
        DeleteProtection: false,
        Description: '',
        FirewallName: 'VpcFirewall-1',
        FirewallArn: '',
        FirewallPolicyChangeProtection: false,
        SubnetChangeProtection: false,
      },
    },
    'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1'
  );
});
