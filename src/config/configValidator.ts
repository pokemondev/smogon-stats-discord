import { config } from 'dotenv';
import { SmogonFormat } from '../smogon/usageModels';
import { FormatConfig } from './formatConfig';

export interface BotClientConfig {
  token: string;
  clientId?: string;
  developmentGuildId?: string;
}

export interface BotConfig {
  client: BotClientConfig;
  defaultFormat: SmogonFormat;
}

export interface ConfigValidationOptions {
  requireClientId?: boolean;
  loadEnvironment?: boolean;
}

export class ConfigHelper {
  private static hasLoadedEnvironment = false;

  public static loadAndValidate(options: ConfigValidationOptions = {}): BotConfig {
    this.loadEnvironmentVariables(options.loadEnvironment !== false);

    return {
      client: this.getBotClientConfig(options),
      defaultFormat: FormatConfig.getDefaultFormat(),
    };
  }

  private static loadEnvironmentVariables(shouldLoadEnvironment: boolean): void {
    if (!shouldLoadEnvironment || this.hasLoadedEnvironment) {
      return;
    }

    config();
    this.hasLoadedEnvironment = true;
  }

  private static getBotClientConfig(options: ConfigValidationOptions): BotClientConfig {
    const token = this.getRequiredEnvironmentVariable(
      'TOKEN',
      options.requireClientId
        ? 'TOKEN environment variable is required to register commands.'
        : 'TOKEN environment variable is required.'
    );
    const clientId = options.requireClientId
      ? this.getRequiredEnvironmentVariable('CLIENT_ID', 'CLIENT_ID environment variable is required to register commands.')
      : process.env.CLIENT_ID;

    return {
      token,
      clientId,
      developmentGuildId: process.env.DEV_GUILD_ID,
    };
  }

  private static getRequiredEnvironmentVariable(name: string, errorMessage: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(errorMessage);
    }

    return value;
  }
}