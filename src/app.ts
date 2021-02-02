import fs = require("fs");
import Discord = require('discord.js');
import { Command } from './commands/command';
import { AppDataSource } from './appDataSource';

// setup & load config
require('dotenv').config();
const dataSource = new AppDataSource();
const prefix = '/';

// setup client and commands
const client = new Discord.Client();
const commands = new Discord.Collection<string, Command>();

const commandFiles = fs.readdirSync(__dirname + '/commands').filter(file => file.endsWith('.js') && file !== 'command.js');
console.log(commandFiles);
for (const file of commandFiles) {
  const cmdModule = require(`${__dirname }/commands/${file}`);
  const command = new (<any>cmdModule)[Object.keys(cmdModule)[0]](dataSource) as Command;
  
  commands.set(command.name, command);
  if (command.aliases.length > 0) {
    for (const alias of command.aliases) {
      commands.set(alias, command);
    }
  }
}
dataSource.botCommands = commands;

// discord events
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {

  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).split(/ +/);
  const commandName = args.shift().toLowerCase();

  try {
    const command = commands.get(commandName) as Command;
    if (!command) return;

    command.execute(msg, args);
  } 
  catch (error) {
    console.error(error);
    msg.reply('there was an error trying to execute that command!');
  }  
});

const isDebug = process.argv.some(a=> a == "debug");
if (isDebug)
{
  console.log("Debug Mode On!")
  client.on('debug', console.log);
}

client.login(process.env.TOKEN);