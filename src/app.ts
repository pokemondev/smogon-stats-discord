import { ChatInputCommandInteraction, Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { AppDataSource } from './appDataSource';
import { DiscordHelper } from './common/discordHelper';
import { SlashCommandHandler } from './commands/command';
import { createCommands } from './commands/commandIndex';
import { ConfigHelper } from './config/configHelper';

const botConfig = ConfigHelper.loadAndValidate();
const dataSource = new AppDataSource(botConfig);
const token = botConfig.client.token;

const commands = new Map<string, SlashCommandHandler>(
  createCommands(dataSource, botConfig).map(command => [command.data.name, command] as const)
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
  console.log(`Loaded ${commands.size} slash commands.`);

  try {
    await dataSource.emojiService.initialize(readyClient);
    console.log(`Loaded ${dataSource.emojiService.getLoadedEmojiCount()} application emoji(s).`);
  }
  catch (error) {
    console.error('Failed to initialize application emoji cache.', error);
  }
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
    dataSource.analytics.recordCommandAttempt(interaction);
    await command.execute(interaction);
  }
  catch (error) {
    dataSource.analytics.recordCommandFailure(interaction);
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
  void dataSource.analytics.flush();
  console.error('Unhandled promise rejection.', reason);
});

process.on('uncaughtException', error => {
  void dataSource.analytics.flush();
  console.error('Uncaught exception.', error);
});

async function flushAnalyticsAndExit(exitCode: number): Promise<void> {
  try {
    await dataSource.analytics.flush();
  }
  finally {
    process.exit(exitCode);
  }
}

process.on('SIGINT', () => {
  void flushAnalyticsAndExit(0);
});

process.on('SIGTERM', () => {
  void flushAnalyticsAndExit(0);
});

client.login(token);