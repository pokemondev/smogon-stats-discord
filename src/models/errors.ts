import { SmogonFormat } from "../smogon/usageModels";

export class DataFileError extends Error {
  public readonly filename: string;
  public readonly code: string;

  constructor(filename: string, message: string, code?: string) {
    super(message);
    this.name = 'DataFileError';
    this.filename = filename;
    this.code = code;
    Object.setPrototypeOf(this, DataFileError.prototype);
  }
}

export class SmogonStatsError extends Error {
  public readonly statsType: string;
  public readonly format: SmogonFormat;

  constructor(statsType: string, format: SmogonFormat, message: string) {
    super(message);
    this.name = 'SmogonStatsError';
    this.statsType = statsType;
    this.format = format;
    Object.setPrototypeOf(this, SmogonStatsError.prototype);
  }
}