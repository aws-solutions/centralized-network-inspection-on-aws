#!/bin/bash
 #
 # Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 # SPDX-License-Identifier: Apache-2.0
 #

# Check to see if the required parameters have been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the artifact code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

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

[ "$DEBUG" == 'true' ] && set -x
set -e

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
echo "npm ci"
npm ci

# Run 'cdk synth' to generate raw solution outputs
cd "$source_dir"
echo "npm run cdk -- synth --output=$staging_dist_dir"
npm run build
npm run cdk -- synth --output=$staging_dist_dir

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

# Replace references to version
replace="s/%%VERSION%%/$DIST_VERSION/g"
echo "sed -i $replace $template_dist_dir/*.template"
sed -i -e $replace $template_dist_dir/*.template

echo "------------------------------------------------------------------------------"
echo "[Packing] Source code artifacts"
echo "------------------------------------------------------------------------------"

# General cleanup of node_modules and package-lock.json files
echo "find $staging_dist_dir -iname "node_modules" -type d -exec rm -rf "{}" \; 2> /dev/null"
find $staging_dist_dir -iname "node_modules" -type d -exec rm -rf "{}" \; 2> /dev/null
echo "find $staging_dist_dir -iname "package-lock.json" -type f -exec rm -f "{}" \; 2> /dev/null"
find $staging_dist_dir -iname "package-lock.json" -type f -exec rm -f "{}" \; 2> /dev/null

echo "------------------------------------------------------------------------------" 
echo "Package Centralized Network Inspection on AWS node project for Code Build/Deploy stage "
echo "------------------------------------------------------------------------------" 
cd $source_dir/centralizedNetworkInspection/
npm install
npm run build
npm run zip
if [ "$?" = "1" ]; then
	echo "(npm run zip) ERROR: there is likely output above." 1>&2
	exit 1
fi
echo "Copy package zip to dist directory"
echo "cp ./dist/centralized-network-inspection.zip $build_dist_dir/centralized-network-inspection.zip"
cp ./dist/centralized-network-inspection.zip $build_dist_dir/centralized-network-inspection.zip

# build regional rule groups zip files for each region
echo "Copying network firewall configurations to deployment folder"
cd $template_dir
cp -pr $source_dir/centralizedNetworkInspection/config/* ./
echo -e "\n Creating a zip file with network firewall configurations"
echo -e "\n Building network firewall configuration"
zip -Xr "$build_dist_dir"/centralized-network-inspection-configuration.zip ./firewalls ./ruleGroups ./firewallPolicies ./examples

echo "------------------------------------------------------------------------------"
echo "[Cleanup] Remove temporary files"
echo "------------------------------------------------------------------------------"

# cleanup generated files
cd $source_dir/centralizedNetworkInspection/
npm run cleanup:tsc
npm run cleanup:dist

cd $source_dir/
npm run cleanup:tsc

# Delete the temporary /staging folder
echo "rm -rf $staging_dist_dir"
rm -rf $staging_dist_dir
rm -rf ./ruleGroups
rm -rf ./firewallPolicies
rm -rf ./firewalls
