import Discord = require('discord.js');
import { Command } from "./command";
import { AppDataSource } from "../appDataSource";
import { ColorService } from '../pokemon/colorService';
import { FormatHelper } from '../smogon/formatHelper';
import { ImageService } from '../pokemon/imageService';

export class LeadsCommand implements Command {
  name = "leads";
  description = "Lists the top leads Pokémon";
  aliases = [ 'l', 'lead', 'lider' ];

  private dataSource: AppDataSource;

  constructor(dataSource: AppDataSource) {
    this.dataSource = dataSource;
  }
  
  async execute(message: any, args: any) {
    const format = FormatHelper.getFormat(args);
    const leads = await this.dataSource.smogonStats.getLeads(format);
    const firstMon = this.dataSource.pokemonDb.getPokemon(leads[0].name);

    const embed = new Discord.RichEmbed()
      .setColor(ColorService.getColorForType(firstMon.type1))
      .setThumbnail(ImageService.getPngUrl(firstMon))

    leads.forEach((mon, i) => {
      embed.addField(`Lead ${i + 1}º ${mon.name}`, `Usage: ${mon.usageRaw.toFixed(2)}%`, true);
    });

    const msgHeader = `**__Leads:__** Top ${leads.length} leads of ${FormatHelper.toString(format)}`;
    message.channel.send(msgHeader, embed);
  }
}
