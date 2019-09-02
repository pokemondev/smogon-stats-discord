import Discord = require('discord.js');
import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";
import { ColorHelper } from '../pokemon/helpers';
import { FormatHelper } from '../smogon/helpers';

export class PokemonCommand extends CommandBase {
  name = "pokemon";
  description = "Lists the most used moves of a given Pokémon";
  aliases = [ 'p', 'pkm', 'mon' ];

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    const cmd = this.tryGetMoveSetCommand(message, args);
    if (!cmd.valid) return;

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(cmd.pokemon.type1))
      .setImage(`https://play.pokemonshowdown.com/sprites/xyani/${cmd.pokemon.name.replace(/ /g, '').toLowerCase()}.gif`)

    // base stats
    const stats = cmd.pokemon.baseStats;
    const baseStatsH1 = "__\`HP      Atk     Def\`__".replace(new RegExp(' ', 'g'), "\u2006");
    const baseStatsH2 = "__\`Sp.Atk  Sp.Def  Spe\`__".replace(new RegExp(' ', 'g'), "\u2006");
    const baseStatsL1 = `${baseStatsH1}\n\`${stats.hp.toString().padEnd(8, "\u2006")}${stats.atk.toString().padEnd(8, "\u2005")}${stats.def}\``;
    const baseStatsL2 = `${baseStatsH2}\n\`${stats.spA.toString().padEnd(8, "\u2006")}${stats.spD.toString().padEnd(8, "\u2006")}${stats.spe}\``;
    const baseStatsData = `${baseStatsL1}\n${baseStatsL2}`;
    embed.addField("Base Stats Total: " + stats.tot, baseStatsData, true);

    const abilities = cmd.moveSet.abilities.map(a => `${a.name}: \`${a.percentage.toFixed(2)}%\``).join('\n');
    embed.addField("Abilities", abilities, true);

    const weak = "**Weak:** type1, type2, xxxxxxxx\n**Resist:** type4, yyyyy"
    embed.addField("Weak/Resist", weak, true);

    const moves = cmd.moveSet.moves.slice(0, 6).map(m => `\`${m.name}: ${m.percentage.toFixed(2)}%\``).join('\n');
    embed.addField("Moves", moves, true);

    const items = cmd.moveSet.items.slice(0, 6).map(i => `\`${i.name}: ${i.percentage.toFixed(2)}%\``).join('\n');
    embed.addField("Items", items, true);

    const spreads = cmd.moveSet.spreads.slice(0, 6).map(iv => `\`${iv.name}: ${iv.percentage.toFixed(2)}%\``).join('\n');
    embed.addField("Nature/IV spread", spreads, true);

    const msgHeader = `**__${cmd.pokemon.name}:__** ${FormatHelper.toReadableString(cmd.format)}`;
    message.channel.send(msgHeader, embed);
  }
}
