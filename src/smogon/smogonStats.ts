import cacheManager = require('cache-manager');
import { PokemonUsage, MoveSetUsage, SmogonFormat } from "./usageModels";
import { FormatHelper } from "./formatHelper";
import { FileHelper } from "../common/fileHelper";

export class SmogonStats {

  private cachedDb: cacheManager.Cache = cacheManager.caching({ store: 'memory', max: 1000, ttl: 60 * 5 /* 5 min */ });

  public async getLeads(format: SmogonFormat): Promise<PokemonUsage[]> {
    const statsType = 'leads';
    const leads = await this.getStatsData<PokemonUsage[]>(statsType, format, (stats) => {
        return stats.data.rows
          .sort((a, b) => (a[4] - b[4]) * -1) // reverse
          .slice(0, 15)
          .map(mon => { return { name: mon[1], usageRaw: mon[4] } as PokemonUsage })
    });
    return leads;
  }

  public async getUsages(format: SmogonFormat, top15: boolean = true): Promise<PokemonUsage[]> {
    const statsType = 'usage';
    const usages = await this.getStatsData<PokemonUsage[]>(statsType, format, (stats) => {
      return stats.data.rows
        .sort((a, b) => ((a[2]) - (b[2])) * -1) // uses percentages to sort in reverse        
        .map(mon => { return { name: mon[1], rank: mon[0], usageRaw: mon[2] } as PokemonUsage });
    });

    return top15
      ? usages.slice(0, 15)
      : usages;
  }

  public async getUsage(pokemon: string, format: SmogonFormat): Promise<PokemonUsage> {
    const usages = await this.getUsages(format, false);
    return usages.find(u => u.name == pokemon);
  }

  public async getMoveSets(format: SmogonFormat,
                           filter: (pkm: MoveSetUsage) => boolean = undefined): Promise<MoveSetUsage[]> {
    const statsType = 'moveset';
    const sets = await this.getStatsData<MoveSetUsage[]>(statsType, format);
    
    return filter
      ? sets.filter(filter)
      : sets;
  }

  public async getMoveSet(pokemon: string, format: SmogonFormat): Promise<MoveSetUsage> {
    const sets = await this.getMoveSets(format);
    return sets.find(e => e.name.toLowerCase() == pokemon.toLowerCase());
  }

  public async getMegasMoveSets(format: SmogonFormat): Promise<MoveSetUsage[]> {
    const sets = (await this.getMoveSets(
      format,
      (e) => e.items.some(i => e.name.endsWith("-Mega") && i.name.endsWith('ite'))
    )).slice(0, 15);

    const usage = (await this.getUsages(format, false)).filter(e => sets.some(s => s.name == e.name));
    sets.forEach(set => {
      set.usage = usage.find(e => e.name == set.name).usageRaw
    })
    return sets
      .sort((a, b) => (a.usage - b.usage) * -1) // reverse        
      .slice(0, 15);
  }

  // private methods
  private async getStatsData<T>(statsType: string, format: SmogonFormat, callback: (stats: any) => any = undefined): Promise<T> {
    const fmt = FormatHelper.getKeyFrom(format);
    const cacheKey = `${statsType}_${fmt}`;
    const statsData = await this.cachedDb.wrap(cacheKey, function(cb) {
      
      console.log('loading ' + statsType)
      let fileData = SmogonStats.loadFileData(statsType, format);
  
      if (callback)
        fileData = callback(fileData);
      
      return fileData;
    });

    return statsData as T;
  }

  private static loadFileData(statsType: string, format: SmogonFormat): any {
    const filename = `${statsType}-${FormatHelper.getKeyFrom(format)}`;
    const filePath = `smogon-stats/${format.generation}/${format.tier}/${filename}.json`;
    return FileHelper.loadFileDataAsAny(filePath);
  }
}