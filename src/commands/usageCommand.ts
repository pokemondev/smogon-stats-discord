import Discord = require('discord.js');
import { Command } from "./command";
import { AppDataSource } from "../appDataSource";
import { ColorService } from '../pokemon/colorService';
import { FormatHelper } from '../smogon/formatHelper';
import { ImageService } from '../pokemon/imageService';

export class UsageCommand implements Command {
  name = "usage";
  description = "Lists the top most used Pokémon";
  aliases = [ 'u', 'usages', 'uso' ];

  dataSource: AppDataSource;

  constructor(dataSource: AppDataSource) {
    this.dataSource = dataSource;
  }
  
  async execute(message: any, args: any) {
    const format = FormatHelper.getFormat(args);
    const usageData = await this.dataSource.smogonStats.getUsages(format);
    const firstMon = this.dataSource.pokemonDb.getPokemon(usageData[0].name);

    const embed = new Discord.MessageEmbed()
      .setColor(ColorService.getColorForType(firstMon.type1))
      .setThumbnail(ImageService.getPngUrl(firstMon))

    usageData.forEach((mon, i) => {
      embed.addField(`Rank ${i + 1}º ${mon.name}`, `Usage: ${mon.usageRaw.toFixed(2)}%`, true);
    });

    const msgHeader = `**__Usage:__** Top ${usageData.length} most used Pokémon of ${FormatHelper.toString(format)}`;
    message.channel.send(msgHeader, embed);
  }
}
