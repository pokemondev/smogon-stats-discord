import { Client } from 'discord.js';
import { PokemonEmoji } from './pokemonEmoji';
import { ItemEmoji } from './itemEmoji';
import { TypeEmoji } from './typeEmoji';

const UnknownEmojiName = 'others_unknown';

export class EmojiService {
  private client?: Client;
  private pokemonEmojiMap = new Map<string, string>();
  private itemEmojiMap = new Map<string, string>();
  private typeEmojiMap = new Map<string, string>();
  private unknownEmoji?: string;

  public async initialize(client: Client): Promise<void> {
    this.client = client;
    await this.loadEmojis();
  }

  public getLoadedEmojiCount(): number {
    return this.pokemonEmojiMap.size + this.itemEmojiMap.size + this.typeEmojiMap.size + (this.unknownEmoji ? 1 : 0);
  }

  public getPokemonEmoji(pokemonName: string, fallbackToUnknown = true): string | undefined {
    const emojiKey = PokemonEmoji.toEmojiKey(pokemonName);
    return this.pokemonEmojiMap.get(emojiKey) ?? (fallbackToUnknown ? this.unknownEmoji : undefined);
  }

  public getItemEmoji(itemName: string, fallbackToUnknown = true): string | undefined {
    const emojiKey = ItemEmoji.toEmojiKey(itemName);
    return this.itemEmojiMap.get(emojiKey) ?? (fallbackToUnknown ? this.unknownEmoji : undefined);
  }

  public getTypeEmoji(typeName: string, fallbackToUnknown = true): string | undefined {
    const emojiKey = TypeEmoji.toEmojiKey(typeName);
    return this.typeEmojiMap.get(emojiKey) ?? (fallbackToUnknown ? this.unknownEmoji : undefined);
  }

  private async loadEmojis(): Promise<void> {
    const emojis = await this.client!.application!.emojis.fetch();
    const pokemonMap = new Map<string, string>();
    const itemMap = new Map<string, string>();
    const typeMap = new Map<string, string>();
    const pokemonPrefix = `${PokemonEmoji.Prefix}_`;
    const itemPrefix = `${ItemEmoji.Prefix}_`;
    const typePrefix = `${TypeEmoji.Prefix}_`;

    emojis.forEach(emoji => {
      if (!emoji.name) {
        return;
      }

      if (emoji.name.startsWith(pokemonPrefix)) {
        pokemonMap.set(emoji.name.slice(pokemonPrefix.length), emoji.toString());
      } else if (emoji.name.startsWith(itemPrefix)) {
        itemMap.set(emoji.name.slice(itemPrefix.length), emoji.toString());
      } else if (emoji.name.startsWith(typePrefix)) {
        typeMap.set(emoji.name.slice(typePrefix.length), emoji.toString());
      } else if (emoji.name === UnknownEmojiName) {
        this.unknownEmoji = emoji.toString();
      }
    });

    this.pokemonEmojiMap = pokemonMap;
    this.itemEmojiMap = itemMap;
    this.typeEmojiMap = typeMap;
  }
}
