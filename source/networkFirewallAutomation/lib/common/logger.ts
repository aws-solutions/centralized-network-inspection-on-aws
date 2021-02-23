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

export enum LOG_LEVEL {
    "ERROR",
    "WARN",
    "INFO",
    "DEBUG"
}

export class Logger {
    
    private static readonly CONFIGURED_LOG_LEVEL = process.env.LOG_LEVEL && Object.values(LOG_LEVEL).indexOf(process.env.LOG_LEVEL.toUpperCase()) != -1 ? Object.values(LOG_LEVEL).indexOf(process.env.LOG_LEVEL.toUpperCase()) : LOG_LEVEL.ERROR;

    constructor() { }

    static log(log_level: LOG_LEVEL, message: any, object?: any) {
        if (log_level <= this.CONFIGURED_LOG_LEVEL) {
            let currentDateTime = new Date()
            let formatted_date = `${currentDateTime.getFullYear()}-${(currentDateTime.getMinutes()-1)}-${currentDateTime.getDate()} ${currentDateTime.getHours()}:${currentDateTime.getMinutes()}:${currentDateTime.getSeconds()}`
            let log_message = `${formatted_date} : ${JSON.stringify(message, null, 2)}`
            if (object) {
                log_message = `${formatted_date} : ${JSON.stringify(message, null, 2)} : ${JSON.stringify(object, null, 2)}`
            }
            console.log(log_message)
        }
    }
}