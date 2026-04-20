import cacheManager = require('cache-manager');
import { compareByUsage } from '../common/sortingHelper';
import { BaseStats } from '../models/pokemon';
import {
  BaseStatTarget,
  BaseStatTargets,
  CachedFormatStatData,
  FormatStatBucket,
  FormatStatBuckets,
  FormatStatTargetThresholds,
} from '../models/statsRanking';
import { PokemonUsage, SmogonFormat } from '../models/smogonUsage';
import { PokemonDb } from '../pokemon/pokemonDb';
import { SmogonStats } from './smogonStats';
import { FormatHelper } from './formatHelper';

type BucketConfig = {
  bucket: FormatStatBucket;
  percentage: number;
};

type UsageWithStats = {
  usage: PokemonUsage;
  baseStats: BaseStats;
};

const bucketConfigs: BucketConfig[] = [
  { bucket: FormatStatBucket.Highest10p, percentage: 0.10 },
  { bucket: FormatStatBucket.Highest25p, percentage: 0.25 },
  { bucket: FormatStatBucket.Highest50p, percentage: 0.50 },
  { bucket: FormatStatBucket.Highest75p, percentage: 0.75 },
];

export class FormatStats {
  private readonly cachedDb: cacheManager.Cache = cacheManager.caching({
    store: 'memory',
    ttl: 60,
  });

  constructor(
    private readonly smogonStats: SmogonStats = new SmogonStats(),
    private readonly pokemonDb: PokemonDb = new PokemonDb(),
  ) {
  }

  public async getMinimumStatForBucket(format: SmogonFormat, statTarget: BaseStatTarget, bucket: FormatStatBucket): Promise<number | undefined> {
    const data = await this.getFormatData(format);
    return data.thresholdsByTarget[statTarget][bucket];
  }

  public async getBucketForBaseStats(
    format: SmogonFormat,
    statTarget: BaseStatTarget,
    baseStats: BaseStats,
  ): Promise<FormatStatBucket | undefined> {
    const data = await this.getFormatData(format);
    const targetThresholds = data.thresholdsByTarget[statTarget];
    const targetValue = this.getBaseStatTargetValue(baseStats, statTarget);

    return FormatStatBuckets.find(bucket => {
      const threshold = targetThresholds[bucket];
      return threshold !== undefined && targetValue >= threshold;
    });
  }

  public async isInBucket(
    format: SmogonFormat,
    statTarget: BaseStatTarget,
    baseStats: BaseStats,
    bucket: FormatStatBucket,
  ): Promise<boolean> {
    const threshold = await this.getMinimumStatForBucket(format, statTarget, bucket);
    if (threshold === undefined) {
      return false;
    }

    return this.getBaseStatTargetValue(baseStats, statTarget) >= threshold;
  }

  private async getFormatData(format: SmogonFormat): Promise<CachedFormatStatData> {
    const formatKey = FormatHelper.getKeyFrom(format);
    const cacheKey = `format-stats_${formatKey}`;
    const ttl = FormatHelper.getCacheTtlInSeconds(format);

    return this.cachedDb.wrap(cacheKey, async () => {
      const usages = await this.smogonStats.getUsages(format, false);
      return this.buildFormatData(usages);
    }, { ttl }) as Promise<CachedFormatStatData>;
  }

  private buildFormatData(usages: PokemonUsage[]): CachedFormatStatData {
    const resolvedUsages = usages
      .map(usage => {
        const pokemon = this.pokemonDb.getPokemon(usage.name);
        return pokemon
          ? { usage, baseStats: pokemon.baseStats }
          : undefined;
      })
      .filter((entry): entry is UsageWithStats => !!entry)
      .sort((left, right) => compareByUsage(left.usage, right.usage));

    return {
      sampleSize: resolvedUsages.length,
      thresholdsByTarget: this.buildThresholdsByTarget(resolvedUsages),
    };
  }

  private buildThresholdsByTarget(usages: UsageWithStats[]): FormatStatTargetThresholds {
    const thresholdsByTarget = {} as FormatStatTargetThresholds;

    for (const target of BaseStatTargets) {
      const statValues = usages
        .map(entry => this.getBaseStatTargetValue(entry.baseStats, target))
        .sort((left, right) => right - left);

      thresholdsByTarget[target] = this.buildBucketThresholds(statValues);
    }

    return thresholdsByTarget;
  }

  private getBaseStatTargetValue(baseStats: BaseStats, target: BaseStatTarget): number {
    switch (target) {
      case BaseStatTarget.Hp:
        return baseStats.hp;
      case BaseStatTarget.Atk:
        return baseStats.atk;
      case BaseStatTarget.Def:
        return baseStats.def;
      case BaseStatTarget.SpA:
        return baseStats.spA;
      case BaseStatTarget.SpD:
        return baseStats.spD;
      case BaseStatTarget.Spe:
        return baseStats.spe;
      case BaseStatTarget.Attacker:
        return Math.max(baseStats.atk, baseStats.spA);
      case BaseStatTarget.Defender:
        return Math.max(baseStats.def, baseStats.spD);
      default:
        return 0;
    }
  }

  private buildBucketThresholds(statValues: number[]): Partial<Record<FormatStatBucket, number>> {
    const thresholds: Partial<Record<FormatStatBucket, number>> = {};

    if (!statValues.length) {
      return thresholds;
    }

    for (const config of bucketConfigs) {
      const targetCount = Math.max(1, Math.ceil(statValues.length * config.percentage));
      const index = Math.min(targetCount - 1, statValues.length - 1);
      thresholds[config.bucket] = statValues[index];
    }

    return thresholds;
  }
}