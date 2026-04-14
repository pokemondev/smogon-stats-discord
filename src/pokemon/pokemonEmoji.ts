import { PokemonDb } from './pokemonDb';
import { SmogonStats } from '../smogon/smogonStats';
import { FormatCatalog } from '../smogon/formatCatalog';
import { SmogonFormat } from '../models/smogonUsage';
import { FormatHelper } from '../smogon/formatHelper';

export interface PokemonEmojiSource {
  format: SmogonFormat;
  limit: number;
}

export interface PokemonEmojiRosterEntry {
  pokemonName: string;
  emojiKey: string;
  emojiName: string;
  minispriteKey: string;
  minispriteUrl: string;
  sourceFormats: string[];
}

export interface PokemonEmojiRosterResult {
  entries: PokemonEmojiRosterEntry[];
  unresolvedNames: string[];
  sources: PokemonEmojiSource[];
}

type StatsLike = Pick<SmogonStats, 'getUsages'>;
type PokemonDbLike = Pick<PokemonDb, 'getPokemon'>;

export class PokemonEmoji {
  public static readonly Prefix = 'pkm';
  public static readonly ImportBatchSize = 8;
  public static readonly SmogonMiniSpriteBaseUrl = 'https://www.smogon.com/dex/media/sprites/xyicons';

  public static buildRosterSources(): PokemonEmojiSource[] {
    const latestGeneration = FormatCatalog.Generations[0];
    const latestVgcFormats = FormatCatalog.VgcSeasons
      .filter(season => season.gen === latestGeneration)
      .slice(0, 2)
      .map(season => ({ format: { generation: season.gen, meta: season.meta }, limit: 100 }));

    return [
      ...latestVgcFormats,
      { format: { generation: latestGeneration, meta: 'ubers' }, limit: 100 },
      { format: { generation: latestGeneration, meta: 'ou' }, limit: 100 },
      { format: { generation: latestGeneration, meta: 'uu' }, limit: 50 },
      { format: { generation: latestGeneration, meta: 'ru' }, limit: 50 },
      { format: { generation: latestGeneration, meta: 'nu' }, limit: 50 },
    ];
  }

  public static async buildRoster(stats: StatsLike, pokemonDb: PokemonDbLike): Promise<PokemonEmojiRosterResult> {
    const sources = PokemonEmoji.buildRosterSources();
    const entriesByKey = new Map<string, PokemonEmojiRosterEntry>();
    const unresolvedNames = new Set<string>();

    for (const source of sources) {
      const sourceKey = FormatHelper.getKeyFrom(source.format);
      const usageData = await stats.getUsages(source.format, false);

      for (const usage of usageData.slice(0, source.limit)) {
        const canonicalName = pokemonDb.getPokemon(usage.name)?.name ?? usage.name.trim();
        if (!pokemonDb.getPokemon(usage.name)) {
          unresolvedNames.add(usage.name);
        }

        const emojiKey = PokemonEmoji.toEmojiKey(canonicalName);
        const existingEntry = entriesByKey.get(emojiKey);
        if (existingEntry) {
          if (!existingEntry.sourceFormats.includes(sourceKey)) {
            existingEntry.sourceFormats.push(sourceKey);
          }
          continue;
        }

        entriesByKey.set(emojiKey, {
          pokemonName: canonicalName,
          emojiKey,
          emojiName: PokemonEmoji.toEmojiNameFromKey(emojiKey),
          minispriteKey: PokemonEmoji.toMinispriteKey(canonicalName),
          minispriteUrl: PokemonEmoji.toMinispriteUrl(canonicalName),
          sourceFormats: [sourceKey],
        });
      }
    }

    return {
      entries: Array.from(entriesByKey.values()),
      unresolvedNames: Array.from(unresolvedNames).sort((left, right) => left.localeCompare(right)),
      sources,
    };
  }

  public static toEmojiKey(name: string): string {
    return PokemonEmoji.normalizeName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  public static toEmojiName(name: string): string {
    return PokemonEmoji.toEmojiNameFromKey(PokemonEmoji.toEmojiKey(name));
  }

  public static toEmojiNameFromKey(key: string): string {
    return `${PokemonEmoji.Prefix}_${key}`;
  }

  public static toMinispriteKey(name: string): string {
    return PokemonEmoji.normalizeName(name)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  public static toMinispriteUrl(name: string): string {
    return `${PokemonEmoji.SmogonMiniSpriteBaseUrl}/${PokemonEmoji.toMinispriteKey(name)}.png`;
  }

  public static chunkIntoBatches<T>(items: readonly T[], batchSize: number): T[][] {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error('Batch size must be a positive integer.');
    }

    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += batchSize) {
      batches.push(items.slice(index, index + batchSize));
    }

    return batches;
  }

  private static normalizeName(name: string): string {
    return name
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019'.:]/g, '')
      .replace(/♀/g, 'F')
      .replace(/♂/g, 'M');
  }
}