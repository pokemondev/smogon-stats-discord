import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  RESTPostAPIApplicationCommandsJSONBody,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { AppDataSource } from "../appDataSource";
import { DiscordHelper } from '../common/discordHelper';
import { MoveSetUsage, UsageData, ChecksAndCountersUsageData, SmogonFormat } from "../models/smogonUsage";
import { ColorService } from '../pokemon/colorService';
import { FormatHelper } from '../smogon/formatHelper';
import { Pokemon } from '../models/pokemon';
import { ImageService } from '../pokemon/imageService';
import { FormatConfig } from '../config/formatConfig';
import { FormatCatalog } from '../smogon/formatCatalog';

const generationChoices = [
  { name: 'Gen 9', value: '9' },
  { name: 'Gen 8', value: '8' },
  { name: 'Gen 7', value: '7' },
  { name: 'Gen 6', value: '6' },
] as const;

const pokemonInfoCategoryChoices = [
  { name: 'Moves', value: 'moves' },
  { name: 'Abilities', value: 'abilities' },
  { name: 'Items', value: 'items' },
  { name: 'Spreads', value: 'spreads' },
  { name: 'Checks & Counters', value: 'checks' },
  { name: 'Teammates', value: 'teammates' },
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

export function withPokemonInfoCategoryOption(subcommand: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return subcommand.addStringOption(option =>
    option
      .setName('category')
      .setDescription('Pokemon info category')
      .addChoices(...pokemonInfoCategoryChoices)
      .setRequired(true)
  );
}

export function withFormatOptions(subcommand: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return subcommand
    .addStringOption(option => buildMetaOption(option))
    .addStringOption(option => buildGenerationOption(option));
}

export class CommandBase {
  constructor(protected readonly dataSource: AppDataSource) {
  }
  
  protected getRequestedPokemonName(interaction: ChatInputCommandInteraction): string {
    return interaction.options.getString('name', true).trim();
  }  

  protected getFormat(interaction: ChatInputCommandInteraction): SmogonFormat {
    const generation = interaction.options.getString('generation');
    const meta = interaction.options.getString('meta');
    const args = [generation, meta].filter((value): value is string => !!value);
    return FormatHelper.getFormat(args);
  }

  protected resolvePokemonQuery(interaction: ChatInputCommandInteraction): PokemonQuery | undefined {
    const requestedName = this.getRequestedPokemonName(interaction);
    const pokemon = this.dataSource.pokemonDb.getPokemon(requestedName);
    if (!pokemon) {
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

  protected async addUsageFields(
    embed: EmbedBuilder,
    usageData: UsageData[] | ChecksAndCountersUsageData[] | undefined,
    formatter?: (data: UsageData | ChecksAndCountersUsageData) => string,
    options: { formatPokemonNames?: boolean; formatItemNames?: boolean } = {}
  ): Promise<void> {
    const safeUsageData = usageData ? usageData.slice(0, 24) : [];
    if (!safeUsageData.length) {
      embed.setDescription('No data available for this query.');
      return;
    }

    const titles = options.formatPokemonNames
      ? safeUsageData.map(usage => this.formatPokemonDisplayName(usage.name))
      : options.formatItemNames
        ? safeUsageData.map(usage => this.formatItemDisplayName(usage.name))
        : safeUsageData.map(usage => usage.name);

    safeUsageData.forEach((usage, index) => {
      const name = this.formatRankedTitle(index + 1, titles[index]);
      const value = formatter
        ? formatter(usage)
        : `Usage: \`${usage.percentage.toFixed(2)}%\``;

      embed.addFields({ name, value, inline: true });
    });
  }
  
  protected formatRankedTitle(position: number, title: string): string {
    //return `${position}º) ${title}`;
    return `#${position} ${title}`;
  }

  protected findFirstPokemon(names: string[]): Pokemon | undefined {
    return names
      .map(name => this.dataSource.pokemonDb.getPokemon(name))
      .find((pokemon): pokemon is Pokemon => !!pokemon);
  }

  protected formatPokemonDisplayName(name: string): string {
    const emojiService = this.dataSource.emojiService;
    if (!emojiService) {
      return name;
    }

    const emoji = emojiService.getPokemonEmoji(name);
    return emoji ? `${emoji} ${name}` : name;
  }

  protected formatItemDisplayName(name: string): string {
    const emojiService = this.dataSource.emojiService;
    if (!emojiService) {
      return name;
    }

    const emoji = emojiService.getItemEmoji(name);
    return emoji ? `${emoji} ${name}` : name;
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

    if (meta) {
      args.push(`meta:${meta}`);
    }

    if (generation) {
      args.push(`generation:${generation}`);
    }

    return args.join(' ');
  }

  protected isCheckAndCounters(usage: UsageData | ChecksAndCountersUsageData): usage is ChecksAndCountersUsageData {
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
    .setDescription('Competitive metagame / (VGC) regulation')
    .addChoices(...getMetaChoices());
}

function getMetaChoices() {
  const defaultFormat = FormatConfig.getDefaultFormat();
  const vgcChoices = FormatCatalog.VgcSeasons.map(season => ({
    name: FormatHelper.getMetaDisplayName(season.meta),
    value: season.meta,
  }));
  const standardChoices = FormatCatalog.StandardMetaValues.map(meta => ({
    name: FormatHelper.getMetaDisplayName(meta),
    value: meta,
  }));

  return [ ...vgcChoices, ...standardChoices ].map(choice => ({
    ...choice,
    name: choice.value === defaultFormat.meta
      ? `${choice.name} (Default)`
      : choice.name,
  }));
}
