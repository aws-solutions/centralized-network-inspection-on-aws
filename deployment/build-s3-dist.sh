#!/bin/bash
#
#  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
#  with the License. A copy of the License is located at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
#  and limitations under the License.
#

# Important: CDK global version number
cdk_version=1.77.0

# Check to see if the required parameters have been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the artifact code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

[ "$DEBUG" == 'true' ] && set -x
set -e

# Environment variables 
export DIST_VERSION=$3
export DIST_OUTPUT_BUCKET=$1
export SOLUTION_ID=SO0108
export SOLUTION_NAME=$2
export SOLUTION_TRADEMARKEDNAME=$2


# Get reference for all important folders
template_dir="$PWD"
staging_dist_dir="$template_dir/staging"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Remove any old dist files from previous runs"
echo "------------------------------------------------------------------------------"

echo "rm -rf $template_dist_dir"
rm -rf $template_dist_dir
echo "mkdir -p $template_dist_dir"
mkdir -p $template_dist_dir
echo "rm -rf $build_dist_dir"
rm -rf $build_dist_dir
echo "mkdir -p $build_dist_dir"
mkdir -p $build_dist_dir
echo "rm -rf $staging_dist_dir"
rm -rf $staging_dist_dir
echo "mkdir -p $staging_dist_dir"
mkdir -p $staging_dist_dir
echo "rm -rf $template_dir/vpc_rules"
rm -rf $template_dir/vpc_rules

echo "------------------------------------------------------------------------------"
echo "[Synth] CDK Project"
echo "------------------------------------------------------------------------------"

# Install the global aws-cdk package
echo "cd $source_dir"
cd $source_dir
echo "npm install -g aws-cdk@$cdk_version"
npm install -g aws-cdk@$cdk_version

# Run 'cdk synth' to generate raw solution outputs
cd "$source_dir"
echo "cdk synth --output=$staging_dist_dir"
npm run build && cdk synth --output=$staging_dist_dir

# Remove unnecessary output files
echo "cd $staging_dist_dir"
cd $staging_dist_dir
echo "rm tree.json manifest.json cdk.out"
rm tree.json manifest.json cdk.out

echo "------------------------------------------------------------------------------"
echo "[Packing] Template artifacts"
echo "------------------------------------------------------------------------------"

# Move outputs from staging to template_dist_dir
echo "Move outputs from staging to template_dist_dir"
echo "cp $template_dir/*.template $template_dist_dir/"
cp $staging_dist_dir/*.template.json $template_dist_dir/
rm *.template.json

# Rename all *.template.json files to *.template
echo "Rename all *.template.json to *.template"
echo "copy templates and rename"
for f in $template_dist_dir/*.template.json; do
    mv -- "$f" "${f%.template.json}.template"
done

echo "------------------------------------------------------------------------------"
echo "[Packing] Source code artifacts"
echo "------------------------------------------------------------------------------"

# General cleanup of node_modules and package-lock.json files
echo "find $staging_dist_dir -iname "node_modules" -type d -exec rm -rf "{}" \; 2> /dev/null"
find $staging_dist_dir -iname "node_modules" -type d -exec rm -rf "{}" \; 2> /dev/null
echo "find $staging_dist_dir -iname "package-lock.json" -type f -exec rm -f "{}" \; 2> /dev/null"
find $staging_dist_dir -iname "package-lock.json" -type f -exec rm -f "{}" \; 2> /dev/null

echo "------------------------------------------------------------------------------" 
echo "Package Network Firewall Automation node project for Code Build/Deploy stage " 
echo "------------------------------------------------------------------------------" 
cd $source_dir/networkFirewallAutomation/
npm install
npm run build
npm run zip
if [ "$?" = "1" ]; then
	echo "(npm run zip) ERROR: there is likely output above." 1>&2
	exit 1
fi
echo "Copy package zip to dist directory"
echo "cp ./dist/network-firewall-automation.zip $build_dist_dir/network-firewall-automation.zip"
cp ./dist/network-firewall-automation.zip $build_dist_dir/network-firewall-automation.zip

# build regional rule groups zip files for each region
echo "Copying network firewall configurations to deployment folder"
cd $template_dir
cp -pr $source_dir/networkFirewallAutomation/config/* ./
echo -e "\n Creating a zip file with network firewall configurations"
echo -e "\n Building network firewall configuration"
zip -Xr "$build_dist_dir"/network-firewall-configuration.zip ./firewalls ./ruleGroups ./firewallPolicies ./examples

echo "------------------------------------------------------------------------------"
echo "[Cleanup] Remove temporary files"
echo "------------------------------------------------------------------------------"

# Delete the temporary /staging folder
echo "rm -rf $staging_dist_dir"
rm -rf $staging_dist_dir
rm -rf ./ruleGroups
rm -rf ./firewallPolicies
rm -rf ./firewalls
