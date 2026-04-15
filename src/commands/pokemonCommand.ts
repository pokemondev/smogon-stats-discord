import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { CommandBase, CommandHelpTopic, MovesetCommandData, SlashCommandData, SlashCommandHandler, withFormatOptions, withNameOption, withPokemonInfoCategoryOption } from './command';
import { AppDataSource } from "../appDataSource";
import { DiscordHelper } from '../common/discordHelper';
import { FormatHelper } from '../smogon/formatHelper';
import { FormatCatalog } from '../smogon/formatCatalog';
import { TypeService } from '../pokemon/typeService';
import { EffectivenessType } from '../models/pokemon';
import { ChecksAndCountersUsageData, MoveSetUsage, PokemonMoveSetSearch, UsageData } from '../models/smogonUsage';

const pokemonInfoHandlers = {
  moves: {
    title: 'Moves',
    selector: (moveSet: MoveSetUsage) => moveSet.moves,
  },
  abilities: {
    title: 'Abilities',
    selector: (moveSet: MoveSetUsage) => moveSet.abilities,
  },
  items: {
    title: 'Items',
    selector: (moveSet: MoveSetUsage) => moveSet.items,
  },
  spreads: {
    title: 'Spreads',
    selector: (moveSet: MoveSetUsage) => moveSet.spreads,
  },
  checksCounters: {
    title: 'Checks & Counters',
    selector: (moveSet: MoveSetUsage) => moveSet.checksAndCounters,
  },
  checks: {
    title: 'Checks & Counters',
    selector: (moveSet: MoveSetUsage) => moveSet.checksAndCounters,
  },
  teammates: {
    title: 'Teammates',
    selector: (moveSet: MoveSetUsage) => moveSet.teamMates,
  },
} as const;

type PokemonInfoCategory = keyof typeof pokemonInfoHandlers;

export const pokemonHelpTopic: CommandHelpTopic = {
  command: 'pokemon',
  description: 'Pokemon-specific competitive data, moveset usage, filtered format searches, and Smogon sets.',
  arguments: [
    'name: Pokemon name to search for.',
    'category: Required for /pokemon info. One of moves, abilities, items, spreads, checks, or teammates.',
    'move1: Optional for /pokemon search. First move filter.',
    'move2: Optional for /pokemon search. Second move filter.',
    'ability: Optional for /pokemon search. Ability filter.',
    'meta: Optional competitive metagame / (VGC) regulation filter. Uses the configured default when omitted.',
    'generation: Optional generation filter. Uses the configured default when omitted. If only generation is provided, that generation uses its default VGC format.',
  ],
  examples: [
    '/pokemon summary name:dragonite',
    '/pokemon info name:gholdengo category:items meta:OU',
    '/pokemon search move1:protect ability:cursed body meta:OU',
    '/pokemon sets name:landorus-therian meta:OU generation:"Gen 8"',
  ],
};

export function createPokemonCommandData(): SlashCommandData {
  return new SlashCommandBuilder()
    .setName('pokemon')
    .setDescription('Pokemon competitive data and Smogon sets')
    .addSubcommand(subcommand => withFormatOptions(withNameOption(
      subcommand
        .setName('summary')
        .setDescription('Show a full competitive summary for a Pokemon'),
      'Pokemon name'
    )))
    .addSubcommand(subcommand => withFormatOptions(withPokemonInfoCategoryOption(withNameOption(
      subcommand
        .setName('info')
        .setDescription('Show a detailed usage category for a Pokemon'),
      'Pokemon name'
    ))))
    .addSubcommand(subcommand => withFormatOptions(withNameOption(
      subcommand
        .setName('sets')
        .setDescription('Show curated Smogon sets for a Pokemon'),
      'Pokemon name'
    )))
    .addSubcommand(subcommand => withFormatOptions(
      subcommand
        .setName('search')
        .setDescription('Find Pokemon in a format by move and ability usage')
        .addStringOption(option =>
          option
            .setName('move1')
            .setDescription('First move filter')
        )
        .addStringOption(option =>
          option
            .setName('move2')
            .setDescription('Second move filter')
        )
        .addStringOption(option =>
          option
            .setName('ability')
            .setDescription('Ability filter')
        )
      ));
}

export class PokemonCommand extends CommandBase implements SlashCommandHandler {
  public readonly data = createPokemonCommandData();
  public readonly helpTopic = pokemonHelpTopic;

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'summary':
        await this.handleSummary(interaction);
        return;
      case 'info':
        await this.handleInfo(interaction);
        return;
      case 'sets':
        await this.handleSets(interaction);
        return;
      case 'search':
        await this.handleSearch(interaction);
        return;
      default:
        await interaction.reply({ content: 'That subcommand is not supported.', flags: MessageFlags.Ephemeral });
    }
  }

  // handlers for each sub-command
  private async handleSummary(interaction: ChatInputCommandInteraction): Promise<void> {
    const query = this.resolvePokemonQuery(interaction);
    if (!query) {
      const requestedName = this.getRequestedPokemonName(interaction);
      await this.replyNoData(interaction, `Could not find the provided Pokemon: '${requestedName}'.`);
      return;
    }

    await DiscordHelper.deferCommandReply(interaction);

    const cmd = await this.getMoveSetCommandData(query);
    const hasMovesetData = !!(cmd.moveSet.moves && cmd.moveSet.items);
    const isGen9 = cmd.format.generation === 'gen9';

    const embed = this.createPokemonEmbed(cmd.pokemon, {
      footer: this.getFooterDetails(interaction, cmd),
      image: true,
    });

    const { stats, baseStatsData } = this.getBaseStatsData(cmd);
    const isVgc = FormatCatalog.isVgcMeta(cmd.format.meta);
    
    const info = await this.getGeneralInfoData(cmd);
    const abilities = this.getData(cmd.moveSet.abilities);
    const moves = this.getMoveUsageData(cmd.moveSet.moves);
    const items = this.getItemUsageData(cmd.moveSet.items);
    const defensiveProfile = this.getWeakResistData(cmd);
    const teraTypes = this.getTeraTypesData(cmd);
    const typeFieldName = isGen9 ? 'Tera Types' : 'Weak/Resist';
    const typeFieldData = isGen9 ? teraTypes : defensiveProfile;
    const spreads = this.getData(cmd.moveSet.spreads, 4, true);
    const matchupFieldName = isVgc ? 'Team Mates' : 'Counters & Checks';
    const matchupFieldData = isVgc
      ? await this.getPokemonUsageData(cmd.moveSet.teamMates, 4)
      : await this.getCountersChecksData(cmd);

    embed.addFields(
      { name: `Base Stats Total: ${stats.tot}`, value: baseStatsData, inline: true },
      { name: 'General Info', value: info, inline: true },
    );

    if (hasMovesetData) {
      embed.addFields(
        { name: 'Abilities', value: abilities, inline: true },
        { name: 'Moves', value: moves, inline: true },
        { name: 'Items', value: items, inline: true },
        { name: typeFieldName, value: typeFieldData, inline: true },
        { name: 'Nature/IV Spread', value: spreads, inline: true },
        { name: matchupFieldName, value: matchupFieldData, inline: true },
      );
    } else {
      embed.addFields({ name: typeFieldName, value: typeFieldData, inline: true });
    }

    await interaction.editReply({
      content: `**__${cmd.pokemon.name}:__** ${FormatHelper.toUserString(cmd.format)}`,
      embeds: [embed],
    });
  }

  private async handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
    const category = interaction.options.getString('category', true) as PokemonInfoCategory;
    const handler = pokemonInfoHandlers[category];
    if (!handler) {
      await interaction.reply({ content: 'That info category is not supported.', flags: MessageFlags.Ephemeral });
      return;
    }

    await this.processUsageData(
      interaction,
      handler.title,
      handler.selector,
      {
        formatPokemon: category === 'checksCounters' || category === 'teammates',
        formatItem: category === 'items',
        formatMove: category === 'moves',
      }
    );
  }

  private async handleSets(interaction: ChatInputCommandInteraction): Promise<void> {
    const query = this.resolvePokemonQuery(interaction);
    if (!query) {
      const requestedName = this.getRequestedPokemonName(interaction);
      await this.replyNoData(interaction, `Could not find the provided Pokemon: '${requestedName}'.`);
      return;
    }

    await DiscordHelper.deferCommandReply(interaction);

    const sets = this.dataSource.smogonSets.get(query.pokemon, query.format);
    const smogonAnalysisUrl = FormatHelper.getSmogonAnalysisUrl(query.format);
    if (!sets.length) {
      await this.replyNoData(
        interaction,
        `No Smogon sets available for ${query.pokemon.name} in ${FormatHelper.toUserString(query.format)}.\nSmogon analysis: ${smogonAnalysisUrl}`
      );
      return;
    }

    const embed = this.createPokemonEmbed(query.pokemon, {
      footer: `Smogon analysis: ${smogonAnalysisUrl}`,
      thumbnail: true,
    });

    for (const set of sets) {
      embed.addFields({
        name: set.name,
        value: `\`\`\`${FormatHelper.getSmogonSet(set, query.pokemon)}\`\`\`\u2006`,
        inline: false,
      });
    }

    await interaction.editReply({
      content: `**__Sets:__** Top ${query.pokemon.name} sets of ${FormatHelper.toUserString(query.format)}`,
      embeds: [embed],
    });
  }

  private async handleSearch(interaction: ChatInputCommandInteraction): Promise<void> {
    const search = this.getResolvedSearch(interaction);
    if (!search) {
      return;
    }

    const format = this.getFormat(interaction);
    await DiscordHelper.deferCommandReply(interaction);

    const usages = await this.dataSource.smogonStats.searchPokemon(format, search);
    if (!usages.length) {
      await this.replyNoData(interaction, `No Pokemon found for ${this.getSearchDescription(search)} in ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const firstMon = this.findFirstPokemon(usages.map(usage => usage.name));
    if (!firstMon) {
      await this.replyNoData(interaction, `No Pokemon found for ${this.getSearchDescription(search)} in ${FormatHelper.toUserString(format)}.`);
      return;
    }

    const embed = this.createPokemonEmbed(firstMon, { thumbnail: true })
      .setTitle(this.getSearchTitle(search));
    const displayNames = usages.map(usage => this.formatPokemonDisplay(usage.name));

    usages.forEach((usage, index) => {
      embed.addFields({
        name: this.formatRankedTitle(index + 1, displayNames[index]),
        value: `Usage: \`${usage.usageRaw.toFixed(2)}%\``,
        inline: true,
      });
    });

    await interaction.editReply({
      content: `**__Search:__** Top ${usages.length} matching Pokemon of ${FormatHelper.toUserString(format)}`,
      embeds: [embed],
    });
  }

  // helper methods
  private getResolvedSearch(interaction: ChatInputCommandInteraction): PokemonMoveSetSearch | undefined {
    const move1 = interaction.options.getString('move1')?.trim();
    const move2 = interaction.options.getString('move2')?.trim();
    const ability = interaction.options.getString('ability')?.trim();

    if (!move1 && !move2 && !ability) {
      void this.replyNoData(interaction, 'Provide at least one of move1, move2, or ability for /pokemon search.');
      return undefined;
    }

    const resolvedMove1 = move1 ? this.dataSource.movedex.getMove(move1)?.name : undefined;
    if (move1 && !resolvedMove1) {
      void this.replyNoData(interaction, `Could not find the provided move: '${move1}'.`);
      return undefined;
    }

    const resolvedMove2 = move2 ? this.dataSource.movedex.getMove(move2)?.name : undefined;
    if (move2 && !resolvedMove2) {
      void this.replyNoData(interaction, `Could not find the provided move: '${move2}'.`);
      return undefined;
    }

    const resolvedAbility = ability ? this.dataSource.pokemonDb.getAbility(ability) : undefined;
    if (ability && !resolvedAbility) {
      void this.replyNoData(interaction, `Could not find the provided ability: '${ability}'.`);
      return undefined;
    }

    return {
      ...(resolvedMove1 ? { move1: resolvedMove1 } : {}),
      ...(resolvedMove2 ? { move2: resolvedMove2 } : {}),
      ...(resolvedAbility ? { ability: resolvedAbility } : {}),
    };
  }

  private async processUsageData(
    interaction: ChatInputCommandInteraction,
    title: string,
    selector: (pokemonSet: MoveSetUsage) => UsageData[] | ChecksAndCountersUsageData[],
    options: { formatPokemon?: boolean; formatItem?: boolean; formatMove?: boolean } = {}
  ): Promise<void> {
    const query = this.resolvePokemonQuery(interaction);
    if (!query) {
      const requestedName = this.getRequestedPokemonName(interaction);
      await this.replyNoData(interaction, `Could not find the provided Pokemon: '${requestedName}'.`);
      return;
    }

    await DiscordHelper.deferCommandReply(interaction);

    const cmd = await this.getMoveSetCommandData(query);
    const embed = this.createPokemonEmbed(cmd.pokemon, { thumbnail: true });
    const usageData = selector(cmd.moveSet);

    await this.addUsageFields(embed, usageData, usage => {
      return this.isCheckAndCounters(usage)
        ? `KO-ed: \`${usage.kOed.toFixed(2)}%\`\nSW. out: \`${usage.switchedOut.toFixed(2)}%\``
        : `Usage: \`${usage.percentage.toFixed(2)}%\``;
    }, options
    );

    await interaction.editReply({
      content: `**__${cmd.pokemon.name} ${title}:__** ${FormatHelper.toUserString(cmd.format)}`,
      embeds: [embed],
    });
  }

  private getBaseStatsData(cmd: MovesetCommandData) {
    const stats = cmd.pokemon.baseStats;
    const baseStatsH1 = "__\`HP   Atk  Def\`__";
    const baseStatsH2 = "__\`SpA  SpD  Spe\`__";
    const baseStatsL1 = `${baseStatsH1}\n\`${stats.hp.toString().padEnd(5, " ")}${stats.atk.toString().padEnd(5, " ")}${stats.def}\``;
    const baseStatsL2 = `${baseStatsH2}\n\`${stats.spA.toString().padEnd(5, " ")}${stats.spD.toString().padEnd(5, " ")}${stats.spe}\``;
    const baseStatsData = `${baseStatsL1}\n${baseStatsL2}`;
    return { stats, baseStatsData };
  }

  private async getGeneralInfoData(cmd: MovesetCommandData) {
    const usage = await this.dataSource.smogonStats.getUsage(cmd.pokemon.name, cmd.format);
    const usageInfo = usage ? `${usage.rank}º (${usage.usageRaw.toFixed(2)}%)` : 'N/A';
    
    const info1 = `Meta: \`${cmd.format.meta.toUpperCase()}\``;
    const info2 = `Generation: \`Gen ${cmd.format.generation.replace(/^gen/i, '')}\``;
    const typeDisplay = cmd.pokemon.type2
      ? `${this.formatTypeDisplay(cmd.pokemon.type1)} / ${this.formatTypeDisplay(cmd.pokemon.type2)}`
      : this.formatTypeDisplay(cmd.pokemon.type1);
    const info3 = `Type: ${typeDisplay}`;
    const info4 = `Usage: \`${usageInfo}\``;
    const infoX = `${info1}\n${info2}\n${info3}\n${info4}`;
    return infoX;
  }

  private getWeakResistData(cmd: MovesetCommandData) {
    const effectiveness = TypeService.getFullEffectiveness(cmd.pokemon);
    const weakss = effectiveness.filter(e => e.effect == EffectivenessType.SuperEffective
                                            || e.effect == EffectivenessType.SuperEffective2x)
                                .map((w, i) => ((i + 1) % 4 === 0 ? '\n' : '') + (w.effect == EffectivenessType.SuperEffective2x ? `**${this.formatTypeDisplay(w.type)}**` : this.formatTypeDisplay(w.type)))
                                .join(', ');
    const resist = effectiveness.filter(e => e.effect == EffectivenessType.NotVeryEffective
                                          || e.effect == EffectivenessType.NotVeryEffective2x)
                                .map((w, i) => ((i + 1) % 4 === 0 ? '\n' : '') + (w.effect == EffectivenessType.NotVeryEffective2x ? `**${this.formatTypeDisplay(w.type)}**` : this.formatTypeDisplay(w.type)))
                                .join(', ');
    const immune = effectiveness.filter(e => e.effect == EffectivenessType.None)
                                .map(w => this.formatTypeDisplay(w.type))
                                .join(', ');
    const weakResist = `__Weak to:__ \n${weakss}\n__Resist to:__ \n${resist  || 'None'}\n__Immune to:__\n${immune || 'None'}`;
    return weakResist;
  }

  private getTeraTypesData(cmd: MovesetCommandData): string {
    const safeData = (cmd.moveSet.teraTypes ?? []).slice(0, 6);
    if (!safeData.length) {
      return '-';
    }

    return safeData.map(entry => `${this.formatTypeDisplay(entry.name)}: \`${entry.percentage.toFixed(2)}%\``).join('\n');
  }

  private getData(usageData: UsageData[], limit: number = 6, highlighEverything: boolean = false): string {
    const hl1 = highlighEverything ? "\`" : "";
    const hl2 = highlighEverything ? ""   : "\`";
    const data = (usageData ? usageData : []).slice(0, limit).map(iv => `${hl1}${iv.name}: ${hl2}${iv.percentage.toFixed(2)}%\``).join('\n');
    return data ? data : "-";
  }
  private formatData(usageData: UsageData[], formatter: (name: string) => string, limit: number = 6): string {
    const data = usageData.slice(0, limit);
    if (!data.length)
      return '-';

    return data.map(e => `${formatter(e.name)}: \`${e.percentage.toFixed(2)}%\``).join('\n');
  }
  private getMoveUsageData(usageData: UsageData[] | undefined, limit: number = 6): string {
    return this.formatData(usageData ?? [], name => this.formatMoveDisplay(name), limit);
  }
  private getItemUsageData(usageData: UsageData[] | undefined, limit: number = 6): string {
    return this.formatData(usageData ?? [], name => this.formatItemDisplay(name), limit);
  }
  private async getPokemonUsageData(usageData: UsageData[] | undefined, limit: number = 6): Promise<string> {
    return this.formatData(usageData ?? [], name => this.formatPokemonDisplay(name), limit);
  }

  private async getCountersChecksData(cmd: MovesetCommandData, limit: number = 4): Promise<string> {
    const cc = (cmd.moveSet.checksAndCounters ? cmd.moveSet.checksAndCounters : []);
    const safeChecks = cc.slice(0, limit);
    if (!safeChecks.length)
      return '-';    

    const displayNames = safeChecks.map(entry => this.formatPokemonDisplay(entry.name));
    let countersChecks = safeChecks.map((entry, index) => `${displayNames[index]}: \`KO ${entry.kOed.toFixed(1)}% / SW ${entry.switchedOut.toFixed(1)}%\``).join('\n');
    countersChecks = countersChecks ? countersChecks : "-";
    return countersChecks;
  }

  private getFooterDetails(interaction: ChatInputCommandInteraction, cmd: MovesetCommandData): string {
    const pokemonName = cmd.pokemon.name.toLowerCase();
    const formatArgs = this.getSlashFormatArguments(interaction);
    
    return `Sets details on: /pokemon sets name:${pokemonName}${formatArgs ? ` ${formatArgs}` : ''}`;
  }

  private getSearchTitle(search: PokemonMoveSetSearch): string {
    return `Pokemon using ${this.getSearchDescription(search)}`;
  }

  private getSearchDescription(search: PokemonMoveSetSearch): string {
    const parts = [search.move1, search.move2]
      .filter((value): value is string => !!value)
      .map(value => `'${value}'`);

    if (search.ability) {
      parts.push(`'${search.ability}' ability`);
    }

    if (parts.length === 1) {
      return parts[0];
    }

    if (parts.length === 2) {
      return `${parts[0]} and ${parts[1]}`;
    }

    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }
}
