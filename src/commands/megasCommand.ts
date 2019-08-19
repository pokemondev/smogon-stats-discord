import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";

export class MegasCommand extends CommandBase {
  name = "megas";
  description = "Lists the 10 most common Mega Stone users";

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    this.processFilterBasedCommand(message, args, (moveset) => moveset.moves);
  }
}
