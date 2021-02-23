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

import { Logger, LOG_LEVEL } from './logger'

export enum Name {
  maxCharacters = 128,
  delimiter= '-'
}

/**
 * @description This class performs string manipulation operations
 */
export class StringUtils {

  constructor(readonly stackId: string) {
  }


  /**
   * @description This method will return name of the resource with parsed
   * stack id and validates the max character allowed
   * @param resourceName
   * @returns modified resource name.
   */
  getUniqueResourceName(resourceName: string) {
    Logger.log(LOG_LEVEL.DEBUG, `Resource name input: ${resourceName}`)
    if (this.stackId) {
      const splitStackId = this.stackId.split("-").pop()
      let customName = resourceName + Name.delimiter + splitStackId
      if (splitStackId && customName.length > Name.maxCharacters) {
        const sliceString = Name.maxCharacters - (splitStackId.length + Name.delimiter.length)
        Logger.log(LOG_LEVEL.INFO, `Modified name is larger than 128 characters, trimming the resource name and using only first ${sliceString.toString()} characters from the name.`)
        const trimmedResourceName = resourceName.substring(0, sliceString)
        customName = trimmedResourceName + Name.delimiter + splitStackId
      }
      Logger.log(LOG_LEVEL.DEBUG, `Returning Custom name : ${resourceName}`)
      return customName
    }
    else {
      throw Error("The stack id environment variable is undefined in the" +
        " CodeBuild stage environment variables.")
    }
  }
}