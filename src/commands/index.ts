import { AppDataSource } from '../appDataSource';
import { SlashCommandHandler } from './command';
import { HelpCommand, createHelpCommandData, helpHelpTopic } from './helpCommand';
import { MetaCommand, createMetaCommandData, metaHelpTopic } from './metaCommand';
import { PokemonCommand, createPokemonCommandData, pokemonHelpTopic } from './pokemonCommand';
import { UtilCommand, createUtilCommandData, utilHelpTopic } from './utilCommand';

const helpTopics = [pokemonHelpTopic, metaHelpTopic, utilHelpTopic, helpHelpTopic];

export function createCommands(dataSource: AppDataSource): SlashCommandHandler[] {
  return [
    new PokemonCommand(dataSource),
    new MetaCommand(dataSource),
    new UtilCommand(),
    new HelpCommand(helpTopics),
  ];
}

export function createCommandData() {
  return [
    createPokemonCommandData(),
    createMetaCommandData(),
    createUtilCommandData(),
    createHelpCommandData(helpTopics),
  ];
}