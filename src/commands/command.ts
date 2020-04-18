import Discord = require('discord.js');
import { AppDataSource } from "../appDataSource";
import { MoveSetUsage, UsageData, ChecksAndCountersUsageData, SmogonFormat } from "../smogon/models";
import { ColorService } from '../pokemon/colorService';
import { FormatHelper } from '../smogon/helpers';
import { Pokemon } from '../pokemon/models';
import { format } from 'util';

export interface Command {
  name: string;
  description: string;
  aliases: string[];
	execute(message, args);
}

type ArgData = { valid: boolean, pokemon: string, format: SmogonFormat };
export type MovesetCommandData = { valid: boolean, pokemon: Pokemon, moveSet: MoveSetUsage, format: SmogonFormat };

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

  public async tryGetMoveSetCommand(message, args: string[]): Promise<MovesetCommandData> {
    if (!args.length) {
      let reply = `You didn't provide the Pokémon, ${message.author}!`;
      reply += `\nThe proper usage would be: \`/${this.usage}\``;
      reply += `\neg.:`;
      reply += `\n/${this.name} magearna`;
      reply += `\n/${this.name} alakazam gen6`;
      reply += `\n/${this.name} scizor uu`;
      reply += `\n/${this.name} machamp gen6 uu`;
      message.channel.send(reply);

      return { valid: false, pokemon: undefined, moveSet: undefined, format: undefined };
    }

    const argData = this.parseArgs(args);
    const pokemon = this.dataSource.pokemonDb.getPokemon(argData.pokemon);
    if (!pokemon) {
      message.channel.send(`Could not find moveset for the provided Pokémon: '${argData.pokemon}' and format: ${FormatHelper.toString(argData.format)}, ${message.author}!`);
      return { valid: false, pokemon: undefined, moveSet: undefined, format: argData.format };
    }
    
    if (pokemon.generation == "SwordShield") // fix for gen8 pokemon while better solution is implement 
      argData.format = { generation: "gen8", tier: argData.format.tier };

    let moveset = await this.dataSource.smogonStats.getMoveSet(pokemon.name, argData.format);
    moveset = moveset ? moveset : {} as MoveSetUsage;
    
    return { valid: true, pokemon: pokemon, moveSet: moveset, format: argData.format };
  }

  public async processMoveSetCommand(message, 
                                     args: string[], 
                                     targetData: (data: MoveSetUsage) => UsageData[] | ChecksAndCountersUsageData[]) {
    const cmd = await this.tryGetMoveSetCommand(message, args);
    if (!cmd.valid) return;
    
    const embed = new Discord.RichEmbed()
      .setColor(ColorService.getColorForType(cmd.pokemon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${cmd.pokemon.name.replace(/ /g, '').toLowerCase()}.png`)

    const moveSetdata = targetData(cmd.moveSet);
    if (moveSetdata) {
      moveSetdata.forEach((data, i) => {
        const value = this.isCheckAndCounters(data)
          ? `Knocked out : ${data.kOed.toFixed(2)}%\nSwitched out: ${data.switchedOut.toFixed(2)}%`
          : `Usage: ${data.percentage.toFixed(2)}%`;
  
        embed.addField(`${data.name}`, value, true);
      });
    }

    const msgHeader = `**__${cmd.pokemon.name} ${this.displayName}:__** ${FormatHelper.toString(cmd.format)}`;
    message.channel.send(msgHeader, embed);
  }

  public async processFilterBasedCommand(message, 
                                         args: string[], 
                                         targetData: (data: MoveSetUsage) => UsageData[]){
    const format = FormatHelper.getFormat(args);
    const movesets = await this.dataSource.smogonStats.getMegasMoveSets(format);
        
    if (!movesets || movesets.length == 0) {
      return message.channel.send(`Could not find moveset for the provided data: '${FormatHelper.toString(format)}', ${message.author}!`);
    }
    
    const pokemon = this.dataSource.pokemonDb.getPokemon(movesets[0].name);

    const embed = new Discord.RichEmbed()
      .setColor(ColorService.getColorForType(pokemon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${pokemon.name.replace(/ /g, '').toLowerCase()}.png`)

    movesets.forEach((set, i) => {
      embed.addField(`${set.name}`, `Usage: ${set.usage.toFixed(2)}%`, true);
    });

    const msgHeader = `**__${this.displayName}:__** Top ${movesets.length} ${this.displayName} users of ${FormatHelper.toString(format)}`;
    message.channel.send(msgHeader, embed);
  }

  // helpers
  private isCheckAndCounters(obj: any): obj is ChecksAndCountersUsageData {
    return obj.kOed !== undefined; 
  }

  private parseArgs(args: string[]): ArgData {
    if (args.length == 0)
      return { valid: false, pokemon: undefined, format: undefined };
    
    if (args.length == 1)
      return { valid: true, pokemon: args[0], format: FormatHelper.getDefault() };

    const hasPokemonSecondName = !FormatHelper.isValidGen(args[1]) && !FormatHelper.isValidTier(args[1]);
    
    let pokemonName = hasPokemonSecondName
      ? `${args[0]} ${args[1]}`
      : args[0]

    if (pokemonName.toLowerCase().startsWith("mega"))
      pokemonName = pokemonName.substring(4).trim().concat("-mega");

    if (pokemonName.toLowerCase().startsWith("gmax"))
      pokemonName = pokemonName.substring(4).trim().concat("-gmax");
      
    if (pokemonName.toLowerCase().startsWith("galar"))
      pokemonName = pokemonName.substring(5).trim().concat("-galar");

    if (pokemonName.toLowerCase().startsWith("galarian"))
      pokemonName = pokemonName.substring(8).trim().concat("-galar");
      
      
    const format = FormatHelper.getFormat(args.slice(hasPokemonSecondName ? 2 : 1));

    return { valid: true, pokemon: pokemonName, format: format };
  }
}
