import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";

export class AbilitiesCommand extends CommandBase {
  name = "abilities";
  description = "Lists the most used abilities of a given Pokémon";
  aliases = [ 'a', 'ability' ];

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    this.processMoveSetCommand(message, args, (moveset) => moveset.abilities);
  }
}
