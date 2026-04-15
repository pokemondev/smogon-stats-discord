import * as path from 'path';
import { PokemonType } from '../models/pokemon';

export interface TypeEmojiRosterEntry {
  typeName: string;
  emojiKey: string;
  emojiName: string;
  localFilePath: string;
}

export interface TypeEmojiRosterResult {
  entries: TypeEmojiRosterEntry[];
}

const TypeIconsDir = path.join(__dirname, '../../res/types-icons');

const TypeFileOverrides: Partial<Record<string, string>> = {}; // use when filename doesn't match type name

export class TypeEmoji {
  public static readonly Prefix = 'type';

  // All 18 standard types plus Stellar (absent from PokemonType enum).
  public static readonly AllTypes: readonly string[] = [
    ...Object.values(PokemonType),
    'Stellar',
  ];

  public static buildList(): TypeEmojiRosterResult {
    const entries: TypeEmojiRosterEntry[] = TypeEmoji.AllTypes.map(typeName => {
      const emojiKey = TypeEmoji.toEmojiKey(typeName);
      const fileStem = TypeFileOverrides[typeName] ?? typeName.toLowerCase();
      const localFilePath = path.join(TypeIconsDir, `${fileStem}.png`);
      return {
        typeName,
        emojiKey,
        emojiName: TypeEmoji.toEmojiNameFromKey(emojiKey),
        localFilePath,
      };
    });

    return { entries };
  }

  public static toEmojiKey(typeName: string): string {
    return typeName.toLowerCase();
  }

  public static toEmojiName(typeName: string): string {
    return TypeEmoji.toEmojiNameFromKey(TypeEmoji.toEmojiKey(typeName));
  }

  public static toEmojiNameFromKey(key: string): string {
    return `${TypeEmoji.Prefix}_${key}`;
  }
}
