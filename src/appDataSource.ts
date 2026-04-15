import { SmogonStats } from './smogon/smogonStats';
import { PokemonDb } from './pokemon/pokemonDb';
import { Movedex } from './pokemon/movedex';
import { SmogonSets } from './smogon/smogonSets';
import { AnalyticsService } from './common/analyticsService';
import { BotConfig } from './config/configHelper';
import { VgcTeams } from './vgc/vgcTeams';
import { EmojiService } from './emoji/emojiService';

export class AppDataSource {
  public readonly smogonStats = new SmogonStats();
  public readonly pokemonDb = new PokemonDb();
  public readonly movedex = new Movedex();
  public readonly smogonSets = new SmogonSets(this.pokemonDb);
  public readonly vgcTeams = new VgcTeams(this.pokemonDb);
  public readonly emojiService = new EmojiService();
  public readonly analytics: AnalyticsService;

  constructor(botConfig: BotConfig) {
    this.analytics = new AnalyticsService(this.pokemonDb, {
      flushEvery: botConfig.analytics.flushEvery,
    });
  }
}