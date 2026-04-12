import assert = require('assert');
import { AppDataSource } from '../appDataSource';
import { ConfigHelper } from '../config/configHelper';
import { Pokemon } from '../models/pokemon';
import { PokemonUsage } from '../models/smogonUsage';

process.env.BOT_NAME = process.env.BOT_NAME || 'Smogon Stats';
process.env.TOKEN = process.env.TOKEN || 'test-token';
process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

const { StatsCommand } = require('./statsCommand') as typeof import('./statsCommand');

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

type InteractionCall = {
  name: 'reply' | 'deferReply' | 'editReply' | 'followUp';
  payload?: unknown;
};

class FakeChatInputCommandInteraction {
  public readonly commandName = 'stats';
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

function createInteraction(strings: Record<string, string | undefined>): FakeChatInputCommandInteraction {
  return new FakeChatInputCommandInteraction('speed-tier', strings);
}

function createPokemon(name: string, speed: number): Pokemon {
  return {
    name,
    type1: 'Dragon' as never,
    type2: undefined as never,
    baseStats: {
      hp: 1,
      atk: 1,
      def: 1,
      spA: 1,
      spD: 1,
      spe: speed,
      tot: 6,
    },
    tier: 'OU',
    possiblesAbilities: [],
    evolutions: [],
    generation: 'gen9',
    isAltForm: false,
    weight: 1,
    height: 1,
  };
}

function createUsage(name: string, rank: number, usageRaw: number): PokemonUsage {
  return {
    name,
    rank,
    usageRaw,
    usagePercentage: usageRaw,
  };
}

function getEditReplyPayload(interaction: FakeChatInputCommandInteraction): { content?: string; embeds?: Array<{ toJSON(): { fields?: Array<{ name: string; value: string }> } }> } {
  const editReplyCall = interaction.calls.find(call => call.name === 'editReply');
  return (editReplyCall?.payload ?? {}) as { content?: string; embeds?: Array<{ toJSON(): { fields?: Array<{ name: string; value: string }> } }> };
}

function getEmbedFields(interaction: FakeChatInputCommandInteraction): Array<{ name: string; value: string }> {
  const payload = getEditReplyPayload(interaction);
  const embed = payload.embeds?.[0];
  return embed ? embed.toJSON().fields ?? [] : [];
}

function withStubbedStatsData(
  usages: PokemonUsage[],
  pokemonByName: Record<string, Pokemon | undefined>,
  runTest: (command: InstanceType<typeof StatsCommand>) => Promise<void>
): Promise<void> {
  const originalGetUsages = dataSource.smogonStats.getUsages.bind(dataSource.smogonStats);
  const originalGetPokemon = dataSource.pokemonDb.getPokemon.bind(dataSource.pokemonDb);

  dataSource.smogonStats.getUsages = async () => usages;
  dataSource.pokemonDb.getPokemon = (name: string) => pokemonByName[name];

  const command = new StatsCommand(dataSource);

  return runTest(command).finally(() => {
    dataSource.smogonStats.getUsages = originalGetUsages;
    dataSource.pokemonDb.getPokemon = originalGetPokemon;
  });
}

const tests: TestCase[] = [
  {
    name: 'speed-tier defers before editing successful responses',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragapult', 4, 18.84), createUsage('Iron Bundle', 9, 10.12)],
        {
          Dragapult: createPokemon('Dragapult', 142),
          'Iron Bundle': createPokemon('Iron Bundle', 136),
        },
        async (command) => {
          const interaction = createInteraction({ generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
        }
      );
    }
  },
  {
    name: 'speed-tier defaults to faster ordering',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragapult', 4, 18.84), createUsage('Garchomp', 7, 12.31), createUsage('Shuckle', 40, 2.1)],
        {
          Dragapult: createPokemon('Dragapult', 142),
          Garchomp: createPokemon('Garchomp', 102),
          Shuckle: createPokemon('Shuckle', 5),
        },
        async (command) => {
          const interaction = createInteraction({ generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const fields = getEmbedFields(interaction);
          assert.strictEqual(fields[0].name, 'Speed 1º Dragapult');
          assert.strictEqual(fields[1].name, 'Speed 2º Garchomp');
          assert.strictEqual(fields[2].name, 'Speed 3º Shuckle');
        }
      );
    }
  },
  {
    name: 'speed-tier slower mode orders by lowest speed first',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragapult', 4, 18.84), createUsage('Garchomp', 7, 12.31), createUsage('Shuckle', 40, 2.1)],
        {
          Dragapult: createPokemon('Dragapult', 142),
          Garchomp: createPokemon('Garchomp', 102),
          Shuckle: createPokemon('Shuckle', 5),
        },
        async (command) => {
          const interaction = createInteraction({ generation: '9', meta: 'ou', mode: 'slower' });

          await command.execute(interaction as never);

          const fields = getEmbedFields(interaction);
          assert.strictEqual(fields[0].name, 'Speed 1º Shuckle');
          assert.strictEqual(fields[1].name, 'Speed 2º Garchomp');
          assert.strictEqual(fields[2].name, 'Speed 3º Dragapult');
        }
      );
    }
  },
  {
    name: 'speed-tier only uses the top 100 usage entries before sorting',
    run: async () => {
      const usages = Array.from({ length: 101 }, (_, index) => createUsage(`Mon${index + 1}`, index + 1, 100 - index));
      const pokemonByName = Object.fromEntries(usages.map((usage, index) => [usage.name, createPokemon(usage.name, 200 - index)]));
      pokemonByName.Mon101 = createPokemon('Mon101', 999);

      await withStubbedStatsData(
        usages,
        pokemonByName,
        async (command) => {
          const interaction = createInteraction({ generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const fields = getEmbedFields(interaction);
          assert.ok(fields.every(field => field.name.indexOf('Mon101') < 0));
          assert.strictEqual(fields[0].name, 'Speed 1º Mon1');
        }
      );
    }
  },
  {
    name: 'speed-tier shows speed and usage details in each field',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragapult', 4, 18.84)],
        {
          Dragapult: createPokemon('Dragapult', 142),
        },
        async (command) => {
          const interaction = createInteraction({ generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          const fields = getEmbedFields(interaction);
          assert.ok((payload.content ?? '').indexOf('filtered to top 100 usage') >= 0);
          assert.strictEqual(fields[0].value, 'Base Speed: 142\nUsage: #4 (18.84%)');
        }
      );
    }
  },
  {
    name: 'speed-tier reports no data when usage list is empty',
    run: async () => {
      await withStubbedStatsData(
        [],
        {},
        async (command) => {
          const interaction = createInteraction({ generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
          const payload = getEditReplyPayload(interaction);
          assert.strictEqual(payload.content, 'No speed-tier data available for OU (Gen 9).');
        }
      );
    }
  },
  {
    name: 'speed-tier reports no data when no top usage entries resolve to pokemon data',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Unknownmon', 1, 50.5)],
        {},
        async (command) => {
          const interaction = createInteraction({ generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
          const payload = getEditReplyPayload(interaction);
          assert.strictEqual(payload.content, 'No speed-tier data available for OU (Gen 9).');
        }
      );
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