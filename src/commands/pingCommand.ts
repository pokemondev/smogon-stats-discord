import { Command } from "./command";
import { AppDataSource } from "../appDataSource";

export class PingCommand implements Command {
  name = 'ping';
  description = "Ping!";
  aliases = [];
  
  private appDataSource: AppDataSource;

  constructor(appDataSource: AppDataSource) {
    this.appDataSource = appDataSource;
  }
  
  public execute(message: any, args: any) {
    message.channel.send('Pong.');
  }
}
