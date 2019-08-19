import Discord = require('discord.js');
import { Command } from "./command";
import { AppDataSource } from "../appDataSource";
import { ColorHelper } from '../pokemon/helpers';

export class UsageCommand implements Command {
  name = "usage";
  description = "Lists the top 10 most used Pokémon";

  dataSource: AppDataSource;

  constructor(dataSource: AppDataSource) {
    this.dataSource = dataSource;
  }
  
  execute(message: any, args: any) {

    const usageData = this.dataSource.smogonStats.getUsage();
    const firstMon = this.dataSource.pokemonDb.getPokemon(usageData[0].name);

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(firstMon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${firstMon.name.toLowerCase()}.png`)

    usageData.forEach((mon, i) => {
      embed.addField(`Rank ${i + 1}º ${mon.name}`, `Usage: ${mon.usageRaw.toFixed(2)}%`, true);
    });

    const msgHeader = '**__Usage:__** Top 10 most used Pokémon of Gen 7 OU';
    message.channel.send(msgHeader, embed);
  }
}
