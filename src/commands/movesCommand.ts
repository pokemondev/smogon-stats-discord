import Discord = require('discord.js');
import { Command } from "./command";
import { AppDataSource } from "../appDataSource";
import { ColorHelper } from '../pokemon/helpers';

export class LeadsCommand implements Command {
  name = "moves";
  description = "Lists the top 10 most used Pokémon";

  private dataSource: AppDataSource;

  constructor(dataSource: AppDataSource) {
    this.dataSource = dataSource;
  }
  
  execute(message: any, args: any) {

    if (!args.length) {
      return message.channel.send(`You didn't provide the Pokémon, ${message.author}!`);
    }

    const pokemonArg = args.join(' ');
    const moveset = this.dataSource.smogonStats.getMoveSet(pokemonArg);
    const pokemon = this.dataSource.pokemonDb.getPokemon(pokemonArg);

    if (!moveset) {
      return message.channel.send(`Could not find moveset for the provided Pokémon: '${pokemonArg}', ${message.author}!`);
    }

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(pokemon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${pokemonArg.replace(/ /g, '').toLowerCase()}.png`)

    moveset.moves.forEach((move, i) => {
      embed.addField(`${move.name}`, `Usage: ${move.percentage.toFixed(2)}%`, true);
    });

    const msgHeader = `**__${moveset.name} Moves:__**`;
    message.channel.send(msgHeader, embed);
  }
}
