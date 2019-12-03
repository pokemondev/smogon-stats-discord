import { SmogonFormat } from "./models";

export class FormatHelper {
  //public static Generations = [ 'gen1', 'gen2', 'gen3', 'gen4', 'gen5', 'gen6', 'gen7' ];
  //public static Tiers = [ 'ou', 'uu', 'ru', 'nu' ];
  public static Generations = [ 'gen6', 'gen7', 'gen8' ];
  public static Tiers = [ 'ou', 'uu' ];
  
  public static getFormat(args: string[]): SmogonFormat {
    let gen  = args.find(a => this.Generations.some(g => g == a.toLowerCase()));
    let tier = args.find(a => this.Tiers.some(t => t == a.toLowerCase()));

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
}