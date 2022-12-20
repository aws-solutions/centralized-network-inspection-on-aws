/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Ec2Service } from '../lib/service/ec2-service';

const routeTable = {
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
};

const routeTables = [routeTable];

const mockDescribeRouteTablesPromise = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    RouteTables: routeTables,
  });
});

jest.mock('aws-sdk', () => {
  return {
    __esModule: true,
    EC2: jest.fn().mockReturnValue({
      describeRouteTables: jest.fn().mockImplementation(() => {
        return {
          promise: mockDescribeRouteTablesPromise,
        };
      }),
      createRoute: jest.fn().mockImplementation(() => {
        return {
          promise: jest.fn().mockImplementation(() => {
            return Promise.resolve({});
          }),
        };
      }),
      deleteRoute: jest.fn().mockImplementation(() => {
        return {
          promise: jest.fn().mockImplementation(() => {
            return Promise.resolve({});
          }),
        };
      }),
      modifyTransitGatewayVpcAttachment: jest.fn().mockImplementation(() => {
        return {
          promise: jest.fn().mockImplementation(() => {
            return Promise.resolve({});
          }),
        };
      }),
    }),
  };
});

describe('EC2 Service', () => {
  const service = new Ec2Service();

  it('should describe the route tables', async () => {
    const routeTableId = 'route-table-id';
    const response = await service.describeRouteTables(routeTableId);
    expect(response).toBe(routeTables);
  });

  it('should describe route tables with paging', async () => {
    mockDescribeRouteTablesPromise.mockResolvedValueOnce({
      NextToken: true,
      RouteTables: routeTables,
    });

    const routeTableId = 'route-table-id';
    const response = await service.describeRouteTables(routeTableId);
    expect(response).toStrictEqual([routeTable, routeTable]);
  });

  it('should create a route', async () => {
    const testCase = async () => {
      await service.createRoute({ RouteTableId: 'id' });
    };

    await expect(testCase).not.toThrowError();
  });

  it('should delete a route', async () => {
    const testCase = async () => {
      await service.deleteRoute({ RouteTableId: 'id' });
    };

    await expect(testCase).not.toThrowError();
  });

  it('should modify the transit gateway attachment', async () => {
    const testCase = async () => {
      await service.modifyTransitGatewayAttachment({ TransitGatewayAttachmentId: 'id' });
    };

    await expect(testCase).not.toThrowError();
  });
});
