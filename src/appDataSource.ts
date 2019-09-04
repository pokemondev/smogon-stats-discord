import Discord = require('discord.js');
import { SmogonStats } from './smogon/smogonStats';
import { PokemonDb } from './pokemon/pokemonDb';
import { Command } from './commands/command';

export class AppDataSource {
  private commands = new Discord.Collection<string, Command>();
  
  public smogonStats = new SmogonStats();
  public pokemonDb = new PokemonDb();

  public get botCommands() { return this.commands; }
  public set botCommands(cmds) { this.commands = cmds; }
}