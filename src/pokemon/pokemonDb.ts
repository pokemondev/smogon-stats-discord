import { Pokemon } from "./models";
import { FileHelper } from "../common/fileHelper";

export class PokemonDb {

  private database: Pokemon[] = [];

  constructor() {
    this.database = this.loadFileData();
  }

  public getPokemon(name: string): Pokemon {
    return this.database.find(e => e.name.toLowerCase() == name.toLowerCase());
  }

  private loadFileData(): Pokemon[] {
    const data = FileHelper.loadFileData<Pokemon[]>("pokemon-db.json");
    return data;
  }
}