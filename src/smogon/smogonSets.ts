import { PokemonDb } from "../pokemon/PokemonDb";
import { FileHelper } from "../common/fileHelper";
import { PokemonSet } from "./setsModels";
import { Pokemon } from "../pokemon/models";
import { getMap, areEquals } from "../common/objectHelper";
import { FormatHelper } from "./helpers";
import { SmogonFormat } from "./usageModels";

type PokemonSetDb = Map<string, PokemonSet[]>;

export class SmogonSets {

  private pokemonDb: PokemonDb;
  private setsDb: PokemonSetDb = new Map;

  constructor(pokemonDb: PokemonDb) {
    this.pokemonDb = pokemonDb;
    this.loadFileData();
  }

  public get(pokemon: Pokemon, format: SmogonFormat): PokemonSet[] {
    return this.setsDb.get(pokemon.name)
                      .filter(set => areEquals(set.format, format));
  }

  private loadFileData(): void {
    const db = FileHelper.loadFileDataAsAny("smogon-sets/gen8-sets.json");
    Object.keys(db).forEach(key => {
      var pokemonSets = getMap<PokemonSet>(db[key]);

      // remove not supported set from memory
      for (const setName of pokemonSets.keys()) {
        const setTier = setName.split(" ")[0].toLowerCase();
        const isSupported = FormatHelper.Tiers.some(tier => setTier == tier);

        if (!isSupported) {
          pokemonSets.delete(setName);
          continue;
        }

        const set = pokemonSets.get(setName);
        set.name = setName;
        set.format = { tier: setTier, generation: FormatHelper.getDefault().generation };
      }

      this.setsDb.set(key, Array.from(pokemonSets.values()));
    });
  }
}