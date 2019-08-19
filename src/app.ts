import Discord = require('discord.js');
import fs = require("fs");
import { SmogonStats } from './smogon/smogonStats';
import { PokemonDb } from './pokemon/pokemonDb';
import { ColorHelper } from './pokemon/helpers';
import { Command } from './commands/command';
import { AppDataSource } from './appDataSource';

// setup & load config
require('dotenv').config();
const smogonStats = new SmogonStats();
const pokemonDb = new PokemonDb();
const dataSource = new AppDataSource();
const prefix = '/';

// setup client and commands
const client = new Discord.Client();
const commands = new Discord.Collection();

const commandFiles = fs.readdirSync(__dirname + '/commands').filter(file => file.endsWith('.js') && file !== 'command.js');
console.log(commandFiles);
for (const file of commandFiles) {
  const cmdModule = require(`${__dirname }/commands/${file}`);
  const command = new (<any>cmdModule)[Object.keys(cmdModule)[0]](dataSource) as Command;
	commands.set(command.name, command);
}

// discord events
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {

  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).split(/ +/);
  const commandName = args.shift().toLowerCase();
  console.log(commandName);
  console.log(args);

  // test commands
  if (commandName === 'ping') {
    (commands.get('ping') as Command).execute(msg, args);
  }

  if (commandName === 'server') {
    msg.channel.send(`Server name: ${msg.guild.name}\nTotal members: ${msg.guild.memberCount}`);
  }

  if (commandName === 'args-info') {
    if (!args.length) {
      return msg.channel.send(`You didn't provide any arguments, ${msg.author}!`);
    }

    msg.channel.send(`Command name: ${commandName}\nArguments: ${args}`);
  }

  // all commands
  if (!commands.has(commandName)) return;

  try {
    (commands.get(commandName) as Command).execute(msg, args);
  } catch (error) {
    console.error(error);
    msg.reply('there was an error trying to execute that command!');
  }  
});

client.login(process.env.TOKEN);