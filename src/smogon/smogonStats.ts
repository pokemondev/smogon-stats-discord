import cacheManager = require('cache-manager');
import { PokemonUsage, MoveSetUsage, SmogonFormat } from "./usageModels";
import { FormatHelper } from "./formatHelper";
import { FileHelper } from "../common/fileHelper";

export class SmogonStats {

  private database: { [id: string]: any; } = {};

  public async getLeads(format: SmogonFormat): Promise<PokemonUsage[]> {
    const statsType = 'leads';
    await this.loadData(statsType, format, (data) => {
      return data.data.rows
        .sort((a, b) => (a[4] - b[4]) * -1) // reverse
        .slice(0, 15)
        .map(mon => { return { name: mon[1], usageRaw: mon[4] } as PokemonUsage });
    });

    const fmt = FormatHelper.getKeyFrom(format);
    return await this.database[statsType].get(fmt);
  }

  public async getUsages(format: SmogonFormat, top15: boolean = true): Promise<PokemonUsage[]> {
    const statsType = 'usage';
    await this.loadData(statsType, format, (data) => {
      return data.data.rows
        .sort((a, b) => ((a[2]) - (b[2])) * -1) // uses percentages to sort in reverse        
        .map(mon => { return { name: mon[1], usageRaw: mon[2] } as PokemonUsage });
    });

    const fmt = FormatHelper.getKeyFrom(format);
    return top15
      ? (await this.database[statsType].get(fmt)).slice(0, 15)
      : await this.database[statsType].get(fmt);
  }

  public async getUsage(pokemon: string, format: SmogonFormat): Promise<PokemonUsage> {
    const usages = await this.getUsages(format, false);
    return usages.find(u => u.name == pokemon);
  }

  public async getMoveSets(format: SmogonFormat,
                           filter: (pkm: MoveSetUsage) => boolean = undefined): Promise<MoveSetUsage[]> {
    const statsType = 'moveset';
    await this.loadData(statsType, format);

    const fmt = FormatHelper.getKeyFrom(format);
    const sets = await this.database[statsType].get(fmt) as MoveSetUsage[];
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

  private async loadData(statsType, format: SmogonFormat, callback: (data: any) => any = undefined): Promise<void> {
    const fmt = FormatHelper.getKeyFrom(format);
    const dataLoaded = this.database[statsType] && await this.database[statsType].get(fmt);
    if (!dataLoaded) {
      console.log('loading ' + statsType)
      let fileData = this.loadFileData(statsType, format);

      if (callback)
        fileData = callback(fileData);

      const data = this.database[statsType] || cacheManager.caching({ store: 'memory', max: 1000, ttl: 60 * 5 /* 5 min */ });
      await data.set(fmt, fileData);
      this.database[statsType] = data;
    }
  }

  private loadFileData(statsType, format: SmogonFormat) {
    const filename = `${statsType}-${FormatHelper.getKeyFrom(format)}`;
    const filePath = `smogon-stats/${format.generation}/${format.tier}/${filename}.json`;
    return FileHelper.loadFileDataAsAny(filePath);
  }
}