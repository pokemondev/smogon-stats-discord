import fs = require("fs");
import { PokemonUsage, MoveSetUsage, SmogonFormat } from "./models";
import { FormatHelper } from "./helpers";

type DbData = { [id: string] : any[]; }

export class SmogonStats {
  
  private database: { [id: string] : DbData; } = {};
  
  constructor() {
  }
  
  public getLeads(format: SmogonFormat): PokemonUsage[] {
    const statsType = 'leads';
    this.loadData2(statsType, format, (data) => {
      return data.data.rows
        .sort((a, b) => (a[4] - b[4]) * -1) // reverse
        .slice(0, 10)
        .map(mon => { return { name: mon[1], usageRaw: mon[4] } as PokemonUsage});
    });

    const fmt = FormatHelper.toString(format);
    return this.database[statsType][fmt];
  }

  public getUsage(format = 'gen7ou', top10: boolean = false): PokemonUsage[] {
    const statsType = 'usage';
    this.loadData(statsType, format, (data) => {
      return data.data.rows
        .sort((a, b) => (a[6] - b[6]) * -1) // reverse        
        .map(mon => { return { name: mon[1], usageRaw: mon[6] } as PokemonUsage});
    });

    return top10
      ? this.database[statsType][format].slice(0, 10)
      : this.database[statsType][format]
  }

  public getMoveSets(format = 'gen7ou', 
                     filter: (pkm: MoveSetUsage) => boolean = undefined): MoveSetUsage[] {
    const statsType = 'moveset';
    this.loadData(statsType, format);

    const sets = this.database[statsType][format] as MoveSetUsage[];
    return filter
      ? sets.filter(filter)
      : sets;
  }

  public getMoveSet(pokemon: string, format = 'gen7ou'): MoveSetUsage {
    const sets = this.getMoveSets(format);
    return sets.find(e => e.name.toLowerCase() == pokemon.toLowerCase());
  }

  public getMegasMoveSets(format = 'gen7ou'): MoveSetUsage[] {
    const sets = this.getMoveSets(
      format,
      (e) => e.items.some(i => e.name.endsWith("-Mega") && i.name.endsWith('ite'))
    ).slice(0, 10);

    const usage = this.getUsage(format, false)
                      .filter(e => sets.some(s => s.name == e.name));
    sets.forEach(set => {
      set.usage = usage.find(e=> e.name == set.name).usageRaw
    })
    return sets
      .sort((a, b) => (a.usage - b.usage) * -1) // reverse        
      .slice(0, 10);
  }

  private loadData(statsType, format = '', callback: (data: any) => any = undefined): void {
    if (!this.database[statsType]) {
      console.log('loading ' + statsType)
      let fileData = this.loadFileData(statsType, format);
      
      if (callback)
        fileData = callback(fileData);
      
      const data = {} as DbData;
      data[format] = fileData;
      this.database[statsType] = data;
    }
  }

  private loadData2(statsType, format: SmogonFormat, callback: (data: any) => any = undefined): void {
    const fmt = FormatHelper.toString(format);
    const dataLoaded = this.database[statsType] && this.database[statsType][fmt];
    if (!dataLoaded) {
      console.log('loading ' + statsType)
      let fileData = this.loadFileData2(statsType, format);
      
      if (callback)
        fileData = callback(fileData);
      
      const data = this.database[statsType] || {} as DbData;
      data[fmt] = fileData;
      this.database[statsType] = data;
    }
  }

  private loadFileData(statsType, format = '') {
    const rawdata = fs.readFileSync(`data/smogon-stats/gen7/ou/${statsType}-${format}.json`).toString();
    return JSON.parse(rawdata);
  }

  private loadFileData2(statsType, format: SmogonFormat) {
    const filename = `${statsType}-${FormatHelper.toString(format)}`;
    const rawdata = fs.readFileSync(`data/smogon-stats/${format.generation}/${format.tier}/${filename}.json`).toString();
    return JSON.parse(rawdata);
  }
}