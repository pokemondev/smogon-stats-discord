import { SmogonFormat } from "./models";

export class FormatHelper {
  public static Generations = [ 'gen8', 'gen7', 'gen6' ];
  public static Tiers = [ 'ou', 'uu', 'vgc', 'vgc2020', 'vgc2019' ];
  public static VgcSeasons = [
    { gen: 'gen8', year: '2020'},
    { gen: 'gen7', year: '2019'},
   ];
  
  public static getFormat(args: string[]): SmogonFormat {
    let gen  = args.find(a => this.Generations.some(g => g == a.toLowerCase()));
    let tier = args.find(a => this.Tiers.some(t => t == a.toLowerCase()));

    if (this.isVgc(tier)) {
      ({ tier, gen } = this.ensureValidVgc(tier, gen));
    }

    return {
      generation: (gen || "gen7").toLowerCase(),
      tier: (tier || "ou").toLowerCase()
    };
  }

  public static isValidGen(gen: string): boolean {
    return this.Generations.some(g => g == gen.toLowerCase());
  }

  public static isValidTier(tier: string): boolean {
    return this.Tiers.some(t => t == tier.toLowerCase());
  }

  public static getDefault(): SmogonFormat {
    return { generation: "gen7", tier: "ou" }; 
  }

  public static getKeyFrom(format: SmogonFormat): string {
    return format.generation + format.tier;
  }

  public static toString(format: SmogonFormat): string {
    return `Gen ${format.generation[format.generation.length-1]} ${format.tier.toUpperCase()}`;
  }

  // helpers
  private static ensureValidVgc(tier: string, gen: string) {
    if (this.hasValidVgcYear(tier)) {
      gen = this.getValidVgcGen(gen, tier.substring(3));
    }
    else {
      const year = FormatHelper.getValidVgcYear(gen);
      tier = "vgc" + year;
      gen = this.getValidVgcGen(gen, year);
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
    return vgcByYear ? vgcByYear.gen : 'gen8';
  }
}