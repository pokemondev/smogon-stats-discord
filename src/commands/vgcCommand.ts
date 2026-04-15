import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { AppDataSource } from '../appDataSource';
import { DiscordHelper } from '../common/discordHelper';
import { Pokemon } from '../models/pokemon';
import { FormatCatalog } from '../smogon/formatCatalog';
import { FormatHelper } from '../smogon/formatHelper';
import { PokemonUsage, SmogonFormat } from '../models/smogonUsage';
import { VgcResolvedTeam, VgcTeam } from '../models/vgc';
import { CommandBase, CommandHelpTopic, SlashCommandData, SlashCommandHandler } from './command';

const MaxDisplayedTeams = 6;
const TeamLinksFooterText = 'Check more details at x.com/VGCPastes and limitlessvgc.com';
const TeamDetailsMissingMessage = 'Could not find a unique VGC team with the provided team id.';

export const vgcHelpTopic: CommandHelpTopic = {
  command: 'vgc',
  description: 'VGC teams, filters, and full rental-style team details.',
  arguments: [
    'teams regulation: Optional VGC regulation filter. Uses the configured default generation\'s default VGC season when omitted.',
    'teams pokemon1: Optional Pokemon that must appear on the team.',
    'teams pokemon2: Optional second Pokemon that must appear on the team. If pokemon1 is omitted, pokemon2 is treated as pokemon1.',
    'team-details team-id: Required VGC team id. The service resolves the regulation automatically.',
  ],
  examples: [
    '/vgc teams',
    '/vgc teams pokemon1:charizard',
    '/vgc teams regulation:"VGC 2026 Reg. I"',
    '/vgc teams regulation:"VGC 2026 Reg. I" pokemon1:zamazenta pokemon2:calyrex-shadow',
    '/vgc team-details team-id:I1280',
  ],
};

export function createVgcCommandData(): SlashCommandData {
  return new SlashCommandBuilder()
    .setName('vgc')
    .setDescription('VGC teams and filters')
    .addSubcommand(subcommand =>
      subcommand
        .setName('teams')
        .setDescription('Show teams used in a VGC regulation')
        .addStringOption(option =>
          option
            .setName('regulation')
            .setDescription('VGC regulation')
            .addChoices(...getRegulationChoices())
        )
        .addStringOption(option =>
          option
            .setName('pokemon1')
            .setDescription('First Pokemon that must be on the team')
        )
        .addStringOption(option =>
          option
            .setName('pokemon2')
            .setDescription('Second Pokemon that must be on the team')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('team-details')
        .setDescription('Show one VGC team in Smogon set notation')
        .addStringOption(option =>
          option
            .setName('team-id')
            .setDescription('VGC team id')
            .setRequired(true)
        )
    );
}

export class VgcCommand extends CommandBase implements SlashCommandHandler {
  public readonly data = createVgcCommandData();
  public readonly helpTopic = vgcHelpTopic;

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'teams':
        await this.handleTeams(interaction);
        return;
      case 'team-details':
        await this.handleTeamDetails(interaction);
        return;
      default:
        await interaction.reply({ content: 'That subcommand is not supported.', flags: MessageFlags.Ephemeral });
    }
  }

  // handlers for each subcommand
  private async handleTeams(interaction: ChatInputCommandInteraction): Promise<void> {
    const requestedFilters = this.getRequestedPokemonFilters(interaction);
    const primaryPokemon = requestedFilters.pokemon1
      ? this.dataSource.pokemonDb.getPokemon(requestedFilters.pokemon1)
      : undefined;
    if (requestedFilters.pokemon1 && !primaryPokemon) {
      await this.replyNoData(interaction, `Could not find the provided Pokemon: '${requestedFilters.pokemon1}'.`);
      return;
    }

    const secondaryPokemon = requestedFilters.pokemon2
      ? this.dataSource.pokemonDb.getPokemon(requestedFilters.pokemon2)
      : undefined;
    if (requestedFilters.pokemon2 && !secondaryPokemon) {
      await this.replyNoData(interaction, `Could not find the provided Pokemon: '${requestedFilters.pokemon2}'.`);
      return;
    }

    const format = this.getVgcFormat(interaction);
    await DiscordHelper.deferCommandReply(interaction);

    const teams = primaryPokemon
      ? this.dataSource.vgcTeams.getTeamsByPokemon(format, primaryPokemon.name, secondaryPokemon?.name)
      : this.dataSource.vgcTeams.getTeams(format);

    if (!teams.length) {
      await this.replyNoData(interaction, this.buildNoTeamsMessage(format, primaryPokemon, secondaryPokemon));
      return;
    }

    const displayedTeams = teams.slice(0, MaxDisplayedTeams);
    const previewPokemon = primaryPokemon ?? this.dataSource.pokemonDb.getPokemon(displayedTeams[0].members[0].name);
    const embed = previewPokemon
      ? this.createPokemonEmbed(previewPokemon, { footer: TeamLinksFooterText, thumbnail: true })
      : new EmbedBuilder();

    embed
      .setTitle(this.buildEmbedTitle(primaryPokemon, secondaryPokemon))
      .setDescription(`Showing ${displayedTeams.length} of ${teams.length} matching teams.`);

    const teamMemberDisplays = displayedTeams.map(team => this.buildTeamMembersList(team));

    displayedTeams.forEach((team, index) => {
      embed.addFields({
        name: `#${(team.rank ?? '??')} place at ${team.event} (ID ${team.teamId})`,
        value: teamMemberDisplays[index],
        inline: true,
      });

      // Add a spacer every two teams to improve readability
      if ((index + 1) % 2 === 0 && index !== displayedTeams.length - 1) {
        embed.addFields({ name: '\u200b', value: '\u200b', inline: false });
      }
    });

    await interaction.editReply({
      content: `**__VGC Teams:__** ${FormatHelper.getMetaDisplayName(format.meta)}`,
      embeds: [embed],
    });
  }

  private async handleTeamDetails(interaction: ChatInputCommandInteraction): Promise<void> {
    const requestedTeamId = interaction.options.getString('team-id', true).trim();
    const resolvedTeam = this.dataSource.vgcTeams.getTeamById(requestedTeamId);
    if (!resolvedTeam) {
      await this.replyNoData(interaction, `${TeamDetailsMissingMessage} (${requestedTeamId})`);
      return;
    }

    await DiscordHelper.deferCommandReply(interaction);

    const previewPokemon = await this.getHighlightTeamPokemon(resolvedTeam);
    const embed = previewPokemon
      ? this.createPokemonEmbed(previewPokemon, { footer: TeamLinksFooterText, thumbnail: true })
      : new EmbedBuilder().setFooter({ text: TeamLinksFooterText });

    embed
      .setTitle(resolvedTeam.team.description)
      .setDescription(this.buildTeamDetailsDescription(resolvedTeam));

    const memberDisplayNames = resolvedTeam.team.members.map(member => this.formatPokemonWithItemDisplay(member.name, member.item));

    resolvedTeam.team.members.forEach((member, index) => {
      embed.addFields({
        name: memberDisplayNames[index],
        value: `\`\`\`${FormatHelper.getSmogonSet(member)}\`\`\`\u2006`,
        inline: true,
      });

      if ((index + 1) % 2 === 0 && index !== resolvedTeam.team.members.length - 1) {
        embed.addFields({ name: '\u200b', value: '\u200b', inline: false });
      }
    });

    await interaction.editReply({
      content: `**__VGC Team Details:__** ${resolvedTeam.team.teamId}`,
      embeds: [embed],
    });
  }

  // helper methods
  private getRequestedPokemonFilters(interaction: ChatInputCommandInteraction): { pokemon1?: string; pokemon2?: string } {
    let pokemon1 = interaction.options.getString('pokemon1')?.trim();
    let pokemon2 = interaction.options.getString('pokemon2')?.trim();

    if (!pokemon1 && pokemon2) {
      pokemon1 = pokemon2;
      pokemon2 = undefined;
    }

    return {
      pokemon1: pokemon1 || undefined,
      pokemon2: pokemon2 || undefined,
    };
  }

  private getVgcFormat(interaction: ChatInputCommandInteraction): SmogonFormat {
    const regulation = interaction.options.getString('regulation');
    if (regulation) {
      return FormatHelper.getFormat([regulation]);
    }

    const configuredDefault = FormatHelper.getDefault();
    return FormatCatalog.isVgcMeta(configuredDefault.meta)
      ? configuredDefault
      : FormatCatalog.getGenerationDefaultVgcFormat(configuredDefault.generation);
  }

  private async getHighlightTeamPokemon(teamResult: VgcResolvedTeam): Promise<Pokemon | undefined> {
    const fallbackPokemon = this.dataSource.pokemonDb.getPokemon(teamResult.team.members[0]?.name);

    try {
      const usages = await this.dataSource.smogonStats.getUsages(teamResult.format, false);
      const usageByPokemonName = new Map(usages.map(usage => [usage.name.toLowerCase(), usage] as const));
      const rankedTeamMembers = teamResult.team.members
        .map((member, index) => ({
          pokemon: this.dataSource.pokemonDb.getPokemon(member.name),
          index,
          usage: usageByPokemonName.get(member.name.toLowerCase()),
        }))
        .filter(entry => !!entry.pokemon) as Array<{ pokemon: Pokemon; index: number; usage?: PokemonUsage }>;

      rankedTeamMembers
        .sort((left, right) => {
          const leftRank = left.usage?.rank ?? Number.MAX_SAFE_INTEGER;
          const rightRank = right.usage?.rank ?? Number.MAX_SAFE_INTEGER;

          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }

          return left.index - right.index;
        });

      return rankedTeamMembers[0]?.pokemon ?? fallbackPokemon;
    }
    catch {
      return fallbackPokemon;
    }
  }

  private buildEmbedTitle(pokemon1?: Pokemon, pokemon2?: Pokemon): string {
    if (!pokemon1)
      return 'Recent VGC Teams';

    return ((pokemon1 && pokemon2)
      ? `${pokemon1.name} + ${pokemon2.name} Teams`
      : `${pokemon1.name} Teams`);  
  }

  private buildTeamDetailsDescription(resolvedTeam: VgcResolvedTeam): string {
    const detailLines = [
      `Player: \`${resolvedTeam.team.owner}\``,
      `Event: \`${resolvedTeam.team.event}\``,
      //`Date: \`${resolvedTeam.team.date}\``,
      `Rank: \`${resolvedTeam.team.rank ?? 'N/A'}\``,
      `Rental Code: \`${resolvedTeam.team.rentalCode}\``,
      //`Paste: ${resolvedTeam.team.teamLink}`,
    ];

    return detailLines.join('\n');
  }

  private buildNoTeamsMessage(format: SmogonFormat, pokemon1?: Pokemon, pokemon2?: Pokemon): string {
    if (pokemon1 && pokemon2) {
      return `No VGC teams available for ${FormatHelper.getMetaDisplayName(format.meta)} with ${pokemon1.name} and ${pokemon2.name}.`;
    }

    if (pokemon1) {
      return `No VGC teams available for ${FormatHelper.getMetaDisplayName(format.meta)} with ${pokemon1.name}.`;
    }

    return `No VGC teams available for ${FormatHelper.getMetaDisplayName(format.meta)}.`;
  }

  private buildTeamMembersList(team: VgcTeam): string {
    const displayNames = team.members.map(member => this.formatPokemonWithItemDisplay(member.name, member.item));
    return displayNames.join('\n');
  }
}

function getRegulationChoices() {
  const defaultFormat = getDefaultVgcFormat();

  return FormatCatalog.VgcSeasons.map(season => ({
    name: season.meta === defaultFormat.meta
      ? `${FormatHelper.getMetaDisplayName(season.meta)} (Default)`
      : FormatHelper.getMetaDisplayName(season.meta),
    value: season.meta,
  }));
}

function getDefaultVgcFormat(): SmogonFormat {
  const configuredDefault = FormatHelper.getDefault();
  return FormatCatalog.isVgcMeta(configuredDefault.meta)
    ? configuredDefault
    : FormatCatalog.getGenerationDefaultVgcFormat(configuredDefault.generation);
}