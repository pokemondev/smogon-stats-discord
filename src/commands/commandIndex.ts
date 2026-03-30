import { AppDataSource } from '../appDataSource';
import { BotConfig } from '../config/configHelper';
import { SlashCommandHandler } from './command';
import { HelpCommand, createHelpCommandData, helpHelpTopic } from './helpCommand';
import { createStatsCommandData, StatsCommand, statsHelpTopic } from './statsCommand';
import { PokemonCommand, createPokemonCommandData, pokemonHelpTopic } from './pokemonCommand';
import { UtilCommand, createUtilCommandData } from './utilCommand';

const helpTopics = [pokemonHelpTopic, statsHelpTopic, helpHelpTopic];

export function createCommands(dataSource: AppDataSource, botConfig: BotConfig): SlashCommandHandler[] {
  return [
    new PokemonCommand(dataSource),
    new StatsCommand(dataSource),
    new UtilCommand(dataSource),
    new HelpCommand(helpTopics, botConfig.client.botName),
  ];
}

export function createCommandData() {
  return [
    createPokemonCommandData(),
    createStatsCommandData(),
    createUtilCommandData(),
    createHelpCommandData(helpTopics),
  ];
}