import FuzzyMatching = require('fuzzy-matching');
import { Pokemon } from "../models/pokemon";
import { FileHelper } from "../common/fileHelper";

export class PokemonDb {

  private pokemonMap: { [name: string]: Pokemon } = {};
  private abilityMap: { [name: string]: string } = {};
  private database: Pokemon[] = [];
  private fuzzyMatching: FuzzyMatching;
  private abilityFuzzyMatching: FuzzyMatching;

  constructor() {
    this.loadFileData();
    this.fuzzyMatching = new FuzzyMatching(this.database.map(p => p.name));
    this.abilityFuzzyMatching = new FuzzyMatching(Object.values(this.abilityMap));
  }

  public getPokemon(name: string): Pokemon | undefined {
    const pokemon = this.pokemonMap[name.toLowerCase()];
    if (pokemon)
      return pokemon;

    const match = this.fuzzyMatching.get(name);
    return (match.distance >= 0.5)
      ? this.pokemonMap[match.value.toLowerCase()]
      : undefined;
  }

  public getAbility(name: string): string | undefined {
    const normalizedName = name.trim().toLowerCase();
    const ability = this.abilityMap[normalizedName];
    if (ability)
      return ability;

    const match = this.abilityFuzzyMatching.get(name.trim());
    return (match.distance >= 0.5)
      ? this.abilityMap[match.value.toLowerCase()]
      : undefined;
  }

  private loadFileData(): void {
    this.database = FileHelper.loadFileData<Pokemon[]>("pokemon-db.json");
    this.database.forEach(i => {
      this.pokemonMap[i.name.toLowerCase()] = i;
      i.possiblesAbilities
        .filter((ability): ability is string => !!ability)
        .forEach(ability => {
          const abilityKey = ability.toLowerCase();
          if (!this.abilityMap[abilityKey]) {
            this.abilityMap[abilityKey] = ability;
          }
        });
    })
  }
}