import { SmogonFormat } from "./usageModels";
import { PokemonSet, Evs } from "./setsModels";
import { Pokemon } from "../pokemon/models";

export class FormatHelper {
  public static Generations = [ 'gen8', 'gen7', 'gen6' ];
  public static Tiers = [ 'ubers', 'uber', 'ou', 'uu', 'ru', 'nu', 'vgc', 'vgc2021', 'vgc2020', 'vgc2019' ];
  public static VgcSeasons = [
    { gen: 'gen8', year: '2021'},
    { gen: 'gen8', year: '2020'},
    { gen: 'gen7', year: '2019'},
   ];
  
  public static getFormat(args: string[]): SmogonFormat {
    let gen  = args.find(a => this.Generations.some(g => g == a.toLowerCase()));
    let tier = args.find(a => this.Tiers.some(t => t == a.toLowerCase()));

    if (this.isVgc(tier)) {
      ({ tier, gen } = this.ensureValidVgc(tier, gen));
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
    return this.Tiers.some(t => t == tier.toLowerCase());
  }

  public static getDefault(): SmogonFormat {
    return { generation: "gen8", tier: "ou" }; 
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
  private static ensureValidVgc(tier: string, gen: string) {
    if (this.hasValidVgcYear(tier)) {
      gen = this.getValidVgcGen(gen, tier.substring(3));
    }
    else {
      gen = this.getDefault().generation;
      const year = FormatHelper.getValidVgcYear(gen);
      tier = "vgc" + year;
    }
    return { tier, gen };
  }

  private static isVgc(tier: string): boolean { return tier && tier.startsWith("vgc"); };
  
  private static hasValidVgcYear(tier: string): boolean {
    // pre conditions
    if (tier.length != 7) return false;
    if (!this.isVgc(tier)) return false;

    const endingTerm = tier.substring(3);
    return this.VgcSeasons.some(t => t.year == endingTerm)
  };

  private static getValidVgcYear(gen: string): string {
    const currentYear = new Date().getFullYear().toString();
    if (gen) {
      const vgcByGen = this.VgcSeasons.find(i => i.gen == gen);
      return vgcByGen ? vgcByGen.year : currentYear;
    }
    return currentYear;
  }

  private static getValidVgcGen(gen: string, year: string): string {
    if (gen) {
      const vgcByGen = this.VgcSeasons.find(i => i.gen == gen);
      return vgcByGen ? vgcByGen.gen : gen;
    }
    
    const vgcByYear = this.VgcSeasons.find(i => i.year == year);
    return vgcByYear ? vgcByYear.gen : this.getDefault().generation;
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