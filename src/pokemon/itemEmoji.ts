import { SmogonStats } from '../smogon/smogonStats';
import { PokemonEmoji } from './pokemonEmoji';

export interface ItemEmojiRosterEntry {
  itemName: string;
  emojiKey: string;
  emojiName: string;
  minispriteUrl: string;
}

export interface ItemEmojiRosterResult {
  entries: ItemEmojiRosterEntry[];
}

type StatsLike = Pick<SmogonStats, 'getMoveSets'>;

export class ItemEmoji {
  public static readonly Prefix = 'item';
  public static readonly SmogonItemSpriteBaseUrl = 'https://www.smogon.com/forums/media/minisprites';

  private static readonly IgnoredItemNames = new Set(['Other', 'Others', 'nothing', 'Nothing']);

  public static async buildRoster(stats: StatsLike): Promise<ItemEmojiRosterResult> {
    const sources = PokemonEmoji.buildRosterSources();
    const entriesByKey = new Map<string, ItemEmojiRosterEntry>();

    for (const source of sources) {
      const moveSets = await stats.getMoveSets(source.format);

      for (const moveSet of moveSets) {
        for (const item of moveSet.items ?? []) {
          if (ItemEmoji.IgnoredItemNames.has(item.name)) {
            continue;
          }

          const emojiKey = ItemEmoji.toEmojiKey(item.name);
          if (entriesByKey.has(emojiKey)) {
            continue;
          }

          entriesByKey.set(emojiKey, {
            itemName: item.name,
            emojiKey,
            emojiName: ItemEmoji.toEmojiNameFromKey(emojiKey),
            minispriteUrl: ItemEmoji.toMinispriteUrl(item.name),
          });
        }
      }
    }

    return {
      entries: Array.from(entriesByKey.values()),
    };
  }

  public static toEmojiKey(name: string): string {
    return ItemEmoji.normalizeName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  public static toEmojiName(name: string): string {
    return ItemEmoji.toEmojiNameFromKey(ItemEmoji.toEmojiKey(name));
  }

  public static toEmojiNameFromKey(key: string): string {
    return `${ItemEmoji.Prefix}_${key}`;
  }

  public static toMinispriteKey(name: string): string {
    return ItemEmoji.normalizeName(name)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  public static toMinispriteUrl(name: string): string {
    return `${ItemEmoji.SmogonItemSpriteBaseUrl}/${ItemEmoji.toMinispriteKey(name)}.png`;
  }

  private static normalizeName(name: string): string {
    return name
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019'.]/g, '');
  }
}
