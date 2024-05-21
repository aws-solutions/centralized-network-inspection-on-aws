/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { FirewallConfigValidation } from './lib/common/firewall-config-validation';
import { Logger, LOG_LEVEL } from './lib/common/logger';

async function main() {
  try {
    const firewallConfigValidation = new FirewallConfigValidation();
    await firewallConfigValidation.validate();
  } catch (error) {
    Logger.log(LOG_LEVEL.ERROR, `Error in firewall config validation`, error);
    process.exit(1);
  }
}

main();
