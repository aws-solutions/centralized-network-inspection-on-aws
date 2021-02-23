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
import {ConfigurationOptions} from 'aws-sdk'

export enum Time {
  Seconds5 = 5000,
  Seconds15 = 15000
}

export enum Count {
  minRetry = 3,
  maxRetry = 10
}

/**
 * @description This class setup the retry options for AWS APIs
 */
export class AwsClientConfig {

  /**
   * @description Retry method returns the ConfigurationOptions instances with retryDelayOptions and maxRetries options set.
   * @returns ConfigurationOptions 
   */
  retry(): ConfigurationOptions {
    return {
      retryDelayOptions: {base: Time.Seconds5},
      maxRetries: Count.maxRetry
    }
  }
}