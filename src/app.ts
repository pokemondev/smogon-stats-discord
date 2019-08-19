import Discord = require('discord.js');
import { SmogonStats } from './smogon/smogonStats';
import { PokemonDb } from './pokemon/pokemonDb';
import { ColorHelper } from './pokemon/helpers';
import { PokemonType } from './pokemon/models';

const smogonStats = new SmogonStats();
const pokemonDb = new PokemonDb();
const client = new Discord.Client();
const token = 'NjEwOTQ1ODUwNTU3OTg4ODk0.XVp_Mw.eAGjaBqoQ5V7dkEyt9XdD-VMPDo';
const prefix = '/';

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {

  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).split(' ');
  const commandName = args.shift().toLowerCase();
  console.log(commandName);
  console.log(args);

  if (msg.content === `${prefix}ping`) {
    msg.reply('Pong!');
  }

  if (msg.content === `${prefix}server`) {
    msg.channel.send(`Server name: ${msg.guild.name}\nTotal members: ${msg.guild.memberCount}`);
  }

  if (commandName === 'args-info') {
    if (!args.length) {
      return msg.channel.send(`You didn't provide any arguments, ${msg.author}!`);
    }

    msg.channel.send(`Command name: ${commandName}\nArguments: ${args}`);
  }

  if (msg.content === `${prefix}leads`) {
    let leads = smogonStats.getLeads();
    const firstMon = pokemonDb.getPokemon(leads[0].name);
    console.log(leads);

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(firstMon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${firstMon.name.toLowerCase()}.png`)

    leads.forEach((mon, i) => {
      //embed.addField('Pokémon', mon, true)
      embed.addField(`Lead ${i + 1}º ${mon.name}`, `Usage: ${mon.usageRaw.toFixed(2)}%`, true);
    });

    const msgHeader = '**__Leads:__** Top 10 leads of Gen 7 OU';
    msg.channel.send(msgHeader, embed);
  }

  if (msg.content === `${prefix}usage`) {
    const usageData = smogonStats.getUsage();
    const firstMon = pokemonDb.getPokemon(usageData[0].name);
    console.log(usageData);

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(firstMon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${firstMon.name.toLowerCase()}.png`)

    usageData.forEach((mon, i) => {
      embed.addField(`Rank ${i + 1}º ${mon.name}`, `Usage: ${mon.usageRaw.toFixed(2)}%`, true);
    });

    const msgHeader = '**__Usage:__** Top 10 most used Pokémon of Gen 7 OU';
    msg.channel.send(msgHeader, embed);
  }

  if (commandName === 'moves') {
    if (!args.length) {
      return msg.channel.send(`You didn't provide the Pokémon, ${msg.author}!`);
    }

    const pokemonArg = args.join(' ');
    const moveset = smogonStats.getMoveSet(pokemonArg);
    const pokemon = pokemonDb.getPokemon(pokemonArg);

    if (!moveset) {
      return msg.channel.send(`Could not find moveset for the provided Pokémon: '${pokemonArg}', ${msg.author}!`);
    }

    const embed = new Discord.RichEmbed()
      .setColor(ColorHelper.getColorForType(pokemon.type1))
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${pokemonArg.replace(/ /g, '').toLowerCase()}.png`)

    moveset.moves.forEach((move, i) => {
      embed.addField(`${move.name}`, `Usage: ${move.percentage.toFixed(2)}%`, true);
    });

    const msgHeader = `**__${moveset.name} Moves:__**`;
    msg.channel.send(msgHeader, embed);
  }
});

client.login(token);
//console.log(smogonStats.getLeads());