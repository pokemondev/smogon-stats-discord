import { AppDataSource } from '../appDataSource';
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { CommandHelpTopic, SlashCommandData, SlashCommandHandler } from './command';

export const utilHelpTopic: CommandHelpTopic = {
  command: 'util',
  description: 'Utility commands such as ping, server information, and analytics summaries.',
  examples: [
    '/util ping',
    '/util server',
    '/util stats',
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show command analytics summary')
    );
}

export class UtilCommand implements SlashCommandHandler {
  public readonly data = createUtilCommandData();
  public readonly helpTopic = utilHelpTopic;

  constructor(private readonly dataSource: AppDataSource) {
  }

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
      case 'stats':
        await interaction.reply({
          content: this.dataSource.analytics.getSummary(interaction.guildId ?? undefined),
          flags: MessageFlags.Ephemeral,
        });
        return;
      default:
        await interaction.reply({ content: 'That subcommand is not supported.', flags: MessageFlags.Ephemeral });
    }
  }
}