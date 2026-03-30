import { ChatInputCommandInteraction, Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { AppDataSource } from './appDataSource';
import { DiscordHelper } from './common/discordHelper';
import { SlashCommandHandler } from './commands/command';
import { createCommands } from './commands/commandIndex';
import { ConfigHelper } from './config/configHelper';

const botConfig = ConfigHelper.loadAndValidate();
const dataSource = new AppDataSource();
const token = botConfig.client.token;

const commands = new Map<string, SlashCommandHandler>(
  createCommands(dataSource, botConfig).map(command => [command.data.name, command] as const)
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
  console.log(`Loaded ${commands.size} slash commands.`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commands.get(interaction.commandName);
  if (!command) {
    return;
  }

  try {
    await command.execute(interaction);
  }
  catch (error) {
    await DiscordHelper.handleCommandFailure(interaction, error);
  }
});

const isDebug = process.argv.some(a => a === 'debug');
if (isDebug)
{
  console.log('Debug Mode On!');
  client.on(Events.Debug, console.log);
}

process.on('unhandledRejection', reason => {
  console.error('Unhandled promise rejection.', reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception.', error);
});

client.login(token);