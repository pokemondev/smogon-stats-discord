import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { AppDataSource } from '../appDataSource';
import { DiscordHelper } from '../common/discordHelper';
import { Pokemon } from '../models/pokemon';
import { FormatCatalog } from '../smogon/formatCatalog';
import { FormatHelper } from '../smogon/formatHelper';
import { SmogonFormat } from '../models/smogonUsage';
import { VgcTeam } from '../models/vgc';
import { CommandBase, CommandHelpTopic, SlashCommandData, SlashCommandHandler } from './command';

const MaxDisplayedTeams = 6;
const TeamLinksFooterText = 'Check more details at x.com/VGCPastes and limitlessvgc.com';

export const vgcHelpTopic: CommandHelpTopic = {
  command: 'vgc',
  description: 'VGC teams with optional Pokemon member filters.',
  arguments: [
    'regulation: Optional VGC regulation filter. Uses the configured default generation\'s default VGC season when omitted.',
    'pokemon1: Optional Pokemon that must appear on the team.',
    'pokemon2: Optional second Pokemon that must appear on the team. If pokemon1 is omitted, pokemon2 is treated as pokemon1.',
  ],
  examples: [
    '/vgc teams',
    '/vgc teams pokemon1:charizard',
    '/vgc teams regulation:"VGC 2026 Reg. I"',
    '/vgc teams regulation:"VGC 2026 Reg. I" pokemon1:zamazenta pokemon2:calyrex-shadow',
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
      default:
        await interaction.reply({ content: 'That subcommand is not supported.', flags: MessageFlags.Ephemeral });
    }
  }

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
    const previewPokemon = primaryPokemon ?? this.findPreviewPokemon(displayedTeams);
    const embed = previewPokemon
      ? this.createPokemonEmbed(previewPokemon, { footer: TeamLinksFooterText, thumbnail: true })
      : new EmbedBuilder();

    embed
      .setTitle(this.buildEmbedTitle(format, primaryPokemon, secondaryPokemon))
      .setDescription(`Showing ${displayedTeams.length} of ${teams.length} matching teams.`);

    displayedTeams.forEach((team, index) => {
      embed.addFields({
        name: `#${index + 1} ${team.description} (ID ${team.teamId})`,
        value: this.buildTeamMembersCodeBlock(team),
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

  private findPreviewPokemon(teams: VgcTeam[]): Pokemon | undefined {
    for (const team of teams) {
      for (const member of team.members) {
        const pokemon = this.dataSource.pokemonDb.getPokemon(member.name);
        if (pokemon) {
          return pokemon;
        }
      }
    }

    return undefined;
  }

  private buildEmbedTitle(format: SmogonFormat, pokemon1?: Pokemon, pokemon2?: Pokemon): string {
    const parts = [FormatHelper.getMetaDisplayName(format.meta)];
    if (pokemon1 && pokemon2) {
      parts.push(`${pokemon1.name} + ${pokemon2.name}`);
    }
    else if (pokemon1) {
      parts.push(pokemon1.name);
    }

    return parts.join(' - ');
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

  private buildTeamMembersCodeBlock(team: VgcTeam): string {
    return `\`\`\`\n${team.members.map(member => member.name).join('\n')}\n\`\`\``;
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