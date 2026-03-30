import assert = require('assert');
import { AppDataSource } from '../appDataSource';
import { createCommands } from './commandIndex';
import { ConfigHelper } from '../config/configHelper';

process.env.BOT_NAME = process.env.BOT_NAME || 'Smogon Stats';
process.env.TOKEN = process.env.TOKEN || 'test-token';
process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

class FakeHelpInteraction {
  public readonly calls: Array<{ payload?: unknown }> = [];

  constructor(private readonly command?: string) {
  }

  public readonly options = {
    getString: (name: string) => name === 'command'
      ? this.command ?? null
      : null,
  };

  public async reply(payload?: unknown): Promise<void> {
    this.calls.push({ payload });
  }
}

const config = ConfigHelper.loadAndValidate({ loadEnvironment: false });
const commands = createCommands(new AppDataSource(config), config);
const helpCommand = commands.find(command => command.data.name === 'help');

const tests: TestCase[] = [
  {
    name: 'help command choices do not expose util',
    run: async () => {
      const helpData = helpCommand.data.toJSON();
      const commandOption = helpData.options?.find(option => option.name === 'command') as { choices?: Array<{ value: string }> } | undefined;
      const choices = commandOption?.choices?.map(choice => choice.value) ?? [];

      assert.strictEqual(choices.includes('util'), false);
    }
  },
  {
    name: 'help overview does not mention util commands',
    run: async () => {
      const interaction = new FakeHelpInteraction();

      await helpCommand.execute(interaction as never);

      const replyPayload = interaction.calls[0].payload as { embeds: Array<{ toJSON?: () => any }> };
      const embed = replyPayload.embeds[0].toJSON ? replyPayload.embeds[0].toJSON() : replyPayload.embeds[0];
      const fieldNames = (embed.fields ?? []).map((field: { name: string }) => field.name);

      assert.strictEqual(embed.description.indexOf('/util') >= 0, false);
      assert.strictEqual(fieldNames.includes('/util'), false);
    }
  }
];

async function run(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`PASS ${test.name}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});