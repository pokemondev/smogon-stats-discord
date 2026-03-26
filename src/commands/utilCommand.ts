import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { CommandHelpTopic, SlashCommandData, SlashCommandHandler } from './command';

export const utilHelpTopic: CommandHelpTopic = {
  command: 'util',
  description: 'Utility commands such as ping and server information.',
  examples: [
    '/util ping',
    '/util server',
  ],
};

export function createUtilCommandData(): SlashCommandData {
  return new SlashCommandBuilder()
    .setName('util')
    .setDescription('Utility bot commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('ping')
        .setDescription('Check the bot latency')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('server')
        .setDescription('Show basic server information')
    );
}

export class UtilCommand implements SlashCommandHandler {
  public readonly data = createUtilCommandData();
  public readonly helpTopic = utilHelpTopic;

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'ping':
        await interaction.reply({
          content: `Pong. Gateway heartbeat: ${interaction.client.ws.ping}ms.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      case 'server':
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: 'This command is only available inside a server.', flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.reply({
          content: `Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      default:
        await interaction.reply({ content: 'That subcommand is not supported.', flags: MessageFlags.Ephemeral });
    }
  }
}