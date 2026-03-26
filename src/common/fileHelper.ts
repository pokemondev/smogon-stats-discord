import fs = require("fs");
import { DataFileError } from "../models/errors";

export class FileHelper {
  public static loadFileData<T>(filename: string): T {
    return this.loadJsonFile(filename) as T;
  }

  public static loadFileDataAsAny(filename: string): any {
    return this.loadJsonFile(filename);
  }

  private static loadJsonFile(filename: string): any {
    const filePath = `data/${filename}`;

    try {
      const rawdata = fs.readFileSync(filePath).toString();
      return JSON.parse(rawdata);
    }
    catch (error) {
      throw this.buildFileError(filePath, error);
    }
  }

  private static buildFileError(filePath: string, error: any): DataFileError {
    const details = error && error.message ? error.message : 'Unknown error';
    return new DataFileError(
      filePath,
      `Could not load data file '${filePath}': ${details}`,
      error && error.code ? error.code : undefined
    );
  }
}