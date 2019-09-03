import { Command } from "./command";
import { AppDataSource } from "../appDataSource";

export class ServerCommand implements Command {
  name = 'server';
  description = "Server data!";
  aliases = [];
  
  private appDataSource: AppDataSource;

  constructor(appDataSource: AppDataSource) {
    this.appDataSource = appDataSource;
  }
  
  public execute(message: any, args: any) {
    message.channel.send(`Server name: ${message.guild.name}\nTotal members: ${message.guild.memberCount}`);
  }
}
