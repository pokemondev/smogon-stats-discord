import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { AppDataSource } from '../appDataSource';
import { DiscordHelper } from '../common/discordHelper';
import { CommandBase, CommandHelpTopic, SlashCommandData, SlashCommandHandler, withFormatOptions } from './command';
import { Pokemon } from '../models/pokemon';
import { PokemonUsage } from '../models/smogonUsage';
import { FormatHelper } from '../smogon/formatHelper';

type SpeedTierMode = 'faster' | 'slower';

type SpeedTierEntry = {
  pokemon: Pokemon;
  usage: PokemonUsage;
  speed: number;
};

const speedTierModeChoices = [
  { name: 'Faster', value: 'faster' },
  { name: 'Slower', value: 'slower' },
] as const;

const maxSpeedTierCandidates = 100;
const maxSpeedTierResults = 15;

export const statsHelpTopic: CommandHelpTopic = {
  command: 'stats',
  description: 'Format-wide rankings such as usage, leads, speed tiers, and Mega Stone users.',
  arguments: [
    'meta: Optional competitive metagame / (VGC) regulation filter. Uses the configured default when omitted.',
    'generation: Optional generation filter. Uses the configured default when omitted. If only generation is provided, that generation uses its default VGC format.',
    'mode: Optional for speed-tier only. `faster` shows the highest base Speed first, while `slower` shows the lowest base Speed first.',
  ],
  examples: [
    '/stats usage',
    '/stats speed-tier',
    '/stats speed-tier meta:OU generation:"Gen 8" mode:slower',
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
        .setName('speed-tier')
        .setDescription('Show speed tiers for the most used Pokemon in a metagame')
    ).addStringOption(option =>
      option
        .setName('mode')
        .setDescription('Speed ordering for the speed tier list')
        .addChoices(...speedTierModeChoices)
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
      case 'speed-tier':
        await this.handleSpeedTier(interaction);
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

  private async handleSpeedTier(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = this.getFormat(interaction);
    const mode = this.getSpeedTierMode(interaction);
    await DiscordHelper.deferCommandReply(interaction);

    const usageData = await this.dataSource.smogonStats.getUsages(format, false);
    const speedTierEntries = this.buildSpeedTierEntries(usageData, mode);

    if (!speedTierEntries.length) {
      await this.replyNoData(interaction, `No speed-tier data available for ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const firstMon = speedTierEntries[0].pokemon;
    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    speedTierEntries.forEach((entry, index) => {
      embed.addFields({
        name: `${index + 1}º) ${entry.pokemon.name}`,
        value: `Base Speed: \`${entry.speed}\`\nUsage: \`#${entry.usage.rank}\` (${entry.usage.usageRaw.toFixed(2)}%)`,
        inline: true,
      });
    });

    const directionLabel = mode === 'slower'
      ? 'slowest to fastest'
      : 'fastest to slowest';

    await interaction.editReply({
      content: `**__Speed Tier:__** Top ${speedTierEntries.length} Pokemon of ${FormatHelper.toUserString(format)} - ${directionLabel}` ,
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

  private getSpeedTierMode(interaction: ChatInputCommandInteraction): SpeedTierMode {
    return interaction.options.getString('mode') === 'slower'
      ? 'slower'
      : 'faster';
  }

  private buildSpeedTierEntries(usages: PokemonUsage[], mode: SpeedTierMode): SpeedTierEntry[] {
    return usages
      .slice(0, maxSpeedTierCandidates)
      .map((usage) => {
        const pokemon = this.dataSource.pokemonDb.getPokemon(usage.name);
        return pokemon
          ? { pokemon, usage, speed: pokemon.baseStats.spe }
          : undefined;
      })
      .filter((entry): entry is SpeedTierEntry => !!entry)
      .sort((a, b) => {
        if (a.speed !== b.speed) {
          return mode === 'slower'
            ? a.speed - b.speed
            : b.speed - a.speed;
        }

        if (a.usage.rank !== b.usage.rank) {
          return a.usage.rank - b.usage.rank;
        }

        return a.pokemon.name.localeCompare(b.pokemon.name);
      })
      .slice(0, maxSpeedTierResults);
  }
}