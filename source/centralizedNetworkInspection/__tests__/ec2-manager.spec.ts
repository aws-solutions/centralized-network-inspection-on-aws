/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Ec2Manager } from '../lib/ec2-manager';

const ec2EnvProps = [
  {
    routeTableId: 'rtb-0e99886b16ecb5710',
    availabilityZone: 'us-east-1a',
  },
  {
    routeTableId: 'rtb-0e99886b16ecb5710',
    availabilityZone: 'us-east-1b',
  },
];

jest.mock(
  'aws-sdk',
  () => {
    return {
      __esModule: true,
      EC2: jest.fn().mockReturnValue({}),
    };
  },
  { virtual: true }
);

jest.mock(
  '../lib/service/ec2-service',
  () => {
    return {
      __esModule: true,
      Ec2Service: jest.fn().mockReturnValue({
        describeRouteTables: jest.fn().mockImplementation(() => {
          return [
            {
              Associations: [
                {
                  Main: false,
                  RouteTableAssociationId: 'rtbassoc-041509f1a595fa5dd',
                  RouteTableId: 'rtb-0e99886b16ecb5710',
                  SubnetId: 'subnet-028bf1f940038d771',
                  AssociationState: { State: 'associated' },
                },
                {
                  Main: false,
                  RouteTableAssociationId: 'rtbassoc-0c83e3ec6163f1999',
                  RouteTableId: 'rtb-0e99886b16ecb5710',
                  SubnetId: 'subnet-0884864b53eaf5171',
                  AssociationState: { State: 'associated' },
                },
              ],
              PropagatingVgws: [],
              RouteTableId: 'rtb-0e99886b16ecb5710',
              Routes: [
                {
                  DestinationCidrBlock: '192.168.1.0/26',
                  GatewayId: 'local',
                  Origin: 'CreateRouteTable',
                  State: 'active',
                },
              ],
              Tags: [{ Key: 'Name', Value: 'FirewallSubnetRouteTable' }],
              VpcId: 'vpc-0ea9f7f530319814a',
              OwnerId: '1234',
            },
          ];
        }),
        createRoute: jest.fn().mockImplementation(() => {
          return {
            Return: true,
          };
        }),
      }),
    };
  },
  { virtual: true }
);

test('test the method routeTableOperations - 2 VPCE', async () => {
  const syncStates = {
    'us-east-1a': {
      Attachment: {
        SubnetId: 'subnet-1',
        EndpointId: 'vpce-1',
        Status: 'READY',
      },
      Config: {
        'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2': { SyncStatus: 'IN_SYNC' },
      },
    },
    'us-east-1b': {
      Attachment: {
        SubnetId: 'subnet-2',
        EndpointId: 'vpce-2',
        Status: 'READY',
      },
      Config: {
        'arn:aws:network-firewall:us-east-1:1234:firewall-policy/Firewall-Policy-1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateful-rulegroup/StatefulRulesExample1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample1': { SyncStatus: 'IN_SYNC' },
        'arn:aws:network-firewall:us-east-1:1234:stateless-rulegroup/StatelessExample2': { SyncStatus: 'IN_SYNC' },
      },
    },
  };

  const ec2Mgr = new Ec2Manager(ec2EnvProps, syncStates);
  const response = await ec2Mgr.routeTableOperations();
  console.log(response);
  expect(response[0].VpcEndpointId).toStrictEqual('vpce-1');
  expect(response[0].RouteTableId).toStrictEqual('rtb-0e99886b16ecb5710');
  expect(response[0].DefaultRouteCreated).toStrictEqual(true);
  expect(response[1].VpcEndpointId).toStrictEqual('vpce-2');
  expect(response[0].RouteTableId).toStrictEqual('rtb-0e99886b16ecb5710');
  expect(response[1].DefaultRouteCreated).toStrictEqual(true);
});
