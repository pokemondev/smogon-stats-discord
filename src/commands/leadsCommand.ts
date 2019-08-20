import Discord = require('discord.js');
import { Command } from "./command";
import { AppDataSource } from "../appDataSource";
import { ColorHelper } from '../pokemon/helpers';

export class LeadsCommand implements Command {
  name = "leads";
  description = "Lists the top 10 leads Pokémon";
  aliases = [ 'l', 'lead', 'lider' ];

  private dataSource: AppDataSource;

  constructor(dataSource: AppDataSource) {
    this.dataSource = dataSource;
  }
  
  execute(message: any, args: any) {

    let leads = this.dataSource.smogonStats.getLeads();
    const firstMon = this.dataSource.pokemonDb.getPokemon(leads[0].name);

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(firstMon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${firstMon.name.toLowerCase()}.png`)

    leads.forEach((mon, i) => {
      embed.addField(`Lead ${i + 1}º ${mon.name}`, `Usage: ${mon.usageRaw.toFixed(2)}%`, true);
    });

    const msgHeader = '**__Leads:__** Top 10 leads of Gen 7 OU';
    message.channel.send(msgHeader, embed);
  }
}
