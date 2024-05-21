/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigurationOptions, EC2 } from 'aws-sdk';
import { AwsClientConfig } from './awsClientConfig';
import { Logger, LOG_LEVEL } from '../common/logger';

/**
 * Service class which handles all the EC2 API integrations.
 */
export class Ec2Service {
  private Ec2Client: EC2;
  config: ConfigurationOptions;

  constructor() {
    this.config = new AwsClientConfig().getRetryConfigurationOptions();
    this.Ec2Client = new EC2(this.config);
  }

  /** Describes the route. */
  async describeRouteTables(routeTableId: string): Promise<EC2.RouteTableList | undefined> {
    Logger.log(LOG_LEVEL.INFO, 'Describe Route Table');
    Logger.log(LOG_LEVEL.INFO, `Print Route Table Id: ${routeTableId}`);
    let response: EC2.DescribeRouteTablesResult;
    try {
      response = await this.Ec2Client.describeRouteTables({
        RouteTableIds: [routeTableId],
      }).promise();

      let nextToken = response.NextToken;
      let routeTables = response.RouteTables;

      // handle next token
      while (nextToken) {
        response = await this.Ec2Client.describeRouteTables({
          RouteTableIds: [routeTableId],
          NextToken: nextToken,
        }).promise();
        if (response.RouteTables) {
          routeTables = routeTables?.concat(response.RouteTables);
        }
        nextToken = response.NextToken;
      }
      return Promise.resolve(routeTables);
    } catch (error) {
      Logger.log(LOG_LEVEL.INFO, JSON.stringify(error));
      return Promise.reject(error);
    }
  }

  /** Creates route in the given route table. */
  async createRoute(props: EC2.CreateRouteRequest): Promise<EC2.CreateRouteResult | void> {
    Logger.log(LOG_LEVEL.INFO, 'Create Route');
    Logger.log(LOG_LEVEL.INFO, `Print Props: `, props);
    try {
      const response = await this.Ec2Client.createRoute(props).promise();
      return Promise.resolve(response);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async deleteRoute(props: EC2.DeleteRouteRequest): Promise<EC2.DeleteRouteRequest | void> {
    Logger.log(LOG_LEVEL.INFO, 'delete Route');
    Logger.log(LOG_LEVEL.INFO, `Print Props: `, props);
    try {
      await this.Ec2Client.deleteRoute(props).promise();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async modifyTransitGatewayAttachment(props: EC2.ModifyTransitGatewayVpcAttachmentRequest) {
    Logger.log(LOG_LEVEL.INFO, `modify the transit gateway attachment`);
    Logger.log(LOG_LEVEL.INFO, `Print Props: `, props);
    try {
      const response = await this.Ec2Client.modifyTransitGatewayVpcAttachment(props).promise();
      return Promise.resolve(response);
    } catch (error) {
      return Promise.resolve(error);
    }
  }
}
