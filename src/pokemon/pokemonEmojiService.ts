import { Client } from 'discord.js';
import { PokemonEmoji } from './pokemonEmoji';

export class PokemonEmojiService {
  private static readonly MissRefreshCooldownInMilliseconds = 5_000;

  private client?: Client;
  private emojiKeyMap = new Map<string, string>();
  private refreshPromise?: Promise<void>;
  private lastRefreshAt = 0;

  public async initialize(client: Client): Promise<void> {
    this.client = client;
    await this.refresh();
  }

  public async refresh(): Promise<void> {
    if (!this.client?.application) {
      return;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.loadEmojis().finally(() => {
      this.refreshPromise = undefined;
    });

    return this.refreshPromise;
  }

  public getLoadedEmojiCount(): number {
    return this.emojiKeyMap.size;
  }

  public async formatPokemonDisplayName(name: string): Promise<string> {
    var emoji = await this.ensureEmojiIsLoaded(name);
    return emoji ? `${emoji} ${name}` : name;
  }

  public async ensureEmojiIsLoaded(name: string): Promise<string | undefined> {
    const emojiKey = PokemonEmoji.toEmojiKey(name);
    const emoji = this.emojiKeyMap.get(emojiKey);
    if (emoji)
      return emoji;

    if (!this.client?.application)
      return undefined;

    const elapsedSinceLastRefresh = Date.now() - this.lastRefreshAt;
    if (elapsedSinceLastRefresh < PokemonEmojiService.MissRefreshCooldownInMilliseconds)
      return undefined;

    await this.refresh();
    const refreshedEmoji = this.emojiKeyMap.get(emojiKey);
    if (refreshedEmoji)
      return refreshedEmoji;

    return undefined;
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
    this.lastRefreshAt = Date.now();
  }
}