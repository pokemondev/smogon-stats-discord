import { SmogonStats } from './smogon/smogonStats';
import { PokemonDb } from './pokemon/pokemonDb';
import { SmogonSets } from './smogon/smogonSets';

export class AppDataSource {
  public readonly smogonStats = new SmogonStats();
  public readonly pokemonDb = new PokemonDb();
  public readonly smogonSets = new SmogonSets(this.pokemonDb);
}