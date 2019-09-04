import { Command } from "./command";
import { AppDataSource } from "../appDataSource";

export class HelpCommand implements Command {
  name = 'help';
  description = "Lists all available commands";
  aliases = [ 'commands' ];
  
  private appDataSource: AppDataSource;

  constructor(appDataSource: AppDataSource) {
    this.appDataSource = appDataSource;
  }
  
  public execute(message: any, args: any) {
    const data = [];
    const commands = this.appDataSource.botCommands;
    const prefix = '/';

    // general help - list all commands
    if (!args.length) {
      data.push('Here\'s a list of all my commands:');
      data.push( "```\n" + commands.map(command => command.name).join('\n') + "```");
      data.push(`You can send \`${prefix}help [command name]\` to get info on a specific command!`);

      return message.author.send(data, { split: true })
        .then(() => {
          if (message.channel.type === 'dm') return;
          message.reply('I\'ve sent you a DM with all my commands!');
        })
        .catch(error => {
          console.error(`Could not send help DM to ${message.author.tag}.\n`, error);
          message.reply('it seems like I can\'t DM you! Do you have DMs disabled?');
        });
    }

    const name = args[0].toLowerCase();
    const command = commands.get(name) || commands.find(c => c.aliases && c.aliases.includes(name));

    if (!command) {
      return message.reply('that\'s not a valid command!');
    }

    data.push(`**Name:** ${command.name}`);

    if (command.aliases) data.push(`**Aliases:** ${command.aliases.join(', ')}`);
    if (command.description) data.push(`**Description:** ${command.description}`);
    if ((command as any).usage) data.push(`**Usage:** ${prefix}${(command as any).usage}`);

    //data.push(`**Cooldown:** ${command.cooldown || 3} second(s)`);

    message.channel.send(data, { split: true });
  }
}
