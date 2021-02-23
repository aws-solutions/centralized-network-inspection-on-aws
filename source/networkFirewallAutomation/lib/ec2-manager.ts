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

import { EC2, NetworkFirewall } from "aws-sdk"
import { Ec2Service } from "./service/ec2-service"
import { LOG_LEVEL, Logger } from "./common/logger"

export interface Ec2EnvironmentProps {
  availabilityZone: string | undefined,
  routeTableId: string | undefined
}

export enum Route {
  default = '0.0.0.0/0',
  active = 'active'
}

type routeStatus = {
  VpcEndpointId: string | undefined,
  RouteTableId: string,
  DefaultRouteCreated: boolean
}

/**
 * @description This class contains all the methods to
 * perform CRUD operations for the VPC route to Network Firewall.
 */
export class Ec2Manager {

  private service: Ec2Service
  private vpcEndpoint: string | undefined

  constructor(public envProps: Ec2EnvironmentProps[],
              public firewallSyncStates: NetworkFirewall.SyncStates) {
    this.service = new Ec2Service()
  }

  /** this method will check if route exists, if not will start the process to
   *  create the route, If route exists no action required. If any of the VPC
   *  endpoint is not in READY status, throw an error.
   */
  async routeTableOperations(): Promise<routeStatus[]> {
    try {
      let response: routeStatus[] = []
      for (let endpoint of this.envProps) {
        Logger.log(LOG_LEVEL.INFO, `Processing `, endpoint)

        // check if routes already exist
        if (endpoint.routeTableId && endpoint.availabilityZone) {
          const attachmentProps = this.firewallSyncStates[endpoint.availabilityZone]
          this.vpcEndpoint = attachmentProps.Attachment?.EndpointId
          const foundExistingRoute = await this.checkRouteTable(endpoint.routeTableId)

          if (!foundExistingRoute) {
            Logger.log(LOG_LEVEL.INFO, `Default route to Network Firewall does not exist. Creating a new default route using endpoint: ${this.vpcEndpoint} in the ready state.`)
            await this.service.createRoute({
              DestinationCidrBlock: Route.default,
              VpcEndpointId: this.vpcEndpoint,
              RouteTableId: endpoint.routeTableId
            })
          }
          let status = {
            VpcEndpointId: this.vpcEndpoint,
            RouteTableId: endpoint.routeTableId,
            DefaultRouteCreated: !foundExistingRoute
          }
          response.push(status)
        }
      }

      return response

    } catch
      (error) {
      Logger.log(LOG_LEVEL.ERROR, error)
      throw new Error(error["message"])
    }
  }

  /**
   * Describe route table and analyse routes
   */
  async checkRouteTable(routeTableId: string) {
    // get route table details to check route already exist
    const routeTables = await this.service.describeRouteTables(routeTableId)
    Logger.log(LOG_LEVEL.INFO, routeTables)

    // the describe route table API should always return single value if using
    // route table id
    if (routeTables && routeTables.length > 1) {
      Logger.log(LOG_LEVEL.DEBUG, routeTables)
      throw Error(`Expected only one item in the route table array. Received : ${routeTables.length} `)
    }

    let foundExistingRoute: boolean = false
    // at least 1 value should be present before attempting the iteration
    if (routeTables && routeTables.length == 1) {

      // the for loop would iterate only once
      for (let routeTable of routeTables) {
        foundExistingRoute = await this.checkExistingRoutes(routeTable)
      }
    }
    return foundExistingRoute
  }

  /**
   * This method check if there is an existing default route to the VPC
   * endpoint to network firewall. If
   * @param routeTable
   * @return List of VPC Endpoint ids in ready state. Returns empty list if
   * route already exists.
   */
  async checkExistingRoutes(routeTable: EC2.RouteTable): Promise<boolean> {
    const routes = routeTable.Routes
    Logger.log(LOG_LEVEL.DEBUG, `print routes`)
    Logger.log(LOG_LEVEL.DEBUG, routes)
    if (routes) {
      for (let route of routes) {
        Logger.log(LOG_LEVEL.DEBUG, `Checking route below for VPC Endpoint: ${this.vpcEndpoint}`)
        Logger.log(LOG_LEVEL.DEBUG, route)
        if (route.GatewayId && route.GatewayId === this.vpcEndpoint &&
          route.DestinationCidrBlock === Route.default && route.State === Route.active) {
          Logger.log(LOG_LEVEL.INFO, `Found Firewall VPC Endpoint ${route.GatewayId}`)
          Logger.log(LOG_LEVEL.INFO, `setting foundExistingRoute to TRUE`)
          return Promise.resolve(true)
        } else if (route.GatewayId && route.GatewayId != this.vpcEndpoint && route.DestinationCidrBlock === Route.default && route.State === Route.active) {
          //remove the route entry as possibly the firewall end point is no longer the same as it was earlier.
          if (routeTable.RouteTableId) {
            await this.service.deleteRoute({
              DestinationCidrBlock: Route.default,
              RouteTableId: routeTable.RouteTableId
            })
          }
        }
      }
    }
    // return false - could not find existing route
    Logger.log(LOG_LEVEL.INFO, `Firewall VPC Endpoint not found as destination in the route table.`)
    return Promise.resolve(false)
  }

  /**
   * Method will update the transit gateway attachement appliance mode. 
   * https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-transit-gateway-vpc-attachment.html
   * @param transitGatewayAttachmentId 
   * @param applianceMode 
   */
  static async updateTransitGatewayAttachementApplianceMode(transitGatewayAttachmentId: string, applianceMode: string) {
    if (transitGatewayAttachmentId && applianceMode) {
      const response = await new Ec2Service().modifyTransitGatewayAttachement({
        TransitGatewayAttachmentId: transitGatewayAttachmentId,
        Options: {
          ApplianceModeSupport: applianceMode
        }
      })
      Logger.log(LOG_LEVEL.INFO, `Response from modifyTransitGatewayAttachement API: `, response)
    }
  }
}
