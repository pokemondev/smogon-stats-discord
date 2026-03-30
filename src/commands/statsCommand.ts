import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { AppDataSource } from '../appDataSource';
import { DiscordHelper } from '../common/discordHelper';
import { CommandBase, CommandHelpTopic, SlashCommandData, SlashCommandHandler, withFormatOptions } from './command';
import { FormatHelper } from '../smogon/formatHelper';

export const statsHelpTopic: CommandHelpTopic = {
  command: 'stats',
  description: 'Format-wide rankings such as usage, leads, and Mega Stone users.',
  arguments: [
    'meta: Optional competitive metagame / (VGC) regulation filter. Uses the configured default when omitted.',
    'generation: Optional generation filter. Uses the configured default when omitted. If only generation is provided, that generation uses its default VGC format.',
  ],
  examples: [
    '/stats usage',
    '/stats leads meta:UU',
    '/stats megas meta:OU generation:"Gen 6"',
  ],
};

export function createStatsCommandData(): SlashCommandData {
  return new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Format-wide rankings and trends')
    .addSubcommand(subcommand => withFormatOptions(
      subcommand
        .setName('usage')
        .setDescription('Show the most used Pokemon in a metagame')
    ))
    .addSubcommand(subcommand => withFormatOptions(
      subcommand
        .setName('leads')
        .setDescription('Show the most common leads in a metagame')
    ))
    .addSubcommand(subcommand => withFormatOptions(
      subcommand
        .setName('megas')
        .setDescription('Show the most common Mega Stone users in a metagame')
    ));
}

export class StatsCommand extends CommandBase implements SlashCommandHandler {
  public readonly data = createStatsCommandData();
  public readonly helpTopic = statsHelpTopic;

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'usage':
        await this.handleUsage(interaction);
        return;
      case 'leads':
        await this.handleLeads(interaction);
        return;
      case 'megas':
        await this.handleMegas(interaction);
        return;
      default:
        await interaction.reply({ content: 'That subcommand is not supported.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleUsage(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = this.getFormat(interaction);
    await DiscordHelper.deferCommandReply(interaction);

    const usageData = await this.dataSource.smogonStats.getUsages(format);
    if (!usageData.length) {
      await this.replyNoData(interaction, `No usage data available for ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const firstMon = this.dataSource.pokemonDb.getPokemon(usageData[0].name);
    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    usageData.forEach((pokemon, index) => {
      embed.addFields({
        name: `Rank ${index + 1}º ${pokemon.name}`,
        value: `Usage: ${pokemon.usageRaw.toFixed(2)}%`,
        inline: true,
      });
    });

    await interaction.editReply({
      content: `**__Usage:__** Top ${usageData.length} most used Pokemon of ${FormatHelper.toUserString(format)}`,
      embeds: [embed],
    });
  }

  private async handleLeads(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = this.getFormat(interaction);
    await DiscordHelper.deferCommandReply(interaction);

    const leads = await this.dataSource.smogonStats.getLeads(format);
    if (!leads.length) {
      await this.replyNoData(interaction, `No leads data available for ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const firstMon = this.dataSource.pokemonDb.getPokemon(leads[0].name);
    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    leads.forEach((pokemon, index) => {
      embed.addFields({
        name: `Lead ${index + 1}º ${pokemon.name}`,
        value: `Usage: ${pokemon.usageRaw.toFixed(2)}%`,
        inline: true,
      });
    });

    await interaction.editReply({
      content: `**__Leads:__** Top ${leads.length} leads of ${FormatHelper.toUserString(format)}`,
      embeds: [embed],
    });
  }

  private async handleMegas(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = this.getFormat(interaction);
    await DiscordHelper.deferCommandReply(interaction);

    const moveSets = await this.dataSource.smogonStats.getMegasMoveSets(format);
    if (!moveSets.length) {
      await this.replyNoData(interaction, `No Mega usage data available for ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const firstMon = this.dataSource.pokemonDb.getPokemon(moveSets[0].name);
    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    moveSets.forEach(moveSet => {
      embed.addFields({
        name: moveSet.name,
        value: `Usage: ${moveSet.usage.toFixed(2)}%`,
        inline: true,
      });
    });

    await interaction.editReply({
      content: `**__Megas:__** Top ${moveSets.length} Mega Stone users of ${FormatHelper.toUserString(format)}`,
      embeds: [embed],
    });
  }
}