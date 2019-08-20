import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";

export class ItemsCommand extends CommandBase {
  name = "items";
  description = "Lists the most used items of a given the Pokémon";
  aliases = [ 'i', 'item', 'itens' ];

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    this.processMoveSetCommand(message, args, (moveset) => moveset.items);
  }
}
