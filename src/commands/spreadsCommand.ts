import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";

export class SpreadsCommand extends CommandBase {
  name = "spreads";
  description = "Lists the most used spread setup of a given Pokémon";
  aliases = [ 'iv', 'ivs', 'spread' ];

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    this.processMoveSetCommand(message, args, (moveset) => moveset.spreads);
  }
}
