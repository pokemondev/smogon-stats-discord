import { SmogonFormat } from "../models/smogonUsage";
import { PokemonSet, Evs } from "../models/smogonSets";
import { Pokemon } from "../models/pokemon";
import { FormatConfig } from '../config/formatConfig';
import { FormatCatalog } from './formatCatalog';

export class FormatHelper {
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

  public static getSmogonSet(pokemon: Pokemon, set: PokemonSet): string {
    var evCounter = 0;
    var pkmSetText = "";
    pkmSetText = pokemon.name + (set.item ? " @ " + set.item : "") + "\n";
    pkmSetText += set.nature + " Nature" + "\n";
    pkmSetText += set.ability ? "Ability: " + set.ability + "\n" : "";
    
    pkmSetText += "EVs: ";
    var evsArray = [];
    for (var stat in set.evs) {
      if (set.evs[stat]) {
        evsArray.push(set.evs[stat] + " " + this.getDisplayStatName(stat));
        evCounter += set.evs[stat];
        if (evCounter > 510) break;
      }
    }
    pkmSetText += evsArray.reduce((a,b) => `${a} / ${b}`); // serialize(evsArray, " / ");
    pkmSetText += "\n";
    
    for (var i = 0; i < 4; i++) {
      var moveName = set.moves[i];
      if (moveName !== "(No Move)") {
        pkmSetText += "- " + moveName + "\n";
      }
    }
    pkmSetText = pkmSetText.trim();
    return pkmSetText;
  }

  // helpers
  private static ensureValidVgc(meta: string, gen: string, year?: string, regulation?: string) {
    const season = FormatCatalog.resolveVgcSeason(meta, gen, year, regulation);
    return { meta: season.meta, gen: season.gen };
  }

  private static isVgc(meta?: string): boolean { return FormatCatalog.isVgcMeta(meta); };

  private static getDisplayStatName(stat: string) {
    switch (stat) {
      case 'hp': return 'HP';
      case 'at': return 'Atk';
      case 'df': return 'Def';
      case 'sa': return 'SpA';
      case 'sd': return 'SpD';
      case 'sp': return 'Spe';
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