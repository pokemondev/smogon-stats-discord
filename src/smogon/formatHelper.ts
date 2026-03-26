import { SmogonFormat } from "./usageModels";
import { PokemonSet, Evs } from "./setsModels";
import { Pokemon } from "../pokemon/models";

interface VgcSeason {
  gen: string;
  year: string;
  meta: string;
  aliases: string[];
  regulation?: string;
  isDefault?: boolean;
}

export class FormatHelper {
  public static Generations = [ 'gen9', 'gen8', 'gen7', 'gen6' ];
  public static VgcSeasons: VgcSeason[] = [
    { gen: 'gen9', year: '2026', regulation: 'regf', meta: 'vgc2026regf', aliases: [ 'vgc2026', 'vgc2026regf' ], isDefault: true },
    { gen: 'gen9', year: '2026', regulation: 'regi', meta: 'vgc2026regi', aliases: [ 'vgc2026regi' ] },
    { gen: 'gen8', year: '2021', meta: 'vgc2021', aliases: [ 'vgc2021' ], isDefault: true },
    { gen: 'gen8', year: '2020', meta: 'vgc2020', aliases: [ 'vgc2020' ], isDefault: true },
    { gen: 'gen7', year: '2019', meta: 'vgc2019', aliases: [ 'vgc2019' ], isDefault: true },
   ];
  public static MetaValues = [ 'ubers', 'ou', 'uu', 'ru', 'nu', ...FormatHelper.VgcSeasons.map(season => season.meta) ];
  public static MetaAliases = [ 'ubers', 'uber', 'ou', 'uu', 'ru', 'nu', 'vgc', ...FormatHelper.VgcSeasons.map(season => season.meta) ];
  
  public static getFormat(args: string[]): SmogonFormat {
    const normalizedArgs = args.map(a => this.normalizeValue(a));
    let gen  = normalizedArgs.find(a => this.isValidGen(a));
    let meta = normalizedArgs.find(a => this.isValidMeta(a) || a == 'vgc');
    const vgcYear = normalizedArgs.find(a => /^\d{4}$/.test(a));
    const vgcRegulation = normalizedArgs.find(a => /^reg[a-z0-9]+$/.test(a));

    if (this.isVgc(meta) || !!vgcYear) {
      ({ meta, gen } = this.ensureValidVgc(meta, gen, vgcYear, vgcRegulation));
    }

    // TODO: refactor meta nickname approach
    if (meta == "uber") {
      meta = "ubers";
    }

    return {
      generation: this.normalizeGeneration(gen) || this.getDefault().generation,
      meta: (meta || this.getDefault().meta).toLowerCase()
    };
  }

  public static isValidGen(gen: string): boolean {
    const normalizedGen = this.normalizeGeneration(gen);
    return this.Generations.some(g => g == normalizedGen);
  }

  public static isValidMeta(meta: string): boolean {
    const normalizedMeta = meta.toLowerCase();
    return this.MetaAliases.some(value => value == normalizedMeta) || this.isKnownVgcAlias(normalizedMeta);
  }

  public static getDefault(): SmogonFormat {
    return { generation: "gen9", meta: "ou" }; 
  }

  public static getKeyFrom(format: SmogonFormat): string {
    return format.generation + format.meta;
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
    const season = this.getVgcSeason(meta, gen, year, regulation);
    return { meta: season.meta, gen: season.gen };
  }

  private static isVgc(meta: string): boolean { return meta && meta.startsWith("vgc"); };

  private static getVgcSeason(meta: string, gen: string, year?: string, regulation?: string): VgcSeason {
    const normalizedMeta = meta ? meta.toLowerCase() : '';
    const normalizedGen = gen ? gen.toLowerCase() : '';
    const normalizedYear = year ? year.toLowerCase() : this.getVgcYearFromMeta(normalizedMeta);
    const normalizedRegulation = regulation ? regulation.toLowerCase() : this.getVgcRegulationFromMeta(normalizedMeta);

    const seasonByMeta = normalizedMeta
      ? this.VgcSeasons.find(season => season.meta == normalizedMeta || season.aliases.some(alias => alias == normalizedMeta))
      : undefined;
    if (seasonByMeta) return seasonByMeta;

    const seasonByYearAndRegulation = normalizedYear && normalizedRegulation
      ? this.VgcSeasons.find(season => season.year == normalizedYear && season.regulation == normalizedRegulation)
      : undefined;
    if (seasonByYearAndRegulation) return seasonByYearAndRegulation;

    const seasonByGenAndRegulation = normalizedGen && normalizedRegulation
      ? this.VgcSeasons.find(season => season.gen == normalizedGen && season.regulation == normalizedRegulation)
      : undefined;
    if (seasonByGenAndRegulation) return seasonByGenAndRegulation;

    const seasonByYear = normalizedYear
      ? this.getDefaultVgcSeason(season => season.year == normalizedYear)
      : undefined;
    if (seasonByYear) return seasonByYear;

    const seasonByGen = normalizedGen
      ? this.getDefaultVgcSeason(season => season.gen == normalizedGen)
      : undefined;
    return seasonByGen || this.getDefaultVgcSeason();
  }

  private static isKnownVgcAlias(meta: string): boolean {
    return this.VgcSeasons.some(season => season.meta == meta || season.aliases.some(alias => alias == meta));
  }

  private static getVgcYearFromMeta(meta: string): string {
    if (!meta || meta == 'vgc') return '';

    const match = /^vgc(\d{4})/.exec(meta);
    return match ? match[1] : '';
  }

  private static getVgcRegulationFromMeta(meta: string): string {
    if (!meta || meta == 'vgc') return '';

    const match = /^vgc\d{4}(reg[a-z0-9]+)$/.exec(meta);
    return match ? match[1] : '';
  }

  private static getDefaultVgcSeason(predicate: (season: VgcSeason) => boolean = () => true): VgcSeason {
    return this.VgcSeasons.find(season => season.isDefault && predicate(season))
      || this.VgcSeasons.find(predicate)
      || this.VgcSeasons[0];
  }

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
    if (!gen)
      return '';

    const normalizedGen = gen.toLowerCase();
    if (/^\d{1,2}$/.test(normalizedGen))
      return `gen${normalizedGen}`;

    return normalizedGen.startsWith('gen')
      ? normalizedGen
      : `gen${normalizedGen}`;
  }

  private static normalizeValue(value?: string): string {
    if (!value)
      return '';

    const normalizedValue = value.toLowerCase();
    return /^\d{1,2}$/.test(normalizedValue)
      ? this.normalizeGeneration(normalizedValue)
      : normalizedValue;
  }
}