import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, SlashCommandSubcommandBuilder } from 'discord.js';
import { AppDataSource } from '../appDataSource';
import { DiscordHelper } from '../common/discordHelper';
import { CommandBase, CommandHelpTopic, SlashCommandData, SlashCommandHandler, withFormatOptions } from './command';
import { Pokemon, PokemonStatsEntry } from '../models/pokemon';
import { PokemonUsage } from '../models/smogonUsage';
import { FormatHelper } from '../smogon/formatHelper';

type SpeedTierMode = 'faster' | 'slower';
type PokemonStatsMode = 'physical' | 'special' | 'both';
type SortDirection = 'ascending' | 'descending';

const speedTierModeChoices = [
  { name: 'Faster', value: 'faster' },
  { name: 'Slower', value: 'slower' },
] as const;

const pokemonStatsModeChoices = [
  { name: 'Both (Default)', value: 'both' },
  { name: 'Physical', value: 'physical' },
  { name: 'Special', value: 'special' },
] as const;

const maxPokemonStatsCandidates = 100;
const maxPokemonStatsResults = 15;

export const statsHelpTopic: CommandHelpTopic = {
  command: 'stats',
  description: 'Format-wide rankings such as usage, leads, speed tiers, attackers, defenders, and Mega Stone users.',
  arguments: [
    'meta: Optional competitive metagame / (VGC) regulation filter. Uses the configured default when omitted.',
    'generation: Optional generation filter. Uses the configured default when omitted. If only generation is provided, that generation uses its default VGC format.',
    'mode: Optional for speed-tier only. `faster` shows the highest base Speed first, while `slower` shows the lowest base Speed first.',
    'mode: Optional for attackers and defenders only. `physical` uses Attack or Defense, `special` uses Sp. Atk or Sp. Def, and `both` picks the stronger stat for each Pokemon.',
  ],
  examples: [
    '/stats usage',
    '/stats speed-tier',
    '/stats speed-tier meta:OU generation:"Gen 8" mode:slower',
    '/stats attackers meta:OU mode:special',
    '/stats defenders generation:"Gen 8" mode:physical',
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
    .addSubcommand(subcommand => withPokemonStatsModeOption(withFormatOptions(
      subcommand
        .setName('attackers')
        .setDescription('Show the strongest attackers among the top used Pokemon in a metagame')
    )))
    .addSubcommand(subcommand => withPokemonStatsModeOption(withFormatOptions(
      subcommand
        .setName('defenders')
        .setDescription('Show the strongest defenders among the top used Pokemon in a metagame')
    )))
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
      case 'attackers':
        await this.handleAttackers(interaction);
        return;
      case 'defenders':
        await this.handleDefenders(interaction);
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

    const firstMon = usageData
      .map((usage) => this.dataSource.pokemonDb.getPokemon(usage.name))
      .find((pokemon): pokemon is Pokemon => !!pokemon);
    if (!firstMon) {
      await this.replyNoData(interaction, `No usage data available for ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    usageData.forEach((pokemon, index) => {
      embed.addFields({
        name: this.formatRankedTitle(index + 1, pokemon.name),
        value: `Usage: \`${pokemon.usageRaw.toFixed(2)}%\``,
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

    const firstMon = leads
      .map((usage) => this.dataSource.pokemonDb.getPokemon(usage.name))
      .find((pokemon): pokemon is Pokemon => !!pokemon);
    if (!firstMon) {
      await this.replyNoData(interaction, `No leads data available for ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    leads.forEach((pokemon, index) => {
      embed.addFields({
        name: this.formatRankedTitle(index + 1, pokemon.name),
        value: `Usage: \`${pokemon.usageRaw.toFixed(2)}%\``,
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
    const speedTierEntries = this.buildPokemonStatsEntries(
      usageData,
      (pokemon) => ({ stats: pokemon.baseStats.spe, statsName: 'Speed' }),
      { sortDirection: mode === 'slower' ? 'ascending' : 'descending' }
    );

    const directionLabel = mode === 'slower'
      ? 'slowest to fastest'
      : undefined;

    await this.replyPokemonStatsRanking(interaction, {
      format,
      heading: 'Speed Tier',
      noDataMessage: `No speed-tier data available for ${FormatHelper.toUserString(format)}.`,
      entries: speedTierEntries,
      modeLabel: directionLabel,
    });
  }

  private async handleAttackers(interaction: ChatInputCommandInteraction): Promise<void> {    
    await this.handleStatsRanking(interaction, 'Attackers', (pokemon, mode) => this.getAttackerStats(pokemon, mode));
  }

  private async handleDefenders(interaction: ChatInputCommandInteraction): Promise<void> {    
    await this.handleStatsRanking(interaction, 'Defenders', (pokemon, mode) => this.getDefenderStats(pokemon, mode));
  }

  private async handleStatsRanking(
    interaction: ChatInputCommandInteraction, 
    statsName: string,
    getStats: (pokemon: Pokemon, mode: PokemonStatsMode) => Pick<PokemonStatsEntry, 'stats' | 'statsName'>
  ): Promise<void> {
    const format = this.getFormat(interaction);
    const mode = this.getPokemonStatsMode(interaction);
    
    await DiscordHelper.deferCommandReply(interaction);

    const usageData = await this.dataSource.smogonStats.getUsages(format, false);
    const pokemonEntries = this.buildPokemonStatsEntries(
      usageData,
      (pokemon) => getStats(pokemon, mode)
    );

    await this.replyPokemonStatsRanking(interaction, {
      format,
      heading: statsName,
      noDataMessage: `No ${statsName.toLowerCase()} data available for ${FormatHelper.toUserString(format)}.`,
      entries: pokemonEntries,
      modeLabel: this.getPokemonStatsModeLabel(mode),
    });
  }

  private async replyPokemonStatsRanking(
    interaction: ChatInputCommandInteraction,
    options: {
      format: ReturnType<StatsCommand['getFormat']>;
      heading: string;
      noDataMessage: string;
      entries: PokemonStatsEntry[];
      modeLabel?: string;
    }
  ): Promise<void> {
    if (!options.entries.length) {
      await this.replyNoData(interaction, options.noDataMessage);
      return;
    }

    const firstMon = options.entries[0].pokemon;
    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    options.entries.forEach((entry, index) => {
      embed.addFields({
        name: this.formatRankedTitle(index + 1, entry.pokemon.name),
        value: `Base ${entry.statsName}: \`${entry.stats}\`\nUsage: \`#${entry.usage.rank}\` (${entry.usage.usageRaw.toFixed(2)}%)`,
        inline: true,
      });
    });

    const subtitle = options.modeLabel ? ` - *${options.modeLabel}*` : '';

    await interaction.editReply({
      content: `**__${options.heading}:__** Top ${options.entries.length} Pokemon of ${FormatHelper.toUserString(options.format)}${subtitle}`,
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

    const firstMon = moveSets
      .map((moveSet) => this.dataSource.pokemonDb.getPokemon(moveSet.name))
      .find((pokemon): pokemon is Pokemon => !!pokemon);
    if (!firstMon) {
      await this.replyNoData(interaction, `No Mega usage data available for ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true });

    moveSets.forEach((moveSet, index) => {
      embed.addFields({
        name: this.formatRankedTitle(index + 1, moveSet.name),
        value: `Usage: \`${(moveSet.usage ?? 0).toFixed(2)}%\``,
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

  private getPokemonStatsMode(interaction: ChatInputCommandInteraction): PokemonStatsMode {
    const mode = interaction.options.getString('mode');
    return mode === 'physical' || mode === 'special'
      ? mode
      : 'both';
  }

  private getPokemonStatsModeLabel(mode: PokemonStatsMode): string | undefined {
    switch (mode) {
      case 'physical':
        return 'physical side only mode';
      case 'special':
        return 'special side only mode';
      default:
        return undefined;
    }
  }

  private buildPokemonStatsEntries(usages: PokemonUsage[], 
                                   getStats: (pokemon: Pokemon) => Pick<PokemonStatsEntry, 'stats' | 'statsName'>, 
                                   options: { sortDirection?: SortDirection } = {}): PokemonStatsEntry[] {
    const sortDirection = options.sortDirection ?? 'descending';

    return usages
      .slice(0, maxPokemonStatsCandidates)
      .map((usage) => {
        const pokemon = this.dataSource.pokemonDb.getPokemon(usage.name);
        if (!pokemon) 
          return undefined;        

        return {
          pokemon,
          usage,
          ...getStats(pokemon),
        };
      })
      .filter((entry): entry is PokemonStatsEntry => !!entry)
      .sort((a, b) => {
        if (a.stats !== b.stats) {
          return sortDirection === 'ascending'
            ? a.stats - b.stats
            : b.stats - a.stats;
        }

        if (a.usage.rank !== b.usage.rank) {
          return a.usage.rank - b.usage.rank;
        }

        return a.pokemon.name.localeCompare(b.pokemon.name);
      })
      .slice(0, maxPokemonStatsResults);
  }

  private getAttackerStats(pokemon: Pokemon, mode: PokemonStatsMode): Pick<PokemonStatsEntry, 'stats' | 'statsName'> {
    switch (mode) {
      case 'physical':
        return { stats: pokemon.baseStats.atk, statsName: 'Attack' };
      case 'special':
        return { stats: pokemon.baseStats.spA, statsName: 'Sp. Atk' };
      default:
        return pokemon.baseStats.atk >= pokemon.baseStats.spA
          ? { stats: pokemon.baseStats.atk, statsName: 'Attack' }
          : { stats: pokemon.baseStats.spA, statsName: 'Sp. Atk' };
    }
  }

  private getDefenderStats(pokemon: Pokemon, mode: PokemonStatsMode): Pick<PokemonStatsEntry, 'stats' | 'statsName'> {
    switch (mode) {
      case 'physical':
        return { stats: pokemon.baseStats.def, statsName: 'Defense' };
      case 'special':
        return { stats: pokemon.baseStats.spD, statsName: 'Sp. Def' };
      default:
        return pokemon.baseStats.def >= pokemon.baseStats.spD
          ? { stats: pokemon.baseStats.def, statsName: 'Defense' }
          : { stats: pokemon.baseStats.spD, statsName: 'Sp. Def' };
    }
  }
}

function withPokemonStatsModeOption(subcommand: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return subcommand.addStringOption(option =>
    option
      .setName('mode')
      .setDescription('How to compare offensive or defensive base stats')
      .addChoices(...pokemonStatsModeChoices)
  );
}