import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";

export class MovesCommand extends CommandBase {
  name = "moves";
  description = "Lists the most used moves of a given Pokémon";
  aliases = [ 'm', 'move', 'ataques' ];

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    this.processMoveSetCommand(message, args, (moveset) => moveset.moves);
  }
}
