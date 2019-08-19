import { SmogonStats } from './smogon/smogonStats';
import { PokemonDb } from './pokemon/pokemonDb';

export class AppDataSource {
  public smogonStats = new SmogonStats();
  public pokemonDb = new PokemonDb();
}