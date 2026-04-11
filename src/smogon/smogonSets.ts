import { PokemonDb } from "../pokemon/pokemonDb";
import { FileHelper } from "../common/fileHelper";
import { PokemonSet } from "../models/smogonSets";
import { Pokemon } from "../models/pokemon";
import { getMap, areEquals } from "../common/objectHelper";
import { FormatHelper } from "./formatHelper";
import { SmogonFormat } from "../models/smogonUsage";

type PokemonSetMap = Map<string, PokemonSet[]>;
type PokemonSetDb = Map<string, PokemonSetMap>;

export class SmogonSets {

  private pokemonDb: PokemonDb;
  private setsDb: PokemonSetDb = new Map;

  constructor(pokemonDb: PokemonDb) {
    this.pokemonDb = pokemonDb;
    this.loadFileData();
  }

  public get(pokemon: Pokemon, format: SmogonFormat): PokemonSet[] {
    const gen = format.generation;
    const genSets = this.setsDb.get(gen);

    if (!genSets)
      return [];

    const sets = genSets.get(pokemon.name);
    return sets
      ? sets.filter(set => areEquals(set.format, format))
      : [];
  }

  private loadFileData(): void {
    const gens = [ "gen9", "gen8", "gen7", "gen6" ];
    gens.forEach(gen => {
      const genSetMap: PokemonSetMap = new Map;
      const setsData = FileHelper.loadFileDataAsAny(`smogon-sets/${gen}-sets.json`);
      console.log(`Loaded ${gen} sets containing ${Object.keys(setsData).length} mons`);

      Object.keys(setsData).forEach(pokemon => {
        var pokemonSets = getMap<PokemonSet>(setsData[pokemon]);

        // remove not supported sets from memory
        for (const setName of pokemonSets.keys()) {
          const setMeta = FormatHelper.tryResolveSupportedSetMeta(gen, setName);
          if (!setMeta) {
            pokemonSets.delete(setName);
            continue;
          }

          const set = pokemonSets.get(setName);
          if (set) {
            set.name = setName;
            set.format = { meta: setMeta, generation: gen };
          }
        }

        genSetMap.set(pokemon, Array.from(pokemonSets.values()));
      });

      // add gen to sets db
      this.setsDb.set(gen, genSetMap);
    });
  }
}