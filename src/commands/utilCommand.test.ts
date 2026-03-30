import assert = require('assert');
import { MessageFlags } from 'discord.js';
import { UtilCommand } from './utilCommand';

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

type InteractionCall = {
  name: 'reply';
  payload?: unknown;
};

class FakeChatInputCommandInteraction {
  public readonly guild = { name: 'Test Guild', memberCount: 42 };
  public readonly client = { ws: { ping: 123 } };
  public readonly calls: InteractionCall[] = [];

  constructor(
    private readonly subcommand: string,
    public readonly guildId?: string,
  ) {
  }

  public readonly options = {
    getSubcommand: (_required?: boolean) => this.subcommand,
  };

  public inGuild(): boolean {
    return !!this.guildId;
  }

  public async reply(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'reply', payload });
  }
}

const tests: TestCase[] = [
  {
    name: 'stats replies with the analytics summary for the current guild',
    run: async () => {
      const command = new UtilCommand({
        analytics: {
          getSummary: (guildId?: string) => `summary for ${guildId ?? 'global'}`,
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction('stats', 'guild-123');

      await command.execute(interaction as never);

      const replyPayload = interaction.calls[0].payload as { content: string; flags: number };
      assert.strictEqual(replyPayload.content, 'summary for guild-123');
      assert.strictEqual(replyPayload.flags, MessageFlags.Ephemeral);
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