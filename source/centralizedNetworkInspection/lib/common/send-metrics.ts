/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { v4 as uuidv4 } from 'uuid';
import { SSM } from 'aws-sdk';
import axios from 'axios';
import { Logger, LOG_LEVEL } from './logger';

export interface NetworkFirewallMetrics {
  numberOfFirewalls: number;
  numberOfStatefulRuleGroups: number;
  numberOfStatelessRuleGroups: number;
  numberOfPolicies: number;
  numberOfSuricataRules: number;
  logType?: string;
  logDestinationType?: string;
}

export class MetricsManager {
  private constructor() { }

  static async sendMetrics(data: NetworkFirewallMetrics) {
    const ssmParameterForUUID = process.env.SSM_PARAM_FOR_UUID
      ? process.env.SSM_PARAM_FOR_UUID
      : 'centralized-network-inspection-solution-uuid';
    const stackId = process.env.STACK_ID ? process.env.STACK_ID.slice(process.env.STACK_ID.length - 36) : '';
    const sendAnonymizedMetrics = process.env.SEND_ANONYMIZED_METRICS ? process.env.SEND_ANONYMIZED_METRICS : 'No';
    let uuid = '';
    Logger.log(LOG_LEVEL.DEBUG, `ssm parameter uuid key prefix ${ssmParameterForUUID}`)
    const ssmUUIDKey = `${ssmParameterForUUID}-${stackId}`;
    Logger.log(LOG_LEVEL.DEBUG, `ssm parameter uuid key ${ssmUUIDKey}`)
    try {
      if (sendAnonymizedMetrics.toUpperCase() === 'YES') {
        let ssmInstance = new SSM({
          customUserAgent: process.env.CUSTOM_SDK_USER_AGENT,
        });
        let ssmGetParamResponse;
        try {
          ssmGetParamResponse = await ssmInstance
            .getParameter({
              Name: ssmUUIDKey,
            })
            .promise();
          uuid = ssmGetParamResponse.Parameter?.Value ? ssmGetParamResponse.Parameter?.Value : uuidv4();
        } catch (error: any) {
          Logger.log(LOG_LEVEL.ERROR, "Error while getting the parameter ", error)
          if (error['code'] === 'ParameterNotFound') {
            uuid = uuidv4();
            await ssmInstance
              .putParameter({
                Name: ssmUUIDKey,
                Value: uuid,
                Type: 'String',
              })
              .promise();
          }
        }
        Logger.log(LOG_LEVEL.DEBUG, 'uuid: ', uuid);
        const metricsUrl: string = process.env.METRICS_URL ? process.env.METRICS_URL : '';
        const solutionId: string | undefined = process.env.SOLUTION_ID;
        const timestamp = new Date().toISOString();
        data.logDestinationType = process.env.LOG_DESTINATION_TYPE;
        data.logType = process.env.LOG_TYPE;
        const metrics_data = {
          Solution: solutionId,
          TimeStamp: timestamp,
          UUID: uuid,
          Data: data,
        };
        Logger.log(LOG_LEVEL.DEBUG, 'metrics data: ', metrics_data);
        const response = await axios.post(metricsUrl, JSON.stringify(metrics_data), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify(data).length,
          },
        });
        Logger.log(LOG_LEVEL.DEBUG, 'Response: ', response);

      }
    } catch (error) {
      Logger.log(LOG_LEVEL.DEBUG, `Error in send-metrics: ${JSON.stringify(error)}`);
    }
  }
}
