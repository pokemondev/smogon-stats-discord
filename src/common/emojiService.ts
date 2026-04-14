import { Client } from 'discord.js';
import { PokemonEmoji } from '../pokemon/pokemonEmoji';
import { ItemEmoji } from '../pokemon/itemEmoji';

export class EmojiService {
  private client?: Client;
  private pokemonEmojiMap = new Map<string, string>();
  private itemEmojiMap = new Map<string, string>();

  public async initialize(client: Client): Promise<void> {
    this.client = client;
    await this.loadEmojis();
  }

  public getLoadedEmojiCount(): number {
    return this.pokemonEmojiMap.size + this.itemEmojiMap.size;
  }

  public getPokemonEmoji(pokemonName: string): string | undefined {
    const emojiKey = PokemonEmoji.toEmojiKey(pokemonName);
    return this.pokemonEmojiMap.get(emojiKey);
  }

  public getItemEmoji(itemName: string): string | undefined {
    const emojiKey = ItemEmoji.toEmojiKey(itemName);
    return this.itemEmojiMap.get(emojiKey);
  }

  private async loadEmojis(): Promise<void> {
    const emojis = await this.client!.application!.emojis.fetch();
    const pokemonMap = new Map<string, string>();
    const itemMap = new Map<string, string>();
    const pokemonPrefix = `${PokemonEmoji.Prefix}_`;
    const itemPrefix = `${ItemEmoji.Prefix}_`;

    emojis.forEach(emoji => {
      if (!emoji.name) {
        return;
      }

      if (emoji.name.startsWith(pokemonPrefix)) {
        pokemonMap.set(emoji.name.slice(pokemonPrefix.length), emoji.toString());
      } else if (emoji.name.startsWith(itemPrefix)) {
        itemMap.set(emoji.name.slice(itemPrefix.length), emoji.toString());
      }
    });

    this.pokemonEmojiMap = pokemonMap;
    this.itemEmojiMap = itemMap;
  }
}
