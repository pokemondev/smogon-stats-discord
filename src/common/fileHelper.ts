import fs = require("fs");

export class FileHelper {
  public static loadFileData<T>(filename: string): T {
    const rawdata = fs.readFileSync(`data/${filename}`).toString();
    const data:T = JSON.parse(rawdata);
    return data;
  }

  public static loadFileDataAsAny(filename: string): any {
    const rawdata = fs.readFileSync(`data/${filename}`).toString();
    return JSON.parse(rawdata);
  }
}