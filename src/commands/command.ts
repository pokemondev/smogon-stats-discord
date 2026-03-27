import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  RESTPostAPIApplicationCommandsJSONBody,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { AppDataSource } from "../appDataSource";
import { MoveSetUsage, UsageData, ChecksAndCountersUsageData, SmogonFormat } from "../smogon/usageModels";
import { ColorService } from '../pokemon/colorService';
import { FormatHelper } from '../smogon/formatHelper';
import { Pokemon } from '../pokemon/models';
import { ImageService } from '../pokemon/imageService';
import { FormatConfig } from '../config/formatConfig';
import { FormatCatalog } from '../smogon/formatCatalog';

const generationChoices = [
  { name: 'Gen 9', value: '9' },
  { name: 'Gen 8', value: '8' },
  { name: 'Gen 7', value: '7' },
  { name: 'Gen 6', value: '6' },
] as const;

export interface SlashCommandHandler {
  data: SlashCommandData;
  helpTopic: CommandHelpTopic;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface SlashCommandData {
  name: string;
  toJSON(): RESTPostAPIApplicationCommandsJSONBody;
}

export interface CommandHelpTopic {
  description: string;
  command: string;
  arguments?: string[];
  examples: string[];
}

export type PokemonQuery = {
  format: SmogonFormat;
  pokemon: Pokemon;
  requestedName: string;
};

export type MovesetCommandData = {
  format: SmogonFormat;
  moveSet: MoveSetUsage;
  pokemon: Pokemon;
};

export function withNameOption(subcommand: SlashCommandSubcommandBuilder, description: string): SlashCommandSubcommandBuilder {
  return subcommand.addStringOption(option =>
    option
      .setName('name')
      .setDescription(description)
      .setRequired(true)
  );
}

export function withFormatOptions(subcommand: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return subcommand
    .addStringOption(option => buildGenerationOption(option))
    .addStringOption(option => buildMetaOption(option));
}

export class CommandBase {
  constructor(protected readonly dataSource: AppDataSource) {
  }

  protected getFormat(interaction: ChatInputCommandInteraction): SmogonFormat {
    const generation = interaction.options.getString('generation');
    const meta = interaction.options.getString('meta');
    const args = [generation, meta].filter((value): value is string => !!value);
    return FormatHelper.getFormat(args);
  }

  protected async resolvePokemonQuery(interaction: ChatInputCommandInteraction): Promise<PokemonQuery | undefined> {
    const requestedName = interaction.options.getString('name', true).trim();
    const pokemon = this.dataSource.pokemonDb.getPokemon(requestedName);
    if (!pokemon) {
      await interaction.reply({
        content: `Could not find the provided Pokemon: '${requestedName}'.`,
        flags: MessageFlags.Ephemeral,
      });
      return undefined;
    }

    return {
      format: this.getFormat(interaction),
      pokemon,
      requestedName,
    };
  }

  protected async getMoveSetCommandData(query: PokemonQuery): Promise<MovesetCommandData> {
    const moveSet = await this.dataSource.smogonStats.getMoveSet(query.pokemon.name, query.format);
    return {
      format: query.format,
      moveSet: moveSet ? moveSet : {} as MoveSetUsage,
      pokemon: query.pokemon,
    };
  }

  protected createPokemonEmbed(
    pokemon: Pokemon,
    options: { footer?: string; image?: boolean; thumbnail?: boolean } = {}
  ): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(ColorService.getColorForType(pokemon.type1));

    if (options.image) {
      embed.setImage(ImageService.getGifUrl(pokemon));
    }

    if (options.thumbnail) {
      embed.setThumbnail(ImageService.getPngUrl(pokemon));
    }

    if (options.footer) {
      embed.setFooter({ text: options.footer });
    }

    return embed;
  }

  protected addUsageFields(
    embed: EmbedBuilder,
    usageData: UsageData[] | ChecksAndCountersUsageData[] | undefined,
    formatter?: (data: UsageData | ChecksAndCountersUsageData) => string,
  ): void {
    const safeUsageData = usageData ? usageData.slice(0, 24) : [];
    if (!safeUsageData.length) {
      embed.setDescription('No data available for this query.');
      return;
    }

    for (const usage of safeUsageData) {
      const value = formatter
        ? formatter(usage)
        : `Usage: ${usage.percentage.toFixed(2)}%`;

      embed.addFields({ name: usage.name, value, inline: true });
    }
  }

  protected async replyNoData(interaction: ChatInputCommandInteraction, message: string): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message, embeds: [] });
      return;
    }

    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
  }

  protected getSlashFormatArguments(interaction: ChatInputCommandInteraction): string {
    const args: string[] = [];
    const generation = interaction.options.getString('generation');
    const meta = interaction.options.getString('meta');

    if (generation) {
      args.push(`generation:${generation}`);
    }

    if (meta) {
      args.push(`meta:${meta}`);
    }

    return args.join(' ');
  }

  private isCheckAndCounters(usage: UsageData | ChecksAndCountersUsageData): usage is ChecksAndCountersUsageData {
    return (usage as ChecksAndCountersUsageData).kOed !== undefined;
  }
}

function buildGenerationOption(option: SlashCommandStringOption): SlashCommandStringOption {
  return option
    .setName('generation')
    .setDescription('Pokemon generation')
    .addChoices(...generationChoices);
}

function buildMetaOption(option: SlashCommandStringOption): SlashCommandStringOption {
  return option
    .setName('meta')
    .setDescription('Competitive metagame')
    .addChoices(...getMetaChoices());
}

function getMetaChoices() {
  const defaultFormat = FormatConfig.getDefaultFormat();
  const vgcChoices = FormatCatalog.VgcSeasons.map(season => ({
    name: getDisplayNameForMeta(season.meta),
    value: season.meta,
  }));
  const standardChoices = FormatCatalog.StandardMetaValues.map(meta => ({
    name: getDisplayNameForMeta(meta),
    value: meta,
  }));

  return [ ...vgcChoices, ...standardChoices ].map(choice => ({
    ...choice,
    name: choice.value === defaultFormat.meta
      ? `${choice.name} (Default)`
      : choice.name,
  }));
}

function getDisplayNameForMeta(meta: string): string {
  const vgcSeason = FormatCatalog.VgcSeasons.find(season => season.meta === meta);
  if (vgcSeason) {
    const regulation = vgcSeason.regulation
      ? ` ${vgcSeason.regulation.replace(/^reg/i, 'REG ').toUpperCase()}`
      : '';
    return `VGC ${vgcSeason.year}${regulation}`;
  }

  return meta.toUpperCase();
}
