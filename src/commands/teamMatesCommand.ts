import { CommandBase } from "./command";
import { AppDataSource } from "../appDataSource";

export class TeamMatesCommand extends CommandBase {
  name = "team-mates";
  description = "Lists the Pokémon most used as team mate of a given Pokémon";
  aliases = [ 'tm', 'team-mate', 'mates', 'time', 'team' ];

  constructor(dataSource: AppDataSource) {
    super(dataSource);
  }
  
  execute(message: any, args: any) {
    this.processMoveSetCommand(message, args, (moveset) => moveset.teamMates);
  }
}
