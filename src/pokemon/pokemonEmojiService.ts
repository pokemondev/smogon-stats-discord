import { Client } from 'discord.js';
import { PokemonEmoji } from './pokemonEmoji';

export class PokemonEmojiService {
  private client?: Client;
  private emojiKeyMap = new Map<string, string>();

  public async initialize(client: Client): Promise<void> {
    this.client = client;
    await this.loadEmojis();
  }

  public getLoadedEmojiCount(): number {
    return this.emojiKeyMap.size;
  }

  public formatPokemonDisplayName(name: string): string {
    const emojiKey = PokemonEmoji.toEmojiKey(name);
    const emoji = this.emojiKeyMap.get(emojiKey);
    return emoji ? `${emoji} ${name}` : name;
  }

  private async loadEmojis(): Promise<void> {
    const emojis = await this.client!.application!.emojis.fetch();
    const nextEmojiDisplayByKey = new Map<string, string>();
    const prefix = `${PokemonEmoji.Prefix}_`;

    emojis.forEach(emoji => {
      if (!emoji.name || !emoji.name.startsWith(prefix)) {
        return;
      }

      const emojiKey = emoji.name.slice(prefix.length);
      nextEmojiDisplayByKey.set(emojiKey, emoji.toString());
    });

    this.emojiKeyMap = nextEmojiDisplayByKey;
  }
}