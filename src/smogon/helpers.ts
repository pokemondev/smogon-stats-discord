import { SmogonFormat } from "./models";

export class FormatHelper {
  //public static Generations = [ 'gen1', 'gen2', 'gen3', 'gen4', 'gen5', 'gen6', 'gen7' ];
  //public static Tiers = [ 'ou', 'uu', 'ru', 'nu' ];
  public static Generations = [ 'gen6', 'gen7' ];
  public static Tiers = [ 'ou', 'uu' ];
  
  public static getFormat(args: string[]): SmogonFormat {
    let gen  = args.find(a => this.Generations.some(g => g == a.toLowerCase()));
    let tier = args.find(a => this.Tiers.some(t => t == a.toLowerCase()));

    return {
      generation: (gen || "gen7").toLowerCase(),
      tier: (tier || "ou").toLowerCase()
    };    
  }

  public static toString(format: SmogonFormat): string {
    return format.generation + format.tier;
  }

  public static toReadableString(format: SmogonFormat): string {
    return `Gen ${format.generation[format.generation.length-1]} ${format.tier.toUpperCase()}`;
  }
}