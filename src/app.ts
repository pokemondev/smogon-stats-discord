import * as smogon from './smogon/smogonStats';
import Discord = require('discord.js');
const smogonStats = new smogon.SmogonStats();
const client = new Discord.Client();
const token = 'NjEwOTQ1ODUwNTU3OTg4ODk0.XVidpA.WVzSlx65vtR08NeKigF-e9lgt1E';
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
    console.log(leads);

    const embed = new Discord.RichEmbed()
      .setColor('#f50057')
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${leads[0].name.toLowerCase()}.png`)

    leads.forEach((mon, i) => {
      //embed.addField('Pokémon', mon, true)
      embed.addField(`Lead ${i + 1}º ${mon.name}`, `Usage: ${mon.usageRaw.toFixed(2)}%`, true);
    });

    const msgHeader = '**__Leads:__** Top 10 leads of Gen 7 OU';
    msg.channel.send(msgHeader, embed);
  }

  if (msg.content === `${prefix}usage`) {
    let leads = smogonStats.getUsage();
    console.log(leads);

    const embed = new Discord.RichEmbed()
      .setColor('#f50057')
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${leads[0].name.toLowerCase()}.png`)

    leads.forEach((mon, i) => {
      embed.addField(`Rank ${i + 1}º ${mon.name}`, `Usage: ${mon.usageRaw.toFixed(2)}%`, true);
    });

    const msgHeader = '**__Usage:__** Top 10 most used Pokémon of Gen 7 OU';
    msg.channel.send(msgHeader, embed);
  }

  if (commandName === 'moves') {
    if (!args.length) {
      return msg.channel.send(`You didn't provide the Pokémon, ${msg.author}!`);
    }

    const pokemon = args.join(' ');
    const moveset = smogonStats.getMoveSet(pokemon);

    if (!moveset) {
      return msg.channel.send(`Could not find moveset for the provided Pokémon: '${pokemon}', ${msg.author}!`);
    }

    const embed = new Discord.RichEmbed()
      .setColor('#f50057')
      .setThumbnail(`https://play.pokemonshowdown.com/sprites/bw/${pokemon.replace(/ /g, '').toLowerCase()}.png`)

    moveset.moves.forEach((move, i) => {
      embed.addField(`${move.name}`, `Usage: ${move.percentage.toFixed(2)}%`, true);
    });

    const msgHeader = `**__${moveset.name} Moves:__**`;
    msg.channel.send(msgHeader, embed);
  }
});

client.login(token);
//console.log(smogonStats.getLeads());