import { SmogonFormat } from "../models/smogonUsage";
import { PokemonSet, StatsValues } from "../models/smogonSets";
import { Pokemon } from "../models/pokemon";
import { FormatConfig } from '../config/formatConfig';
import { FormatCatalog } from './formatCatalog';

export class FormatHelper {
  private static readonly StatOrder = ['hp', 'at', 'df', 'sa', 'sd', 'sp'] as const;

  public static Generations = FormatCatalog.Generations;
  public static VgcSeasons = FormatCatalog.VgcSeasons;
  public static MetaValues = FormatCatalog.MetaValues;
  public static MetaAliases = FormatCatalog.MetaAliases;
  
  public static getFormat(args: string[]): SmogonFormat {
    const normalizedArgs = args.map(a => this.normalizeValue(a));
    let gen  = normalizedArgs.find(a => this.isValidGen(a));
    let meta = normalizedArgs.find(a => this.isValidMeta(a) || a == 'vgc');
    const vgcYear = normalizedArgs.find(a => /^\d{4}$/.test(a));
    const vgcRegulation = normalizedArgs.find(a => /^reg[a-z0-9]+$/.test(a));

    if (this.isVgc(meta) || !!vgcYear) {
      ({ meta, gen } = this.ensureValidVgc(meta, undefined, vgcYear, vgcRegulation));
    }

    const configuredDefault = this.getDefault();
    const normalizedGeneration = this.normalizeGeneration(gen);
    const normalizedMeta = this.normalizeMeta(meta);

    if (normalizedGeneration && normalizedMeta) {
      return {
        generation: normalizedGeneration,
        meta: normalizedMeta,
      };
    }

    if (normalizedGeneration) {
      return FormatCatalog.getGenerationDefaultVgcFormat(normalizedGeneration);
    }

    if (normalizedMeta) {
      return {
        generation: configuredDefault.generation,
        meta: normalizedMeta,
      };
    }

    return configuredDefault;
  }

  public static isValidGen(gen: string): boolean {
    return FormatCatalog.isValidGeneration(gen);
  }

  public static isValidMeta(meta: string): boolean {
    return FormatCatalog.isValidMeta(meta);
  }

  public static getDefault(): SmogonFormat {
    return FormatConfig.getDefaultFormat();
  }

  public static getKeyFrom(format: SmogonFormat): string {
    return format.generation + format.meta;
  }

  public static getMetaDisplayName(meta: string): string {
    return FormatCatalog.getMetaDisplayName(meta);
  }

  public static tryResolveSupportedSetMeta(generation: string, setName: string): string | undefined {
    return FormatCatalog.tryResolveSupportedSetMeta(generation, setName);
  }

  public static getSmogonAnalysisUrl(format: SmogonFormat): string {
    return FormatCatalog.getSmogonAnalysisUrl(format);
  }

  public static toUserString(format: SmogonFormat): string {
    return `${this.getMetaDisplayName(format.meta)} (Gen ${format.generation.replace(/^gen/i, '')})`;
  }

  public static toString(format: SmogonFormat): string {
    return `Gen ${format.generation.replace(/^gen/i, '')} ${format.meta.toUpperCase()}`;
  }

  public static getSmogonSet(set: PokemonSet, pokemon?: Pokemon): string {
    const displayName = pokemon?.name ?? set.name;
    const lines = [
      displayName + (set.item ? ' @ ' + set.item : ''),
    ];

    if (set.ability) lines.push('Ability: ' + set.ability);
    if (set.level) lines.push('Level: ' + set.level);

    const ivs = this.formatStatSpread('IVs', set.ivs);
    if (ivs) lines.push(ivs);

    const evs = this.formatStatSpread('EVs', set.evs, 510);
    if (evs) lines.push(evs);

    if (set.nature) lines.push(set.nature + ' Nature');

    set.moves
      .filter(moveName => moveName && moveName !== '(No Move)')
      .forEach(moveName => lines.push('- ' + moveName));

    return lines.join('\n').trim();
  }

  // helpers
  private static ensureValidVgc(meta?: string, gen?: string, year?: string, regulation?: string) {
    const season = FormatCatalog.resolveVgcSeason(meta, gen, year, regulation);
    return { meta: season.meta, gen: season.gen };
  }

  private static isVgc(meta?: string): boolean { return FormatCatalog.isVgcMeta(meta); };

  private static formatStatSpread(label: string, spread?: StatsValues, maxTotal?: number): string | undefined {
    if (!spread) 
      return undefined;

    let total = 0;
    const values = this.getOrderedStatEntries(spread)
      .filter(([, value]) => value !== undefined)
      .flatMap(([stat, value]) => {
        if (value === undefined)
          return [];        

        if (maxTotal !== undefined && total + value > maxTotal)
          return [];        

        total += value;
        return [`${value} ${this.getDisplayStatName(stat)}`];
      });

    return values.length ? `${label}: ${values.join(' / ')}` : undefined;
  }

  private static getOrderedStatEntries(spread: StatsValues): Array<[string, number | undefined]> {
    const knownEntries = this.StatOrder.map(stat => [stat, spread[stat]] as [string, number | undefined]);
    const extraEntries = Object.entries(spread)
      .filter(([stat]) => !this.StatOrder.includes(stat as typeof this.StatOrder[number]));

    return [...knownEntries, ...extraEntries];
  }

  private static getDisplayStatName(stat: string): string {
    switch (stat) {
      case 'hp': return 'HP';
      case 'at': return 'Atk';
      case 'df': return 'Def';
      case 'sa': return 'SpA';
      case 'sd': return 'SpD';
      case 'sp': return 'Spe';
      default: return stat.toUpperCase();
    }
  }

  private static normalizeGeneration(gen?: string): string {
    return FormatCatalog.normalizeGeneration(gen);
  }

  private static normalizeValue(value?: string): string {
    return FormatCatalog.normalizeValue(value);
  }

  private static normalizeMeta(meta?: string): string {
    return FormatCatalog.normalizeMeta(meta);
  }
}