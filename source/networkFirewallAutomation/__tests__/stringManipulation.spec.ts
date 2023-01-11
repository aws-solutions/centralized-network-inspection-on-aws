/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { StringUtils, Name } from '../lib/common/stringUtils';

const stackId = 'f449b250-b969-11e0-a185-5081d0136786';

test('test resource name less than 128 chars', async () => {
  const resourceName = 'Firewall-1';
  const stringMod = new StringUtils(stackId);
  const customName = stringMod.getUniqueResourceName(resourceName);
  console.log(customName);
  expect(customName.length < Name.maxCharacters);
});

test('test resource name more than 128 chars', async () => {
  const resourceName =
    'Firewall-1-f449b250-b969-11e0-a185-5081d0136786-f449b250-b969-11e0-a185-5081d0136786-f449b250-b969-11e0-a185-9-11e0-a185-5081d0136786-f449b250-b969-11e0-a185';
  const stringMod = new StringUtils(stackId);
  const customName = stringMod.getUniqueResourceName(resourceName);
  console.log(customName);
  expect(customName.length == Name.maxCharacters);
});
