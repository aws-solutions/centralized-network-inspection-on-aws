/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { ConfigurationOptions } from 'aws-sdk';

export enum Time {
  Seconds5 = 5000,
  Seconds15 = 15000,
}

export enum Count {
  minRetry = 3,
  maxRetry = 10,
}

/**
 * @description This class setup the retry options for AWS APIs
 */
export class AwsClientConfig {
  /**
   * @description Retry method returns the ConfigurationOptions instances with retryDelayOptions and maxRetries options set.
   * @returns ConfigurationOptions
   */
  getRetryConfigurationOptions(): ConfigurationOptions {
    return {
      retryDelayOptions: { base: Time.Seconds5 },
      maxRetries: Count.maxRetry,
      customUserAgent: process.env.CUSTOM_SDK_USER_AGENT,
    };
  }
}
