import { config } from 'dotenv';
import { REST, Routes } from 'discord.js';
import { createCommandData } from './commands';

config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const developmentGuildId = process.env.DEV_GUILD_ID;

if (!token) {
  throw new Error('TOKEN environment variable is required to register commands.');
}

if (!clientId) {
  throw new Error('CLIENT_ID environment variable is required to register commands.');
}

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token as string);
  const body = createCommandData().map(command => command.toJSON());

  if (developmentGuildId) {
    console.log(`Registering ${body.length} guild command(s) for guild ${developmentGuildId}.`);
    await rest.put(Routes.applicationGuildCommands(clientId as string, developmentGuildId), { body });
    console.log('Guild commands registered successfully.');
    return;
  }

  console.log(`Registering ${body.length} global command(s).`);
  await rest.put(Routes.applicationCommands(clientId as string), { body });
  console.log('Global commands registered successfully.');
}

registerCommands().catch(error => {
  console.error('Failed to register commands.', error);
  process.exitCode = 1;
});