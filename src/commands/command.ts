import Discord = require('discord.js');
import { AppDataSource } from "../appDataSource";
import { MoveSetUsage, UsageData, ChecksAndCountersUsageData, SmogonFormat } from "../smogon/models";
import { ColorHelper } from '../pokemon/helpers';
import { type } from 'os';
import { format } from 'path';
import { FormatHelper } from '../smogon/helpers';

export interface Command {
  name: string;
  description: string;
  aliases: string[];
	execute(message, args);
}

type ArgData = { valid: boolean, pokemon: string, format: SmogonFormat };

export class CommandBase implements Command {
  name: string;
  description: string;
  dataSource: AppDataSource;
  aliases: string[] = [];
  
  constructor(dataSource: AppDataSource) {
    this.dataSource = dataSource;
  }
  
  execute(message: any, args: any) {
    throw new Error("Method not implemented.");
  }
  
  get usage() { return `${this.name} <pokémon name> [gen] | [tier]`; }

  get displayName(): string {
    return this.name
      ? this.name.charAt(0).toUpperCase() + this.name.slice(1)
      : '';
  }

  public processMoveSetCommand(message, 
                               args: string[], 
                               targetData: (data: MoveSetUsage) => UsageData[] | ChecksAndCountersUsageData[]) {
    if (!args.length) {
      let reply = `You didn't provide the Pokémon, ${message.author}!`;
      reply += `\nThe proper usage would be: \`/${this.usage}\``;
      reply += `\neg.:`;
      reply += `\n/${this.name} magearna`;
      reply += `\n/${this.name} alakazam gen6`;
      reply += `\n/${this.name} scizor uu`;
      reply += `\n/${this.name} machamp gen6 uu`;
      return message.channel.send(reply);
    }

    var argData = this.parseArgs(args);
    const moveset = this.dataSource.smogonStats.getMoveSet(argData.pokemon, argData.format);
    const pokemon = this.dataSource.pokemonDb.getPokemon(argData.pokemon);

    if (!moveset) {
      return message.channel.send(`Could not find moveset for the provided Pokémon: '${argData.pokemon}', ${message.author}!`);
    }

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(pokemon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${pokemon.name.replace(/ /g, '').toLowerCase()}.png`)

    targetData(moveset).forEach((data, i) => {
      const value = this.isCheckAndCounters(data)
        ? `Knocked out : ${data.kOed.toFixed(2)}%\nSwitched out: ${data.switchedOut.toFixed(2)}%`
        : `Usage: ${data.percentage.toFixed(2)}%`;

      embed.addField(`${data.name}`, value, true);
    });

    const msgHeader = `**__${moveset.name} ${this.displayName}:__** ${FormatHelper.toReadableString(argData.format)}`;
    message.channel.send(msgHeader, embed);
  }

  public processFilterBasedCommand(message, 
                                   args: string[], 
                                   targetData: (data: MoveSetUsage) => UsageData[]){
    const pokemonArg = args.join(' ');
    const movesets = this.dataSource.smogonStats.getMegasMoveSets();
    // .getMoveSets(
    //   undefined,
    //   (e) => e.items.some(i => e.name.endsWith("-Mega") && i.name.endsWith('ite'))
    // ).slice(0, 10);
    
    if (!movesets || movesets.length == 0) {
      return message.channel.send(`Could not find moveset for the provided Pokémon: '${pokemonArg}', ${message.author}!`);
    }
    
    const pokemon = this.dataSource.pokemonDb.getPokemon(movesets[0].name);

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(pokemon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${pokemon.name.replace(/ /g, '').toLowerCase()}.png`)

    movesets.forEach((set, i) => {
      embed.addField(`${set.name}`, `Usage: ${set.usage.toFixed(2)}%`, true);
    });

    const msgHeader = `**__${this.displayName}:__** Top 10 ${this.displayName} users of Gen 7 OU`;
    message.channel.send(msgHeader, embed);
  }

  private isCheckAndCounters(obj: any): obj is ChecksAndCountersUsageData {
    return obj.kOed !== undefined; 
  }

  private parseArgs(args: string[]): ArgData {
    if (args.length == 0)
      return { valid: false, pokemon: undefined, format: undefined };
    
    if (args.length == 1)
      return { valid: true, pokemon: args[0], format: FormatHelper.getDefault() };

    const hasPokemonSecondName = !FormatHelper.isValidGen(args[1]) && !FormatHelper.isValidTier(args[1]);
    
    const pokemonName = hasPokemonSecondName
      ? `${args[0]} ${args[1]}`
      : args[0]

    const format = FormatHelper.getFormat(args.slice(hasPokemonSecondName ? 2 : 1));

    return { valid: true, pokemon: pokemonName, format: format };
  }
}
