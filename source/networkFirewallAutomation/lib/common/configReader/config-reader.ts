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
import * as fs from 'fs'
import * as path from 'path'
import { Logger, LOG_LEVEL } from '../logger'

export enum ConfigPath {
  firewallDirectory = '/firewalls'
}
/**
  * @description This class reads the json files and return file objects
  */
export class ConfigReader {

  /** 
  * @description This method will return the json file names in the path.
  * @param directoryPath string value of the file system path.
  * @returns Array of file names.
  */
  getJSONFileNames(directoryPath: string): string[] {
    Logger.log(LOG_LEVEL.DEBUG, `Config directory path: ${directoryPath}`)
    return fs.readdirSync(directoryPath)
      .filter((name: any) => path.extname(name) === '.json')
      .map((name: any) => (path.join(directoryPath, name)))
  }

  /**
   * This method will read the file contents and attempt to convert the file content into JSON object.
   * @returns JSON object of the file content.
   * @param filePath string value of absolute file path.
   */
  convertFileToObject(filePath: string): any {
    Logger.log(LOG_LEVEL.DEBUG, `Returning object for file: ${filePath}`)
    return JSON.parse(fs.readFileSync(filePath).toString())
  }

  /**
   * This method will read the file contents and attempt to convert the file content into a string. Method will return an empty string
   * if the file path is incorrect or invalid.
   * @returns String representation of the file content.
   * @param filePath string value of absolute file path.
   */
  copyFileContentToString(filePath: string): any {
    Logger.log(LOG_LEVEL.DEBUG, `Returning string content for file: ${filePath}`)
    try {
      return fs.readFileSync(filePath).toString()
    } catch(error) {
      Logger.log(LOG_LEVEL.DEBUG, `Error converting the file content to string:`, error)
      return "";
    }
  }

}