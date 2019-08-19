import fs = require("fs");
import { Pokemon } from "./models";

export class PokemonDb {

  private database: Pokemon[] = [];

  constructor() {
    this.database = this.loadFileData();
  }

  public getPokemon(name: string): Pokemon {
    return this.database.find(e => e.name.toLowerCase() == name.toLowerCase());
  }

  private loadFileData(): Pokemon[] {
    const rawdata = fs.readFileSync(`data/pokemon-db.json`).toString();
    const data:Pokemon[] = JSON.parse(rawdata);
    return data;
  }
}