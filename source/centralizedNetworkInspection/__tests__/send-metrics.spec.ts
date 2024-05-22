/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { MetricsManager } from '../lib/common/send-metrics';

jest.mock(
  'aws-sdk',
  () => {
    return {
      __esModule: true,
      SSM: jest.fn().mockReturnValue({
        getParameter: jest.fn().mockImplementation(data => {
          expect(data).toStrictEqual({ Name: 'centralized-network-inspection-solution-uuid-asds' });
          if ('centralized-network-inspection-solution-uuid-asds' === data['Name']) {
            return {
              promise: jest.fn().mockReturnValue({
                Parameter: {
                  Value: '5d358dfa-bc71-4a48-a00c-0931e8ec1456',
                },
              }),
            };
          } else {
            return {
              promise: jest.fn().mockReturnValue({}),
            };
          }
        }),
      }),
    };
  },
  { virtual: true }
);

jest.mock(
  'uuid',
  () => {
    return {
      __esModule: true,
      v4: jest.fn().mockImplementation(() => {
        return '5d358dfa-bc71-4a48-a00c-0931e8ec1456';
      }),
    };
  },
  { virtual: true }
);

jest.mock(
  'axios',
  () => {
    return {
      __esModule: true,
      post: jest.fn().mockImplementation(() => {
        return {
          promise: jest.fn().mockReturnValue({}),
        };
      }),
    };
  },
  { virtual: true }
);

test('test sending the metrics when the uuid is already in the parameter store.', async () => {
  process.env.STACK_ID = 'asds';
  process.env.SEND_ANONYMIZED_METRICS = 'Yes';
  await MetricsManager.sendMetrics({
    numberOfFirewalls: 1,
    numberOfPolicies: 1,
    numberOfStatefulRuleGroups: 1,
    numberOfStatelessRuleGroups: 1,
    numberOfSuricataRules: 0,
  });
});
