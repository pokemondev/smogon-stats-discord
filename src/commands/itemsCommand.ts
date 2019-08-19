import { Command, CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";
import { ColorHelper } from '../pokemon/helpers';

export class ItemsCommand extends CommandBase {
  name = "items";
  description = "Lists the most used items of a given the Pokémon";

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    this.processMoveSetCommand(message, args, (moveset) => moveset.items);
  }
}
