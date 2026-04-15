import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { CommandBase, CommandHelpTopic, MovesetCommandData, SlashCommandData, SlashCommandHandler, withFormatOptions, withNameOption, withPokemonInfoCategoryOption } from './command';
import { AppDataSource } from "../appDataSource";
import { DiscordHelper } from '../common/discordHelper';
import { FormatHelper } from '../smogon/formatHelper';
import { FormatCatalog } from '../smogon/formatCatalog';
import { TypeService } from '../pokemon/typeService';
import { EffectivenessType } from '../models/pokemon';
import { MoveSetUsage, UsageData } from '../models/smogonUsage';

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
  checks: {
    title: 'Checks',
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
  description: 'Pokemon-specific competitive data, moveset usage, and Smogon sets.',
  arguments: [
    'name: Pokemon name to search for.',
    'category: Required for /pokemon info. One of moves, abilities, items, spreads, checks, or teammates.',
    'meta: Optional competitive metagame / (VGC) regulation filter. Uses the configured default when omitted.',
    'generation: Optional generation filter. Uses the configured default when omitted. If only generation is provided, that generation uses its default VGC format.',
  ],
  examples: [
    '/pokemon summary name:dragonite',
    '/pokemon info name:gholdengo category:items meta:OU',
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
    )));
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
      default:
        await interaction.reply({ content: 'That subcommand is not supported.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
    const category = interaction.options.getString('category', true) as PokemonInfoCategory;
    const handler = pokemonInfoHandlers[category];
    if (!handler) {
      await interaction.reply({ content: 'That info category is not supported.', flags: MessageFlags.Ephemeral });
      return;
    }

    await this.handleMoveset(
      interaction,
      handler.title,
      handler.selector,
      {
        formatPokemonNames: category === 'checks' || category === 'teammates',
        formatItemNames: category === 'items',
        formatMoveNames: category === 'moves',
      }
    );
  }

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

  private async handleMoveset(
    interaction: ChatInputCommandInteraction,
    title: string,
    selector: (moveSet: MoveSetUsage) => UsageData[] | ReturnType<typeof this.getChecksData>,
    options: { formatPokemonNames?: boolean; formatItemNames?: boolean; formatMoveNames?: boolean } = {}
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

  private getChecksData(moveSet: MovesetCommandData['moveSet']) {
    return moveSet.checksAndCounters;
  }

  private getData(usageData: UsageData[], limit: number = 6, highlighEverything: boolean = false): string {
    const hl1 = highlighEverything ? "\`" : "";
    const hl2 = highlighEverything ? ""   : "\`";
    const data = (usageData ? usageData : []).slice(0, limit).map(iv => `${hl1}${iv.name}: ${hl2}${iv.percentage.toFixed(2)}%\``).join('\n');
    return data ? data : "-";
  }
  private getMoveUsageData(usageData: UsageData[] | undefined, limit: number = 6): string {
    const safeData = (usageData ?? []).slice(0, limit);
    if (!safeData.length) {
      return '-';
    }

    return safeData.map(move => `${this.formatMoveDisplay(move.name)}: \`${move.percentage.toFixed(2)}%\``).join('\n');
  }
  private getItemUsageData(usageData: UsageData[] | undefined, limit: number = 6): string {
    const safeData = (usageData ?? []).slice(0, limit);
    if (!safeData.length) {
      return '-';
    }

    return safeData.map(item => `${this.formatItemDisplay(item.name)}: \`${item.percentage.toFixed(2)}%\``).join('\n');
  }
  private async getPokemonUsageData(usageData: UsageData[] | undefined, limit: number = 6): Promise<string> {
    const safeUsageData = (usageData ?? []).slice(0, limit);
    if (!safeUsageData.length)
      return '-';

    const displayNames = safeUsageData.map(entry => this.formatPokemonDisplay(entry.name));
    return safeUsageData.map((entry, index) => `${displayNames[index]}: \`${entry.percentage.toFixed(2)}%\``).join('\n');
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
}
