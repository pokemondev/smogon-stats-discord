import assert = require('assert');
import { AppDataSource } from '../appDataSource';
import { ConfigHelper } from '../config/configHelper';
import { MoveSetUsage } from '../models/smogonUsage';

process.env.BOT_NAME = process.env.BOT_NAME || 'Smogon Stats';
process.env.TOKEN = process.env.TOKEN || 'test-token';
process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

const { PokemonCommand } = require('./pokemonCommand') as typeof import('./pokemonCommand');

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

type InteractionCall = {
  name: 'reply' | 'deferReply' | 'editReply' | 'followUp';
  payload?: unknown;
};

class FakeChatInputCommandInteraction {
  public readonly commandName = 'pokemon';
  public readonly user = { tag: 'test-user' };
  public readonly createdTimestamp = Date.now();
  public deferred = false;
  public replied = false;
  public readonly calls: InteractionCall[] = [];

  constructor(
    private readonly subcommand: string,
    private readonly strings: Record<string, string | undefined>
  ) {
  }

  public readonly options = {
    getSubcommand: (_required?: boolean) => this.subcommand,
    getString: (name: string, required?: boolean) => {
      const value = this.strings[name];
      if ((value === undefined || value === null) && required) {
        throw new Error(`Missing required option '${name}'.`);
      }

      return value ?? null;
    },
  };

  public async reply(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'reply', payload });
    this.replied = true;
  }

  public async deferReply(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'deferReply', payload });
    this.deferred = true;
  }

  public async editReply(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'editReply', payload });
  }

  public async followUp(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'followUp', payload });
  }
}

const dataSource = new AppDataSource(ConfigHelper.loadAndValidate({ loadEnvironment: false }));

function createInteraction(subcommand: string, strings: Record<string, string | undefined>): FakeChatInputCommandInteraction {
  return new FakeChatInputCommandInteraction(subcommand, strings);
}

function createEmptyMoveSet(pokemonName: string): MoveSetUsage {
  return {
    name: pokemonName,
    abilities: [],
    items: [],
    spreads: [],
    moves: [],
    teraTypes: [],
    teamMates: [],
    checksAndCounters: [],
  };
}

function getEditReplyPayload(interaction: FakeChatInputCommandInteraction): { content?: string; embeds: Array<{ toJSON?: () => any }> } {
  const editReplyCall = interaction.calls.find(call => call.name === 'editReply');
  assert.ok(editReplyCall, 'Expected an editReply call.');
  return editReplyCall?.payload as { content?: string; embeds: Array<{ toJSON?: () => any }> };
}

function getEditReplyEmbed(interaction: FakeChatInputCommandInteraction): any {
  const payload = getEditReplyPayload(interaction);
  const embed = payload.embeds[0];
  return embed.toJSON ? embed.toJSON() : embed;
}

const tests: TestCase[] = [
  {
    name: 'sets defers before editing successful responses',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('sets', {
        name: 'incineroar',
        generation: '9',
        meta: 'ou',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
    }
  },
  {
    name: 'sets replies immediately for invalid pokemon names',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('sets', {
        name: 'missingno',
        generation: '9',
        meta: 'ou',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'reply' ]);
      assert.strictEqual(interaction.deferred, false);
    }
  },
  {
    name: 'info defers before editing successful responses',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('info', {
        name: 'incineroar',
        category: 'items',
        generation: '9',
        meta: 'ou',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: createEmptyMoveSet(query.pokemon.name),
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
    }
  },
  {
    name: 'summary defers before editing successful responses',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('summary', {
        name: 'incineroar',
        generation: '9',
        meta: 'ou',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: createEmptyMoveSet(query.pokemon.name),
      });
      (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
    }
  },
  {
    name: 'summary shows Team Mates for VGC using moves-style formatting and top 4 only',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('summary', {
        name: 'incineroar',
        generation: '9',
        meta: 'vgc2026regi',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: {
          ...createEmptyMoveSet(query.pokemon.name),
          teamMates: [
            { name: 'Miraidon', percentage: 42.345 },
            { name: 'Calyrex-Shadow', percentage: 37.1 },
            { name: 'Urshifu-Rapid-Strike', percentage: 25.555 },
            { name: 'Amoonguss', percentage: 19.999 },
            { name: 'Farigiraf', percentage: 10.5 },
          ],
          checksAndCounters: [
            { name: 'Landorus-Therian', percentage: 0, kOed: 55.1, switchedOut: 24.8 },
          ],
        },
      });
      (command as any).getGeneralInfoData = async () => 'Meta: `VGC 2026 Reg. I`';

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);

      const embed = getEditReplyEmbed(interaction);
      const teamMatesField = embed.fields.find((field: { name: string; value: string }) => field.name === 'Team Mates');

      assert.ok(teamMatesField, 'Expected Team Mates field for VGC summary.');
      assert.strictEqual(embed.fields.some((field: { name: string }) => field.name === 'Counters & Checks'), false);
      assert.strictEqual(teamMatesField.value, [
        'Miraidon: `42.34%`',
        'Calyrex-Shadow: `37.10%`',
        'Urshifu-Rapid-Strike: `25.55%`',
        'Amoonguss: `20.00%`',
      ].join('\n'));
      assert.strictEqual(teamMatesField.value.includes('Farigiraf'), false);
    }
  },
  {
    name: 'summary keeps Counters & Checks for non-VGC formats',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('summary', {
        name: 'incineroar',
        generation: '9',
        meta: 'ou',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: {
          ...createEmptyMoveSet(query.pokemon.name),
          teamMates: [
            { name: 'Rillaboom', percentage: 18.75 },
          ],
          checksAndCounters: [
            { name: 'Great Tusk', percentage: 0, kOed: 51.2, switchedOut: 33.4 },
          ],
        },
      });
      (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

      await command.execute(interaction as never);

      const embed = getEditReplyEmbed(interaction);
      const countersField = embed.fields.find((field: { name: string; value: string }) => field.name === 'Counters & Checks');

      assert.ok(countersField, 'Expected Counters & Checks field for non-VGC summary.');
      assert.strictEqual(embed.fields.some((field: { name: string }) => field.name === 'Team Mates'), false);
      assert.strictEqual(countersField.value, '`Great Tusk: KO 51.2% / SW 33.4%`');
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