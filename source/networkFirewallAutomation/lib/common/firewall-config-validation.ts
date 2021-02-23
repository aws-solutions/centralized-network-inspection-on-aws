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

import { NetworkFirewall } from "aws-sdk";
import { Logger, LOG_LEVEL } from "./logger";
import { ConfigReader, ConfigPath } from "./configReader/config-reader";
import { MetricsManager, NetworkFirewallMetrics } from "./send-metrics";

interface InvalidConfigFiles {
    path: string;
    referencedInFile?: any;
    error?: any;
}

export class FirewallConfigValidation {

    private invalidFiles: InvalidConfigFiles[];
    private service: NetworkFirewall;
    private fileHandler: ConfigReader;

    constructor() {
        this.invalidFiles = []
        this.service = new NetworkFirewall()
        this.fileHandler = new ConfigReader()
    }

    getInvalidFiles() {
        return this.invalidFiles
    }

    /**
     * This method will validate all the files in starting with firewall, firewall policy and rule groups, all the invalid 
     * files will be output to the console and an error is thrown,
     * if there no invalid files the validation will exit without any error.
     * @param rootDir optional if the value is not provided the path configured in the ConfigPath is taken as directory.
     */
    async execute(rootDir?: string) {
        const metrics: NetworkFirewallMetrics = {
            numberOfFirewalls: 0,
            numberOfPolicies: 0,
            numberOfStatefulRuleGroups: 0,
            numberOfStatelessRuleGroups: 0,
            numberOfSuricataRules: 0
        }
        Logger.log(LOG_LEVEL.INFO, `Starting firewall config validation`)
        try {
            const currentPath = process.cwd()
            let directoryPath;
            if (rootDir) {
                directoryPath = currentPath.concat(rootDir)
            } else {
                directoryPath = currentPath.concat(ConfigPath.firewallDirectory)
            }
            Logger.log(LOG_LEVEL.INFO, `Config file path ${directoryPath}`)
            const firewallFiles = this.fileHandler.getJSONFileNames(directoryPath)
            metrics.numberOfFirewalls = firewallFiles.length

            for (let firewallFile of firewallFiles) {
                Logger.log(LOG_LEVEL.INFO, `Validating the file paths for the firewall file named: ${firewallFile}`)
                let firewall: NetworkFirewall.Types.CreateFirewallRequest = this.fileHandler.convertFileToObject(firewallFile)
                
                this.validateFirewallFile(firewall)

                let firewallPolicy: NetworkFirewall.Types.CreateFirewallPolicyRequest;

                //verify firewall policy. 
                try {
                    firewallPolicy = this.fileHandler.convertFileToObject(firewall.FirewallPolicyArn)
                    metrics.numberOfPolicies += 1
                    await this.validateFirewallPolicyFile(firewallPolicy, firewall.FirewallPolicyArn)
                } catch (error) {
                    Logger.log(LOG_LEVEL.INFO, `Failed to validate the firewall policy`)
                    this.invalidFiles.push({
                        path: firewall.FirewallPolicyArn,
                        referencedInFile: firewall.FirewallPolicyArn,
                        error: "The file in the attribute path is not available in the configuration."
                    })
                    break;
                }

                //loop through all the stateful rule groups and verify if the files compile to a valid json object.
                if (firewallPolicy.FirewallPolicy.StatefulRuleGroupReferences) {
                    metrics.numberOfStatefulRuleGroups += firewallPolicy.FirewallPolicy.StatefulRuleGroupReferences.length
                    Logger.log(LOG_LEVEL.DEBUG, `Firewall Policy StatefulRuleGroupReferences`, firewallPolicy.FirewallPolicy.StatefulRuleGroupReferences)
                    for (let  statefulRuleGroup of firewallPolicy.FirewallPolicy.StatefulRuleGroupReferences) {
                        try {
                            const ruleGroup: NetworkFirewall.Types.CreateRuleGroupRequest = this.fileHandler.convertFileToObject(statefulRuleGroup.ResourceArn);
                            if (ruleGroup.Rules) {
                                metrics.numberOfSuricataRules += 1;
                            }
                            await this.validateRuleGroupFile(ruleGroup, statefulRuleGroup.ResourceArn)
                        } catch (error) {
                            this.invalidFiles.push({
                                path: statefulRuleGroup.ResourceArn,
                                referencedInFile: firewall.FirewallPolicyArn,
                                error: "The file in the attribute path is not available in the configuration."
                            })
                        }
                    }
                }
                //loop through all the stateless rule groups and verify if the files compile to a valid json object.
                if (firewallPolicy.FirewallPolicy.StatelessRuleGroupReferences) {
                    metrics.numberOfStatelessRuleGroups += firewallPolicy.FirewallPolicy.StatelessRuleGroupReferences.length
                    Logger.log(LOG_LEVEL.DEBUG, `Firewall Policy StatelessRuleGroupReferences`, firewallPolicy.FirewallPolicy.StatelessRuleGroupReferences)
                    for (let statelessRuleGroup of firewallPolicy.FirewallPolicy.StatelessRuleGroupReferences) {
                        try {
                            const ruleGroup = this.fileHandler.convertFileToObject(statelessRuleGroup.ResourceArn)
                            await this.validateRuleGroupFile(ruleGroup, statelessRuleGroup.ResourceArn)
                        } catch (error) {
                            this.invalidFiles.push({
                                path: statelessRuleGroup.ResourceArn,
                                referencedInFile: firewall.FirewallPolicyArn,
                                error: "The file in the attribute path is not available in the configuration."
                            })
                        }
                    }
                }
            }

        } catch (error) {
            Logger.log(LOG_LEVEL.ERROR, error)
            throw new Error("Validation failed.");
        } finally {
            Logger.log(LOG_LEVEL.INFO, `Number of invalid files: ${this.invalidFiles.length}`)
            Logger.log(LOG_LEVEL.INFO, `-----------INVALID FILES START-----------`)
            this.getInvalidFiles().forEach((invalidFile) => {
                Logger.log(LOG_LEVEL.ERROR, invalidFile)
            })
            Logger.log(LOG_LEVEL.INFO, `-----------INVALID FILES END--------------`)
            if (this.invalidFiles.length > 0) {
                const error = "Validation failed."
                Logger.log(LOG_LEVEL.ERROR, error)
                throw error
            }
            Logger.log(LOG_LEVEL.DEBUG, `Send metrics`, metrics)
            MetricsManager.sendMetrics(metrics)
        }
    }

    async validateFirewallPolicyFile(firewallPolicy: NetworkFirewall.Types.CreateFirewallPolicyRequest, path: string) {
        firewallPolicy.DryRun = true;
        let response;
        try {
            response = await this.service.createFirewallPolicy(firewallPolicy).promise()
        } catch (error) {
            const errorCode: string = error["code"]
            Logger.log(LOG_LEVEL.DEBUG, `Error response from the create firewall policy dry run API`, error)
            if (errorCode === "MultipleValidationErrors" || errorCode === "UnexpectedParameter") {
                this.invalidFiles.push({
                    path: path,
                    error: error["message"]
                })
            }
        }
        Logger.log(LOG_LEVEL.DEBUG, `Response from the create firewall policy dry run API`, response)
    }
    async validateRuleGroupFile(ruleGroup: NetworkFirewall.Types.CreateRuleGroupRequest, path: string) {
        //add code to check if this rule source is provided or rules file is being provided
        if (ruleGroup.Rules && ruleGroup.RuleGroup) {
            Logger.log(LOG_LEVEL.DEBUG, `Rule Group file has both Rules and RuleGroup fields.`, ruleGroup)
            this.invalidFiles.push({
                path: path,
                error: "Both RuleGroup and Rules have data, You must provide either the rule group setting or a Rules setting, but not both. "
            })
            return;
        } else if (ruleGroup.Rules) {
            const ruleString = this.fileHandler.copyFileContentToString(ruleGroup.Rules)
            if (!ruleString) {
                ruleGroup.Rules = ruleString
                this.invalidFiles.push({
                    path: path,
                    error: "Rules attribute has invalid file path. " + ruleGroup.Rules
                })
            }
            Logger.log(LOG_LEVEL.DEBUG, `Rule Group file has both Rules and RuleGroup fields.`, ruleGroup.Rules)
        }

        ruleGroup.DryRun = true;
        let response;
        try {
            response = await this.service.createRuleGroup(ruleGroup).promise();
        } catch(error) {
            Logger.log(LOG_LEVEL.DEBUG, `Error response from the create rule group dry run API`, error)
            const errorCode: string = error["code"]
            if (errorCode === "MultipleValidationErrors" || errorCode === "UnexpectedParameter") {
                this.invalidFiles.push({
                    path: path,
                    error: error["message"]
                })
            }
        }
        Logger.log(LOG_LEVEL.DEBUG, `Response from the create rule group dry run API`, response)
    }

    validateFirewallFile(firewall:  NetworkFirewall.Types.CreateFirewallRequest) {
        if (!firewall.FirewallName || !firewall.FirewallPolicyArn) {
            this.invalidFiles.push({
                path: firewall.FirewallName,
                referencedInFile: firewall.FirewallName,
                error: "FirewallName and FirewallPolicyArn are required in the firewall."
            })
        }
     }
}