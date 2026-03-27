import { REST, Routes } from 'discord.js';
import { createCommandData } from './commands';
import { ConfigHelper } from './config/configValidator';

const { client: clientConfig } = ConfigHelper.loadAndValidate({ requireClientId: true });
const token = clientConfig.token;
const clientId = clientConfig.clientId;
const developmentGuildId = clientConfig.developmentGuildId;

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