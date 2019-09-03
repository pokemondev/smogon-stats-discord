import FuzzyMatching = require('fuzzy-matching');
import { Pokemon } from "./models";
import { FileHelper } from "../common/fileHelper";

export class PokemonDb {

  private pokemonMap: { [name: string]: Pokemon } = {};
  private database: Pokemon[] = [];
  private fuzzyMatching: FuzzyMatching;

  constructor() {
    this.loadFileData();
    this.fuzzyMatching = new FuzzyMatching(this.database.map(p => p.name));
  }

  public getPokemon(name: string): Pokemon {
    const pokemon = this.pokemonMap[name.toLowerCase()];
    if (pokemon)
      return pokemon;

    const match = this.fuzzyMatching.get(name);
    return (match.distance >= 0.5)
      ? this.pokemonMap[match.value.toLowerCase()]
      : undefined;
  }

  private loadFileData(): void {
    this.database = FileHelper.loadFileData<Pokemon[]>("pokemon-db.json");
    this.database.forEach(i => {
      this.pokemonMap[i.name.toLowerCase()] = i;
    })
  }
}