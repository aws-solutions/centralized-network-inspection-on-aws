/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export enum LOG_LEVEL {
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG',
}

export class Logger {
  private static readonly CONFIGURED_LOG_LEVEL =
    process.env.LOG_LEVEL && Object.values(LOG_LEVEL).indexOf(process.env.LOG_LEVEL.toUpperCase()) != -1
      ? Object.values(LOG_LEVEL).indexOf(process.env.LOG_LEVEL.toUpperCase())
      : LOG_LEVEL.ERROR;

  static log(log_level: LOG_LEVEL, message: any, object?: any) {
    if (log_level <= this.CONFIGURED_LOG_LEVEL) {
      let currentDateTime = new Date();
      let formatted_date = `${currentDateTime.getFullYear()}-${
        currentDateTime.getMinutes() - 1
      }-${currentDateTime.getDate()} ${currentDateTime.getHours()}:${currentDateTime.getMinutes()}:${currentDateTime.getSeconds()}`;
      let log_message = `${formatted_date} : ${JSON.stringify(message, null, 2)}`;
      if (object) {
        log_message = `${formatted_date} : ${JSON.stringify(message, null, 2)} : ${JSON.stringify(object, null, 2)}`;
      }
      console.log(log_message);
    }
  }
}
