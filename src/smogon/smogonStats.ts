import cacheManager = require('cache-manager');
import { PokemonMoveSetSearch, PokemonUsage, MoveSetUsage, SmogonFormat } from "../models/smogonUsage";
import { FormatHelper } from "./formatHelper";
import { FileHelper } from "../common/fileHelper";
import { SmogonStatsError } from "../models/errors";

export class SmogonStats {

  private static readonly DefaultCacheTtlInSeconds = 60 * 2;
  private static readonly Gen8PriorityCacheTtlInSeconds = 60 * 5;
  private static readonly Gen9PriorityCacheTtlInSeconds = 60 * 10;

  private cachedDb: cacheManager.Cache = cacheManager.caching({
    store: 'memory',
    ttl: SmogonStats.DefaultCacheTtlInSeconds
  });

  public async getLeads(format: SmogonFormat): Promise<PokemonUsage[]> {
    const statsType = 'leads';
    const leads = await this.getStatsData<PokemonUsage[]>(statsType, format, (stats) => {
        return stats.data.rows
          .sort((a: number[], b: number[]) => (a[4] - b[4]) * -1) // reverse
          .slice(0, 15)
          .map((mon: any[]) => { return { name: mon[1], usageRaw: mon[4] } as PokemonUsage })
    });
    return leads;
  }

  public async getUsages(format: SmogonFormat, top15: boolean = true): Promise<PokemonUsage[]> {
    const statsType = 'usage';
    const usages = await this.getStatsData<PokemonUsage[]>(statsType, format, (stats) => {
      return stats.data.rows
        .sort((a: number[], b: number[]) => ((a[2]) - (b[2])) * -1) // uses percentages to sort in reverse        
        .map((mon: any[]) => { return { name: mon[1], rank: mon[0], usageRaw: mon[2] } as PokemonUsage });
    });

    return top15
      ? usages.slice(0, 15)
      : usages;
  }

  public async getUsage(pokemon: string, format: SmogonFormat): Promise<PokemonUsage | undefined> {
    const usages = await this.getUsages(format, false);
    return usages.find(u => u.name == pokemon);
  }

  public async getMoveSets(
    format: SmogonFormat,
    filter: ((pkm: MoveSetUsage) => boolean) | undefined = undefined
  ): Promise<MoveSetUsage[]> {
    const statsType = 'moveset';
    const sets = await this.getStatsData<MoveSetUsage[]>(statsType, format);
    
    return filter
      ? sets.filter(filter)
      : sets;
  }

  public async getMoveSet(pokemon: string, format: SmogonFormat): Promise<MoveSetUsage | undefined> {
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
      set.usage = usage.find(e => e.name == set.name)?.usageRaw ?? 0;
    })
    return sets
      .sort((a, b) => ((a.usage ?? 0) - (b.usage ?? 0)) * -1) // reverse        
      .slice(0, 15);
  }

  public async searchPokemon(format: SmogonFormat, search: PokemonMoveSetSearch): Promise<PokemonUsage[]> {
    const matchedMoveSets = await this.getMoveSets(format, (moveSet) => this.matchesSearch(moveSet, search));
    if (!matchedMoveSets.length) {
      return [];
    }

    const matchedNames = new Set(matchedMoveSets.map(moveSet => moveSet.name.toLowerCase()));
    return (await this.getUsages(format, false))
      .filter(usage => matchedNames.has(usage.name.toLowerCase()))
      .sort((left, right) => {
        if (left.usageRaw !== right.usageRaw) {
          return right.usageRaw - left.usageRaw;
        }

        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 15);
  }

  // private methods
  private async getStatsData<T>(statsType: string, format: SmogonFormat, callback: ((stats: any) => any) | undefined = undefined): Promise<T> {
    const fmt = FormatHelper.getKeyFrom(format);
    const cacheKey = `${statsType}_${fmt}`;
    const ttl = this.getCacheTtlInSeconds(format);
    let statsData: any;

    try {
      statsData = await this.cachedDb.wrap(cacheKey, () => {
        console.log('loading ' + statsType)
        let fileData = SmogonStats.loadFileData(statsType, format);

        if (callback)
          fileData = callback(fileData);

        return fileData;
      }, { ttl });
    }
    catch (error) {
      throw SmogonStats.buildStatsDataError(statsType, format, error);
    }

    return statsData as T;
  }

  private matchesSearch(moveSet: MoveSetUsage, search: PokemonMoveSetSearch): boolean {
    const moves = new Set((moveSet.moves ?? []).map(move => move.name.toLowerCase()));
    const abilities = new Set((moveSet.abilities ?? []).map(ability => ability.name.toLowerCase()));
    const requiredMoves = [search.move1, search.move2]
      .filter((move): move is string => !!move)
      .map(move => move.toLowerCase());

    if (!requiredMoves.every(move => moves.has(move))) {
      return false;
    }

    if (search.ability && !abilities.has(search.ability.toLowerCase())) {
      return false;
    }

    return true;
  }

  private getCacheTtlInSeconds(format: SmogonFormat): number {
    const isPriorityMeta = format.meta === 'ou' || format.meta.startsWith('vgc');

    if (isPriorityMeta) {
      if (format.generation === 'gen9')
        return SmogonStats.Gen9PriorityCacheTtlInSeconds;

      if (format.generation === 'gen8')
        return SmogonStats.Gen8PriorityCacheTtlInSeconds;
    }

    return SmogonStats.DefaultCacheTtlInSeconds;
  }

  private static loadFileData(statsType: string, format: SmogonFormat): any {
    const filename = `${statsType}-${FormatHelper.getKeyFrom(format)}`;
    const filePath = `smogon-stats/${format.generation}/${format.meta}/${filename}.json`;
    return FileHelper.loadFileDataAsAny(filePath);
  }

  private static buildStatsDataError(statsType: string, format: SmogonFormat, error: any): SmogonStatsError {
    if (error instanceof SmogonStatsError)
      return error;

    const details = error && error.message ? error.message : 'Unknown error';
    const formatDisplay = FormatHelper.toString(format);
    return new SmogonStatsError(statsType, format, `Could not load ${statsType} data for ${formatDisplay}. ${details}`);
  }
}