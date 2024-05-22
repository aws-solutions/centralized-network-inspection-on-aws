/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { FirewallConfigValidation } from '../lib/common/firewall-config-validation';

jest.mock('aws-sdk', () => {
  return {
    __esModule: true,
    NetworkFirewall: jest.fn().mockReturnValue({
      createRuleGroup: jest.fn().mockImplementation(() => {
        //console.log(`Inside rule group mock ${JSON.stringify(data)}` )
      }),
      createFirewallPolicy: jest.fn().mockImplementation(() => {
        //console.log(`Inside firewall policy mock ${JSON.stringify(data)}` )
      }),
    }),
  };
});

describe('Firewall Config Validation', () => {
  it('should not throw an error if all firewalls are valid', async () => {
    const firewallConfigValidation = new FirewallConfigValidation();

    const testCase = async () => {
      await firewallConfigValidation.validate('/__tests__/firewall-test-configuration/firewalls-valid/');
    };

    await expect(testCase).not.toThrowError();

    expect(firewallConfigValidation.getInvalidFiles().length).toBe(0);
  });

  it('should throw an exception if the firewall file is missing.', async () => {
    const firewallConfigValidation = new FirewallConfigValidation();

    const testCase = async () => {
      await firewallConfigValidation.validate();
    };

    await expect(testCase).rejects.toThrowError('Validation failed.');
  });

  it('should fail with invalid files', async () => {
    const firewallConfigValidation = new FirewallConfigValidation();

    const testCase = async () => {
      await firewallConfigValidation.validate('/__tests__/firewall-test-configuration/firewalls/');
    };

    await expect(testCase).rejects.toThrowError('Validation failed: Invalid Files.');

    expect(firewallConfigValidation.getInvalidFiles()).toStrictEqual([
      {
        path: '__tests__/firewall-test-configuration/ruleGroups/stateless-fwd-to-stateful.invalid.json',
        referencedInFile: '__tests__/firewall-test-configuration/firewallPolicies/firewall-invalid-policy.json',
        error: 'The file in the attribute path is not available in the configuration.',
      },
      {
        path: '__tests__/firewall-test-configuration/firewallPolicies/firewall-notavailable.json',
        referencedInFile: '__tests__/firewall-test-configuration/firewallPolicies/firewall-notavailable.json',
        error: 'The file in the attribute path is not available in the configuration.',
      },
    ]);
  });

  it('should fail with invalid stateless and stateful rule groups', async () => {
    const firewallConfigValidation = new FirewallConfigValidation();

    const testCase = async () => {
      await firewallConfigValidation.validate('/__tests__/firewall-test-configuration/firewalls-invalid-rule-groups/');
    };

    await expect(testCase).rejects.toThrowError('Validation failed: Invalid Files.');

    expect(firewallConfigValidation.getInvalidFiles()).toStrictEqual([
      {
        error:
          'Both RuleGroup and Rules have data, You must provide either the rule group setting or a Rules setting, but not both. ',
        path: '__tests__/firewall-test-configuration/ruleGroups/invalid-rulegroup.example.json',
      },
      {
        error:
          'Both RuleGroup and Rules have data, You must provide either the rule group setting or a Rules setting, but not both. ',
        path: '__tests__/firewall-test-configuration/ruleGroups/invalid-rulegroup.example.json',
      },
    ]);
  });

  it('should fail with invalid rule group ARNs', async () => {
    const firewallConfigValidation = new FirewallConfigValidation();

    const testCase = async () => {
      await firewallConfigValidation.validate(
        '/__tests__/firewall-test-configuration/firewalls-invalid-rule-group-arns/'
      );
    };

    await expect(testCase).rejects.toThrowError('Validation failed: Invalid Files.');

    expect(firewallConfigValidation.getInvalidFiles()).toStrictEqual([
      {
        error: 'The file in the attribute path is not available in the configuration.',
        path: '__tests__/firewall-test-configuration/ruleGroups/missing.example.json',
        referencedInFile:
          '__tests__/firewall-test-configuration/firewallPolicies/firewall-invalid-policy-rule-arns.json',
      },
      {
        error: 'The file in the attribute path is not available in the configuration.',
        path: '__tests__/firewall-test-configuration/ruleGroups/missing.json',
        referencedInFile:
          '__tests__/firewall-test-configuration/firewallPolicies/firewall-invalid-policy-rule-arns.json',
      },
    ]);
  });

  it('should fail with a missing rule file', async () => {
    const firewallConfigValidation = new FirewallConfigValidation();

    const testCase = async () => {
      await firewallConfigValidation.validate('/__tests__/firewall-test-configuration/firewalls-invalid-rule-file/');
    };

    await expect(testCase).rejects.toThrowError('Validation failed: Invalid Files.');

    expect(firewallConfigValidation.getInvalidFiles()).toStrictEqual([
      {
        error: 'Rules attribute has invalid file path. ',
        path: '__tests__/firewall-test-configuration/ruleGroups/empty-rules.example.json',
      },
    ]);
  });
});
