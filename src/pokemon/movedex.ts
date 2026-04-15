import FuzzyMatching = require('fuzzy-matching');
import { MoveInfo } from "../models/moves";
import { FileHelper } from "../common/fileHelper";

export class Movedex {

  private moveMap: { [name: string]: MoveInfo } = {};
  private database: MoveInfo[] = [];
  private fuzzyMatching: FuzzyMatching;

  constructor() {
    this.loadFileData();
    this.fuzzyMatching = new FuzzyMatching(this.database.map(m => m.name));
  }

  public getMove(name: string): MoveInfo | undefined {
    const move = this.moveMap[name.toLowerCase()];
    if (move)
      return move;

    const match = this.fuzzyMatching.get(name);
    return (match.distance >= 0.5)
      ? this.moveMap[match.value.toLowerCase()]
      : undefined;
  }

  private loadFileData(): void {
    this.database = FileHelper.loadFileData<MoveInfo[]>("movedex.json");
    this.database.forEach(m => {
      this.moveMap[m.name.toLowerCase()] = m;
    });
  }
}
