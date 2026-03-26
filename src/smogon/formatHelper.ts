import { SmogonFormat } from "./usageModels";
import { PokemonSet, Evs } from "./setsModels";
import { Pokemon } from "../pokemon/models";

interface VgcSeason {
  gen: string;
  year: string;
  tier: string;
  aliases: string[];
  regulation?: string;
  isDefault?: boolean;
}

export class FormatHelper {
  public static Generations = [ 'gen9', 'gen8', 'gen7', 'gen6' ];
  public static VgcSeasons: VgcSeason[] = [
    { gen: 'gen9', year: '2026', regulation: 'regf', tier: 'vgc2026regf', aliases: [ 'vgc2026', 'vgc2026regf' ], isDefault: true },
    { gen: 'gen9', year: '2026', regulation: 'regi', tier: 'vgc2026regi', aliases: [ 'vgc2026regi' ] },
    { gen: 'gen8', year: '2021', tier: 'vgc2021', aliases: [ 'vgc2021' ], isDefault: true },
    { gen: 'gen8', year: '2020', tier: 'vgc2020', aliases: [ 'vgc2020' ], isDefault: true },
    { gen: 'gen7', year: '2019', tier: 'vgc2019', aliases: [ 'vgc2019' ], isDefault: true },
   ];
  public static Tiers = [ 'ubers', 'uber', 'ou', 'uu', 'ru', 'nu', 'vgc', ...FormatHelper.VgcSeasons.map(season => season.tier) ];
  
  public static getFormat(args: string[]): SmogonFormat {
    const normalizedArgs = args.map(a => a.toLowerCase());
    let gen  = normalizedArgs.find(a => this.Generations.some(g => g == a));
    let tier = normalizedArgs.find(a => this.isValidTier(a) || a == 'vgc');
    const vgcYear = normalizedArgs.find(a => /^\d{4}$/.test(a));
    const vgcRegulation = normalizedArgs.find(a => /^reg[a-z0-9]+$/.test(a));

    if (this.isVgc(tier) || !!vgcYear) {
      ({ tier, gen } = this.ensureValidVgc(tier, gen, vgcYear, vgcRegulation));
    }

    //TODO: refactor tiers to be enumeration 
    //TODO: refactor tiers nickname approach
    if (tier == "uber") {
      tier = "ubers";
    }

    return {
      generation: (gen || this.getDefault().generation).toLowerCase(),
      tier: (tier || this.getDefault().tier).toLowerCase()
    };
  }

  public static isValidGen(gen: string): boolean {
    return this.Generations.some(g => g == gen.toLowerCase());
  }

  public static isValidTier(tier: string): boolean {
    const normalizedTier = tier.toLowerCase();
    return this.Tiers.some(t => t == normalizedTier) || this.isKnownVgcAlias(normalizedTier);
  }

  public static getDefault(): SmogonFormat {
    return { generation: "gen9", tier: "ou" }; 
  }

  public static getKeyFrom(format: SmogonFormat): string {
    return format.generation + format.tier;
  }

  public static toString(format: SmogonFormat): string {
    return `Gen ${format.generation[format.generation.length-1]} ${format.tier.toUpperCase()}`;
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
  private static ensureValidVgc(tier: string, gen: string, year?: string, regulation?: string) {
    const season = this.getVgcSeason(tier, gen, year, regulation);
    return { tier: season.tier, gen: season.gen };
  }

  private static isVgc(tier: string): boolean { return tier && tier.startsWith("vgc"); };

  private static getVgcSeason(tier: string, gen: string, year?: string, regulation?: string): VgcSeason {
    const normalizedTier = tier ? tier.toLowerCase() : '';
    const normalizedGen = gen ? gen.toLowerCase() : '';
    const normalizedYear = year ? year.toLowerCase() : this.getVgcYearFromTier(normalizedTier);
    const normalizedRegulation = regulation ? regulation.toLowerCase() : this.getVgcRegulationFromTier(normalizedTier);

    const seasonByTier = normalizedTier
      ? this.VgcSeasons.find(season => season.tier == normalizedTier || season.aliases.some(alias => alias == normalizedTier))
      : undefined;
    if (seasonByTier) return seasonByTier;

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

  private static isKnownVgcAlias(tier: string): boolean {
    return this.VgcSeasons.some(season => season.tier == tier || season.aliases.some(alias => alias == tier));
  }

  private static getVgcYearFromTier(tier: string): string {
    if (!tier || tier == 'vgc') return '';

    const match = /^vgc(\d{4})/.exec(tier);
    return match ? match[1] : '';
  }

  private static getVgcRegulationFromTier(tier: string): string {
    if (!tier || tier == 'vgc') return '';

    const match = /^vgc\d{4}(reg[a-z0-9]+)$/.exec(tier);
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
}