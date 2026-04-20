import { SmogonStats } from './smogon/smogonStats';
import { PokemonDb } from './pokemon/pokemonDb';
import { Movedex } from './pokemon/movedex';
import { SmogonSets } from './smogon/smogonSets';
import { AnalyticsService } from './common/analyticsService';
import { BotConfig } from './config/configHelper';
import { VgcTeams } from './vgc/vgcTeams';
import { EmojiService } from './emoji/emojiService';
import { BattlingService } from './pokemon/battlingService';
import { FormatStats } from './smogon/formatStats';

export class AppDataSource {
  public readonly smogonStats = new SmogonStats();
  public readonly pokemonDb = new PokemonDb();
  public readonly movedex = new Movedex();
  public readonly formatStats = new FormatStats(this.smogonStats, this.pokemonDb);
  public readonly battlingService = new BattlingService(this.pokemonDb, this.movedex, this.formatStats);
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