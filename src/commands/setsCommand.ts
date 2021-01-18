import Discord = require('discord.js');
import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";
import { ColorService } from '../pokemon/colorService';
import { FormatHelper } from '../smogon/formatHelper';
import { ImageService } from '../pokemon/imageService';

export class SetsCommand extends CommandBase {
  name = "sets";
  description = "Lists the Smogon Sets for the Pokémon";
  aliases = [ 'set' ];

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  async execute(message: any, args: any) {
    const argsData = this.tryParseCommandArgs(message, args);
    if (!argsData.valid) {
      return message.channel.send(argsData.errorMessage);
    }
    
    const format = argsData.format;
    const pokemon = argsData.pokemon;
    const sets = this.dataSource.smogonSets.get(pokemon, format);

    const embed = new Discord.MessageEmbed()
      .setColor(ColorService.getColorForType(pokemon.type1))
      .setThumbnail(ImageService.getPngUrl(pokemon))
      .setFooter("More details on smogon.com")

    sets.forEach((set) => {
      var setText = FormatHelper.getSmogonSet(pokemon, set);
      embed.addField(`${set.name}`, `${setText}\u2006`, true);
    });

    const msgHeader = `**__Sets:__** Top ${pokemon.name} sets of ${FormatHelper.toString(format)}`;
    message.channel.send(msgHeader, embed);
  }
}
