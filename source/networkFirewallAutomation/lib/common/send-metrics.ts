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
import { v4 as uuidv4 } from "uuid"
import { SSM } from "aws-sdk"
import axios from "axios"
import { Logger, LOG_LEVEL } from "./logger"

export interface NetworkFirewallMetrics {
    numberOfFirewalls: number,
    numberOfStatefulRuleGroups: number,
    numberOfStatelessRuleGroups: number,
    numberOfPolicies: number,
    numberOfSuricataRules: number,
    logType?:  string
    logDestinationType?:  string
}

export class MetricsManager {

    private constructor() { }

    static async sendMetrics(data: NetworkFirewallMetrics) {
        const ssmParameterForUUID = process.env.SSM_PARAM_FOR_UUID ? process.env.SSM_PARAM_FOR_UUID : "network-firewall-solution-uuid"
        const stackId = process.env.STACK_ID ? process.env.STACK_ID.slice(process.env.STACK_ID.length - 36) : ""
        const sendAnonymousMetrics = process.env.SEND_ANONYMOUS_METRICS ? process.env.SEND_ANONYMOUS_METRICS : "No"
        let uuid = ""
        const ssmUUIDKey = `${ssmParameterForUUID}-${stackId}`
        try {
            if (sendAnonymousMetrics.toUpperCase() === "YES") {
                let ssmInstance = new SSM();
                let ssmGetParamResponse;
                try {
                    ssmGetParamResponse = await ssmInstance.getParameter({
                        Name: ssmUUIDKey,
                    }).promise();
                    uuid = ssmGetParamResponse.Parameter?.Value ? ssmGetParamResponse.Parameter?.Value : uuidv4();
                } catch (error) {
                    if (error["code"] = "ParameterNotFound") {
                        uuid = uuidv4();
                        await ssmInstance.putParameter({
                            Name: ssmUUIDKey,
                            Value: uuid,
                            Type: "String"
                        }).promise();
                    }
                }
                Logger.log(LOG_LEVEL.DEBUG, "uuid: ", uuid)
                const metricsUrl: string = process.env.METRICS_URL ? process.env.METRICS_URL : ""
                const solutionId: string | undefined = process.env.SOLUTION_ID
                const timestamp = (new Date()).toISOString()
                data.logDestinationType = process.env.LOG_DESTINATION_TYPE
                data.logType = process.env.LOG_TYPE
                const metrics_data = {
                    'Solution': solutionId,
                    'TimeStamp': timestamp,
                    'UUID': uuid,
                    'Data': data
                }
                Logger.log(LOG_LEVEL.DEBUG, "metrics data: ", metrics_data)
                const response = await axios.post(metricsUrl, metrics_data, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length':  JSON.stringify(data).length
                    }
                })
                Logger.log(LOG_LEVEL.DEBUG, 'Response: ', response)
            } 
        } catch (error) { }
    }
}