import fs = require("fs");
import { PokemonUsage, MoveSetUsage } from "./types";

type DbData = { [id: string] : any[]; }

export class SmogonStats {
  
  private database: { [id: string] : DbData; } = {};
  
  constructor() {
  }
  
  public getLeads(format = 'gen7ou'): PokemonUsage[] {
    const statsType = 'leads';
    this.loadData(statsType, format, (data) => {
      return data.data.rows
        .sort((a, b) => (a[4] - b[4]) * -1) // reverse
        .slice(0, 10)
        .map(mon => { return { name: mon[1], usageRaw: mon[4] } as PokemonUsage});
    });

    return this.database[statsType][format];
  }

  public getUsage(format = 'gen7ou'): PokemonUsage[] {
    const statsType = 'usage';
    this.loadData(statsType, format, (data) => {
      return data.data.rows
        .sort((a, b) => (a[6] - b[6]) * -1) // reverse
        .slice(0, 10)
        .map(mon => { return { name: mon[1], usageRaw: mon[6] } as PokemonUsage});
    });

    return this.database[statsType][format];
  }

  public getMoveSet(pokemon: string, format = 'gen7ou'): MoveSetUsage {
    const statsType = 'moveset';
    this.loadData(statsType, format);

    const sets = this.database[statsType][format] as MoveSetUsage[];
    return sets.find(e => e.name.toLowerCase() == pokemon.toLowerCase());
  }

  private loadData(statsType, format = '', callback: (data: any) => any = undefined): void {
    if (!this.database[statsType]) {
      console.log('loading ' + statsType)
      let fileData = this.loadFileData(statsType, format);
      
      if (callback)
        fileData = callback(fileData);
      
      //const data = ({}[format] = fileData) as DbData;
      const data = {} as DbData;
      data[format] = fileData;
      this.database[statsType] = data;
    }
  }

  private loadFileData(statsType, format = '') {
    const rawdata = fs.readFileSync(`data/smogon-stats/${statsType}-${format}.json`).toString();
    return JSON.parse(rawdata);
  }
}