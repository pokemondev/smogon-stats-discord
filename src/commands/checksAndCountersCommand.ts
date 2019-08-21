import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";

export class SpreadsCommand extends CommandBase {
  name = "checks-counters";
  description = "Lists the most used checks and counters for a given Pokémon";
  aliases = [ 'cc', 'checks', 'counters' ];

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    this.processMoveSetCommand(message, args, (moveset) => moveset.checksAndCounters);
  }
}
