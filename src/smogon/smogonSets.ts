import { PokemonDb } from "../pokemon/pokemonDb";
import { FileHelper } from "../common/fileHelper";
import { PokemonSet } from "./setsModels";
import { Pokemon } from "../pokemon/models";
import { getMap, areEquals } from "../common/objectHelper";
import { FormatHelper } from "./formatHelper";
import { SmogonFormat } from "./usageModels";

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
    if (!this.setsDb.has(gen))
      return [];

    const sets = this.setsDb.get(gen).get(pokemon.name);
    return sets
      ? sets.filter(set => areEquals(set.format, format))
      : [];
  }

  private loadFileData(): void {
    const gens = [ "gen8", "gen7", "gen6" ];
    gens.forEach(gen => {
      const genSetMap: PokemonSetMap = new Map;
      const setsData = FileHelper.loadFileDataAsAny(`smogon-sets/${gen}-sets.json`);
      console.log(`Loaded ${gen} sets containing ${Object.keys(setsData).length} mons`);

      Object.keys(setsData).forEach(pokemon => {
        var pokemonSets = getMap<PokemonSet>(setsData[pokemon]);

        // remove not supported sets from memory
        for (const setName of pokemonSets.keys()) {
          const setTier = setName.split(" ")[0].toLowerCase();
          const isSupported = FormatHelper.Tiers.some(tier => setTier == tier);

          if (!isSupported) {
            pokemonSets.delete(setName);
            continue;
          }

          const set = pokemonSets.get(setName);
          set.name = setName;
          set.format = { tier: setTier, generation: gen };
        }

        genSetMap.set(pokemon, Array.from(pokemonSets.values()));
      });

      // add gen to sets db
      this.setsDb.set(gen, genSetMap);
    });
  }
}