import { ChatInputCommandInteraction, Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { AppDataSource } from './appDataSource';
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
    await handleCommandFailure(interaction, error);
  }
});

async function handleCommandFailure(interaction: ChatInputCommandInteraction, error: unknown): Promise<void> {
  console.error(`Failed to process command '${interaction.commandName}' from ${interaction.user.tag}.`, error);

  try {
    const commandFailureMessage = 'There was an error trying to execute that command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: commandFailureMessage, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: commandFailureMessage, flags: MessageFlags.Ephemeral });
  }
  catch (replyError) {
    console.error('Failed to send the command failure response.', replyError);
  }
}

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