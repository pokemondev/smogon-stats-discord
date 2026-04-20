import assert = require('assert');
import { AppDataSource } from '../appDataSource';
import { ConfigHelper } from '../config/configHelper';
import { Pokemon } from '../models/pokemon';
import { MoveSetUsage, PokemonUsage } from '../models/smogonUsage';

process.env.BOT_NAME = process.env.BOT_NAME || 'Smogon Stats';
process.env.TOKEN = process.env.TOKEN || 'test-token';
process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

const { StatsCommand, createStatsCommandData } = require('./statsCommand') as typeof import('./statsCommand');

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

function createInteraction(
  subcommand: string,
  strings: Record<string, string | undefined> = {}
): FakeChatInputCommandInteraction {
  return new FakeChatInputCommandInteraction(subcommand, strings);
}

function createPokemon(name: string, baseStats: Partial<Pokemon['baseStats']> = {}): Pokemon {
  return {
    name,
    type1: 'Dragon' as never,
    type2: undefined as never,
    baseStats: {
      hp: baseStats.hp ?? 1,
      atk: baseStats.atk ?? 1,
      def: baseStats.def ?? 1,
      spA: baseStats.spA ?? 1,
      spD: baseStats.spD ?? 1,
      spe: baseStats.spe ?? 1,
      tot: baseStats.tot ?? 6,
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

function createMoveSetUsage(
  name: string,
  usage?: number,
  options: { moves?: string[]; abilities?: string[] } = {}
): MoveSetUsage {
  return {
    name,
    abilities: (options.abilities ?? []).map((ability, index) => ({ name: ability, percentage: 100 - index })),
    items: [],
    spreads: [],
    moves: (options.moves ?? []).map((move, index) => ({ name: move, percentage: 100 - index })),
    teraTypes: [],
    teamMates: [],
    checksAndCounters: [],
    usage,
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

function getFieldNames(interaction: FakeChatInputCommandInteraction): string[] {
  return getEmbedFields(interaction).map(field => field.name);
}

function withStubbedStatsData(
  usages: PokemonUsage[],
  pokemonByName: Record<string, Pokemon | undefined>,
  runTest: (command: InstanceType<typeof StatsCommand>) => Promise<void>,
  emojiDisplayByPokemonName: Record<string, string> = {}
): Promise<void> {
  const originalGetUsages = dataSource.smogonStats.getUsages.bind(dataSource.smogonStats);
  const originalGetPokemon = dataSource.pokemonDb.getPokemon.bind(dataSource.pokemonDb);
  const originalGetPokemonEmoji = dataSource.emojiService.getPokemonEmoji.bind(dataSource.emojiService);

  dataSource.smogonStats.getUsages = async () => usages;
  dataSource.pokemonDb.getPokemon = (name: string) => pokemonByName[name];
  dataSource.emojiService.getPokemonEmoji = (name: string) => emojiDisplayByPokemonName[name];

  const command = new StatsCommand(dataSource);

  return runTest(command).finally(() => {
    dataSource.smogonStats.getUsages = originalGetUsages;
    dataSource.pokemonDb.getPokemon = originalGetPokemon;
    dataSource.emojiService.getPokemonEmoji = originalGetPokemonEmoji;
  });
}

function withStubbedLeadsData(
  leads: PokemonUsage[],
  pokemonByName: Record<string, Pokemon | undefined>,
  runTest: (command: InstanceType<typeof StatsCommand>) => Promise<void>,
  emojiDisplayByPokemonName: Record<string, string> = {}
): Promise<void> {
  const originalGetLeads = dataSource.smogonStats.getLeads.bind(dataSource.smogonStats);
  const originalGetPokemon = dataSource.pokemonDb.getPokemon.bind(dataSource.pokemonDb);
  const originalGetPokemonEmoji = dataSource.emojiService.getPokemonEmoji.bind(dataSource.emojiService);

  dataSource.smogonStats.getLeads = async () => leads;
  dataSource.pokemonDb.getPokemon = (name: string) => pokemonByName[name];
  dataSource.emojiService.getPokemonEmoji = (name: string) => emojiDisplayByPokemonName[name];

  const command = new StatsCommand(dataSource);

  return runTest(command).finally(() => {
    dataSource.smogonStats.getLeads = originalGetLeads;
    dataSource.pokemonDb.getPokemon = originalGetPokemon;
    dataSource.emojiService.getPokemonEmoji = originalGetPokemonEmoji;
  });
}

function withStubbedMegasData(
  moveSets: MoveSetUsage[],
  pokemonByName: Record<string, Pokemon | undefined>,
  runTest: (command: InstanceType<typeof StatsCommand>) => Promise<void>,
  emojiDisplayByPokemonName: Record<string, string> = {}
): Promise<void> {
  const originalGetMegasMoveSets = dataSource.smogonStats.getMegasMoveSets.bind(dataSource.smogonStats);
  const originalGetPokemon = dataSource.pokemonDb.getPokemon.bind(dataSource.pokemonDb);
  const originalGetPokemonEmoji = dataSource.emojiService.getPokemonEmoji.bind(dataSource.emojiService);

  dataSource.smogonStats.getMegasMoveSets = async () => moveSets;
  dataSource.pokemonDb.getPokemon = (name: string) => pokemonByName[name];
  dataSource.emojiService.getPokemonEmoji = (name: string) => emojiDisplayByPokemonName[name];

  const command = new StatsCommand(dataSource);

  return runTest(command).finally(() => {
    dataSource.smogonStats.getMegasMoveSets = originalGetMegasMoveSets;
    dataSource.pokemonDb.getPokemon = originalGetPokemon;
    dataSource.emojiService.getPokemonEmoji = originalGetPokemonEmoji;
  });
}

function withStubbedMetaStateData(
  usages: PokemonUsage[],
  moveSets: MoveSetUsage[],
  pokemonByName: Record<string, Pokemon | undefined>,
  runTest: (command: InstanceType<typeof StatsCommand>) => Promise<void>,
  emojiDisplayByPokemonName: Record<string, string> = {}
): Promise<void> {
  const originalGetUsages = dataSource.smogonStats.getUsages.bind(dataSource.smogonStats);
  const originalGetMoveSets = dataSource.smogonStats.getMoveSets.bind(dataSource.smogonStats);
  const originalGetPokemon = dataSource.pokemonDb.getPokemon.bind(dataSource.pokemonDb);
  const originalGetPokemonEmoji = dataSource.emojiService.getPokemonEmoji.bind(dataSource.emojiService);

  dataSource.smogonStats.getUsages = async () => usages;
  dataSource.smogonStats.getMoveSets = async () => moveSets;
  dataSource.pokemonDb.getPokemon = (name: string) => pokemonByName[name];
  dataSource.emojiService.getPokemonEmoji = (name: string) => emojiDisplayByPokemonName[name];

  const command = new StatsCommand(dataSource);

  return runTest(command).finally(() => {
    dataSource.smogonStats.getUsages = originalGetUsages;
    dataSource.smogonStats.getMoveSets = originalGetMoveSets;
    dataSource.pokemonDb.getPokemon = originalGetPokemon;
    dataSource.emojiService.getPokemonEmoji = originalGetPokemonEmoji;
  });
}

const tests: TestCase[] = [
  {
    name: 'stats command data includes attackers and defenders mode choices',
    run: async () => {
      const commandData = createStatsCommandData().toJSON();
      const options = (commandData.options ?? []) as Array<{ name: string; options?: Array<{ name: string; choices?: Array<{ value: string }> }> }>;
      const attackers = options.find(option => option.name === 'attackers');
      const defenders = options.find(option => option.name === 'defenders');

      assert.ok(attackers);
      assert.ok(defenders);
      assert.deepStrictEqual(attackers?.options?.find(option => option.name === 'mode')?.choices?.map(choice => choice.value), ['both', 'physical', 'special']);
      assert.deepStrictEqual(defenders?.options?.find(option => option.name === 'mode')?.choices?.map(choice => choice.value), ['both', 'physical', 'special']);
    }
  },
  {
    name: 'stats command data includes the meta-state subcommand with format filters',
    run: async () => {
      const commandData = createStatsCommandData().toJSON();
      const options = (commandData.options ?? []) as Array<{ name: string; options?: Array<{ name: string }> }>;
      const metaState = options.find(option => option.name === 'meta-state');

      assert.ok(metaState);
      assert.deepStrictEqual(metaState?.options?.map(option => option.name), ['meta', 'generation']);
    }
  },
  {
    name: 'usage renders numbered titles and preserves usage values',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragapult', 1, 18.84), createUsage('Garchomp', 2, 12.31)],
        {
          Dragapult: createPokemon('Dragapult'),
          Garchomp: createPokemon('Garchomp'),
        },
        async (command) => {
          const interaction = createInteraction('usage', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const fields = getEmbedFields(interaction);
          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Dragapult', '#2 Garchomp']);
          assert.strictEqual(fields[0].value, 'Usage: `18.84%`');
          assert.strictEqual(getEditReplyPayload(interaction).content, '**__Usage:__** Top 2 most used Pokemon of OU (Gen 9)');
        }
      );
    }
  },
  {
    name: 'usage renders application emojis when available',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragapult', 1, 18.84), createUsage('Garchomp', 2, 12.31)],
        {
          Dragapult: createPokemon('Dragapult'),
          Garchomp: createPokemon('Garchomp'),
        },
        async (command) => {
          const interaction = createInteraction('usage', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(getFieldNames(interaction), ['#1 <:dragapult:123> Dragapult', '#2 Garchomp']);
        },
        {
          Dragapult: '<:dragapult:123>',
        }
      );
    }
  },
  {
    name: 'leads renders numbered titles and preserves usage values',
    run: async () => {
      await withStubbedLeadsData(
        [createUsage('Azelf', 1, 21.5), createUsage('Glimmora', 2, 19.25)],
        {
          Azelf: createPokemon('Azelf'),
          Glimmora: createPokemon('Glimmora'),
        },
        async (command) => {
          const interaction = createInteraction('leads', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const fields = getEmbedFields(interaction);
          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Azelf', '#2 Glimmora']);
          assert.strictEqual(fields[1].value, 'Usage: `19.25%`');
          assert.strictEqual(getEditReplyPayload(interaction).content, '**__Leads:__** Top 2 leads of OU (Gen 9)');
        }
      );
    }
  },
  {
    name: 'leads renders application emojis when available',
    run: async () => {
      await withStubbedLeadsData(
        [createUsage('Azelf', 1, 21.5), createUsage('Glimmora', 2, 19.25)],
        {
          Azelf: createPokemon('Azelf'),
          Glimmora: createPokemon('Glimmora'),
        },
        async (command) => {
          const interaction = createInteraction('leads', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(getFieldNames(interaction), ['#1 <:azelf:123> Azelf', '#2 Glimmora']);
        },
        {
          Azelf: '<:azelf:123>',
        }
      );
    }
  },
  {
    name: 'meta-state renders top battle-role fields with emoji-ranked Pokemon lists',
    run: async () => {
      await withStubbedMetaStateData(
        [
          createUsage('Dragonite', 1, 24.3),
          createUsage('Dragapult', 2, 22.8),
          createUsage('Pelipper', 3, 20.1),
          createUsage('Landorus-Therian', 4, 18.4),
          createUsage('Glimmora', 5, 17.7),
          createUsage('Toxapex', 6, 16.2),
          createUsage('Scizor', 7, 14.5),
          createUsage('Whimsicott', 8, 13.1),
          createUsage('Blissey', 9, 12.6),
          createUsage('Rotom-Wash', 10, 11.4),
          createUsage('Corviknight', 11, 10.8),
          createUsage('Volcarona', 12, 9.2),
        ],
        [
          createMoveSetUsage('Dragonite', undefined, { moves: ['Dragon Dance', 'Extreme Speed'] }),
          createMoveSetUsage('Dragapult', undefined, { moves: ['Dragon Darts'] }),
          createMoveSetUsage('Pelipper', undefined, { abilities: ['Drizzle'] }),
          createMoveSetUsage('Landorus-Therian', undefined, { moves: ['U-turn'] }),
          createMoveSetUsage('Glimmora', undefined, { abilities: ['Toxic Debris'], moves: ['Stealth Rock'] }),
          createMoveSetUsage('Toxapex', undefined, { moves: ['Recover'] }),
          createMoveSetUsage('Scizor', undefined, { moves: ['Bullet Punch'] }),
          createMoveSetUsage('Whimsicott', undefined, { moves: ['Tailwind'] }),
          createMoveSetUsage('Blissey', undefined, { moves: ['Soft-Boiled'] }),
          createMoveSetUsage('Rotom-Wash', undefined, { moves: ['Volt Switch'] }),
          createMoveSetUsage('Corviknight', undefined, { moves: ['U-turn'] }),
          createMoveSetUsage('Volcarona', undefined, { moves: ['Quiver Dance'] }),
        ],
        {
          Dragonite: createPokemon('Dragonite', { atk: 134, spe: 80 }),
          Dragapult: createPokemon('Dragapult', { atk: 120, spA: 100, spe: 142 }),
          Pelipper: createPokemon('Pelipper', { spA: 95, def: 100, spD: 70, spe: 65 }),
          'Landorus-Therian': createPokemon('Landorus-Therian', { atk: 145, def: 90, spD: 80, spe: 91 }),
          Glimmora: createPokemon('Glimmora', { def: 90, spD: 81, spe: 86 }),
          Toxapex: createPokemon('Toxapex', { def: 152, spD: 142, spe: 35 }),
          Scizor: createPokemon('Scizor', { atk: 130, spe: 65 }),
          Whimsicott: createPokemon('Whimsicott', { spe: 116 }),
          Blissey: createPokemon('Blissey', { def: 10, spD: 135, spe: 55 }),
          'Rotom-Wash': createPokemon('Rotom-Wash', { def: 80, spD: 80, spe: 86 }),
          Corviknight: createPokemon('Corviknight', { def: 105, spD: 85, spe: 67 }),
          Volcarona: createPokemon('Volcarona', { atk: 60, spA: 130, spe: 100 }),
        },
        async (command) => {
          const interaction = createInteraction('meta-state', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          const fields = getEmbedFields(interaction);
          const embed = payload.embeds?.[0].toJSON() as { title?: string } | undefined;
          const strongAttackersField = fields.find(field => field.name === 'High Atk Stats');
          const fastField = fields.find(field => field.name === 'Fast');
          const strongDefendersField = fields.find(field => field.name === 'High Defs Stats');
          const stallField = fields.find(field => field.name === 'Stall');

          assert.strictEqual(payload.content, '**__Meta State:__** OU (Gen 9)');
          assert.strictEqual(embed?.title, undefined);
          assert.deepStrictEqual(fields.map(field => field.name), [
            'High Atk Stats',
            'Set-uppers',
            'Priority Users',
            'Fast',
            'Pivot',
            'Hazards Control',
            'High Defs Stats',
            'Stall',
            'Status Inflicting',
          ]);
          assert.strictEqual(strongAttackersField?.value, '<:lando:123> Landorus-Therian\nDragonite\nScizor\nVolcarona\nDragapult');
          assert.strictEqual(fastField?.value, 'Dragapult\nWhimsicott\nVolcarona\n<:lando:123> Landorus-Therian\nGlimmora');
          assert.strictEqual(strongDefendersField?.value, 'Toxapex\nBlissey\nCorviknight\n<:pelipper:123> Pelipper\n<:lando:123> Landorus-Therian');
          assert.strictEqual(stallField?.value, 'Toxapex\nBlissey');
        },
        {
          Pelipper: '<:pelipper:123>',
          'Landorus-Therian': '<:lando:123>',
        }
      );
    }
  },
  {
    name: 'meta-state uses vgc role order when the selected meta is vgc',
    run: async () => {
      await withStubbedMetaStateData(
        [
          createUsage('Whimsicott', 1, 24),
          createUsage('Pelipper', 2, 22),
          createUsage('Farigiraf', 3, 20),
          createUsage('Talonflame', 4, 18),
          createUsage('Hatterene', 5, 16),
          createUsage('Amoonguss', 6, 14),
        ],
        [
          createMoveSetUsage('Whimsicott', undefined, { moves: ['Tailwind', 'Encore', 'Helping Hand'] }),
          createMoveSetUsage('Pelipper', undefined, { abilities: ['Drizzle'] }),
          createMoveSetUsage('Farigiraf', undefined, { moves: ['Trick Room'] }),
          createMoveSetUsage('Talonflame', undefined, { moves: ['Tailwind'] }),
          createMoveSetUsage('Hatterene', undefined, { moves: ['Trick Room'] }),
          createMoveSetUsage('Amoonguss', undefined, { moves: ['Spore', 'Pollen Puff', 'Rage Powder'] }),
        ],
        {
          Whimsicott: createPokemon('Whimsicott', { spe: 116, spA: 77, def: 85, spD: 75 }),
          Pelipper: createPokemon('Pelipper', { spA: 95, def: 100, spD: 70, spe: 65 }),
          Farigiraf: createPokemon('Farigiraf', { spA: 120, def: 70, spD: 70, spe: 60 }),
          Talonflame: createPokemon('Talonflame', { atk: 81, spe: 126, def: 71, spD: 69 }),
          Hatterene: createPokemon('Hatterene', { spA: 136, def: 95, spD: 103, spe: 29 }),
          Amoonguss: createPokemon('Amoonguss', { def: 70, spD: 80, spe: 30 }),
        },
        async (command) => {
          const interaction = createInteraction('meta-state', { generation: '9', meta: 'vgc2026regi' });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          const fields = getEmbedFields(interaction);

          assert.strictEqual(payload.content, '**__Meta State:__** VGC 2026 Reg. I (Gen 9)');
          assert.deepStrictEqual(fields.map(field => field.name), [
            'High Atk Stats',
            'Set-uppers',
            'Priority Users',
            'Supporters',
            'Weather Setters',
            'Redirection',
            'Tailwind',
            'Trick Room',
            'Speed Control',
            'High Defs Stats',
            'Stats Reducing',
            'Status Inflicting',
          ]);
        },
      );
    }
  },
  {
    name: 'meta-state reports no data when moveset data is empty',
    run: async () => {
      await withStubbedMetaStateData(
        [createUsage('Pelipper', 1, 24.3)],
        [],
        {
          Pelipper: createPokemon('Pelipper'),
        },
        async (command) => {
          const interaction = createInteraction('meta-state', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
          assert.strictEqual(getEditReplyPayload(interaction).content, 'No meta-state data available for OU (Gen 9).');
        }
      );
    }
  },
  {
    name: 'speed-tier defers before editing successful responses',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragapult', 4, 18.84), createUsage('Iron Bundle', 9, 10.12)],
        {
          Dragapult: createPokemon('Dragapult', { spe: 142 }),
          'Iron Bundle': createPokemon('Iron Bundle', { spe: 136 }),
        },
        async (command) => {
          const interaction = createInteraction('speed-tier', { generation: '9', meta: 'ou' });

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
          Dragapult: createPokemon('Dragapult', { spe: 142 }),
          Garchomp: createPokemon('Garchomp', { spe: 102 }),
          Shuckle: createPokemon('Shuckle', { spe: 5 }),
        },
        async (command) => {
          const interaction = createInteraction('speed-tier', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          assert.strictEqual(payload.content, '**__Speed Tier:__** Top 3 Pokemon of OU (Gen 9)');
          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Dragapult', '#2 Garchomp', '#3 Shuckle']);
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
          Dragapult: createPokemon('Dragapult', { spe: 142 }),
          Garchomp: createPokemon('Garchomp', { spe: 102 }),
          Shuckle: createPokemon('Shuckle', { spe: 5 }),
        },
        async (command) => {
          const interaction = createInteraction('speed-tier', { generation: '9', meta: 'ou', mode: 'slower' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Shuckle', '#2 Garchomp', '#3 Dragapult']);
        }
      );
    }
  },
  {
    name: 'speed-tier only uses the top 100 usage entries before sorting',
    run: async () => {
      const usages = Array.from({ length: 101 }, (_, index) => createUsage(`Mon${index + 1}`, index + 1, 100 - index));
      const pokemonByName = Object.fromEntries(usages.map((usage, index) => [usage.name, createPokemon(usage.name, { spe: 200 - index })]));
      pokemonByName.Mon101 = createPokemon('Mon101', { spe: 999 });

      await withStubbedStatsData(
        usages,
        pokemonByName,
        async (command) => {
          const interaction = createInteraction('speed-tier', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const fields = getEmbedFields(interaction);
          assert.ok(fields.every(field => field.name.indexOf('Mon101') < 0));
          assert.strictEqual(fields[0].name, '#1 Mon1');
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
          Dragapult: createPokemon('Dragapult', { spe: 142 }),
        },
        async (command) => {
          const interaction = createInteraction('speed-tier', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          const fields = getEmbedFields(interaction);
          assert.strictEqual(payload.content, '**__Speed Tier:__** Top 1 Pokemon of OU (Gen 9)');
          assert.strictEqual(fields[0].value, 'Base Speed: `142`\nUsage: `#4` (18.84%)');
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
          const interaction = createInteraction('speed-tier', { generation: '9', meta: 'ou' });

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
          const interaction = createInteraction('speed-tier', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
          const payload = getEditReplyPayload(interaction);
          assert.strictEqual(payload.content, 'No speed-tier data available for OU (Gen 9).');
        }
      );
    }
  },
  {
    name: 'attackers defaults to both mode and uses the stronger attacking stat per pokemon',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Chi-Yu', 3, 22.1), createUsage('Garchomp', 5, 17.2), createUsage('Dragapult', 7, 14.8)],
        {
          'Chi-Yu': createPokemon('Chi-Yu', { atk: 80, spA: 135 }),
          Garchomp: createPokemon('Garchomp', { atk: 130, spA: 80 }),
          Dragapult: createPokemon('Dragapult', { atk: 120, spA: 100 }),
        },
        async (command) => {
          const interaction = createInteraction('attackers', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          const fields = getEmbedFields(interaction);
          assert.strictEqual(payload.content, '**__Attackers:__** Top 3 Pokemon of OU (Gen 9)');
          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Chi-Yu', '#2 Garchomp', '#3 Dragapult']);
          assert.strictEqual(fields[0].value, 'Base Sp. Atk: `135`\nUsage: `#3` (22.10%)');
          assert.strictEqual(fields[1].value, 'Base Attack: `130`\nUsage: `#5` (17.20%)');
        }
      );
    }
  },
  {
    name: 'attackers physical mode breaks stat ties with usage rank',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragonite', 2, 25.5), createUsage('Gallade', 8, 9.1), createUsage('Hydreigon', 5, 12.3)],
        {
          Dragonite: createPokemon('Dragonite', { atk: 134, spA: 100 }),
          Gallade: createPokemon('Gallade', { atk: 134, spA: 65 }),
          Hydreigon: createPokemon('Hydreigon', { atk: 105, spA: 125 }),
        },
        async (command) => {
          const interaction = createInteraction('attackers', { generation: '9', meta: 'ou', mode: 'physical' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Dragonite', '#2 Gallade', '#3 Hydreigon']);
          assert.strictEqual(getEmbedFields(interaction)[0].value, 'Base Attack: `134`\nUsage: `#2` (25.50%)');
        }
      );
    }
  },
  {
    name: 'attackers render application emojis when available',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Dragonite', 2, 25.5), createUsage('Gallade', 8, 9.1)],
        {
          Dragonite: createPokemon('Dragonite', { atk: 134, spA: 100 }),
          Gallade: createPokemon('Gallade', { atk: 134, spA: 65 }),
        },
        async (command) => {
          const interaction = createInteraction('attackers', { generation: '9', meta: 'ou', mode: 'physical' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(getFieldNames(interaction), ['#1 <:dragonite:123> Dragonite', '#2 Gallade']);
        },
        {
          Dragonite: '<:dragonite:123>',
        }
      );
    }
  },
  {
    name: 'defenders special mode ranks by special defense',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Blissey', 6, 11.1), createUsage('Goodra', 9, 8.4), createUsage('Skarmory', 12, 6.7)],
        {
          Blissey: createPokemon('Blissey', { def: 10, spD: 135 }),
          Goodra: createPokemon('Goodra', { def: 70, spD: 150 }),
          Skarmory: createPokemon('Skarmory', { def: 140, spD: 70 }),
        },
        async (command) => {
          const interaction = createInteraction('defenders', { generation: '9', meta: 'ou', mode: 'special' });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          assert.strictEqual(payload.content, '**__Defenders:__** Top 3 Pokemon of OU (Gen 9) - *special side only mode*');
          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Goodra', '#2 Blissey', '#3 Skarmory']);
          assert.strictEqual(getEmbedFields(interaction)[0].value, 'Base Sp. Def: `150`\nUsage: `#9` (8.40%)');
        }
      );
    }
  },
  {
    name: 'attackers only use the top 100 usage entries before sorting',
    run: async () => {
      const usages = Array.from({ length: 101 }, (_, index) => createUsage(`Mon${index + 1}`, index + 1, 200 - index));
      const pokemonByName = Object.fromEntries(usages.map((usage, index) => [usage.name, createPokemon(usage.name, { atk: 300 - index, spA: 50 })]));
      pokemonByName.Mon101 = createPokemon('Mon101', { atk: 999, spA: 999 });

      await withStubbedStatsData(
        usages,
        pokemonByName,
        async (command) => {
          const interaction = createInteraction('attackers', { generation: '9', meta: 'ou', mode: 'physical' });

          await command.execute(interaction as never);

          assert.ok(getFieldNames(interaction).every(name => name.indexOf('Mon101') < 0));
          assert.strictEqual(getFieldNames(interaction)[0], '#1 Mon1');
        }
      );
    }
  },
  {
    name: 'defenders report no data when usage list is empty',
    run: async () => {
      await withStubbedStatsData(
        [],
        {},
        async (command) => {
          const interaction = createInteraction('defenders', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
          assert.strictEqual(getEditReplyPayload(interaction).content, 'No defenders data available for OU (Gen 9).');
        }
      );
    }
  },
  {
    name: 'attackers report no data when no top usage entries resolve to pokemon data',
    run: async () => {
      await withStubbedStatsData(
        [createUsage('Unknownmon', 1, 50.5)],
        {},
        async (command) => {
          const interaction = createInteraction('attackers', { generation: '9', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
          assert.strictEqual(getEditReplyPayload(interaction).content, 'No attackers data available for OU (Gen 9).');
        }
      );
    }
  },
  {
    name: 'megas renders numbered titles and preserves usage values',
    run: async () => {
      await withStubbedMegasData(
        [createMoveSetUsage('Charizard', 12.34), createMoveSetUsage('Gengar', 9.87)],
        {
          Charizard: createPokemon('Charizard'),
          Gengar: createPokemon('Gengar'),
        },
        async (command) => {
          const interaction = createInteraction('megas', { generation: '6', meta: 'ou' });

          await command.execute(interaction as never);

          const fields = getEmbedFields(interaction);
          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Charizard', '#2 Gengar']);
          assert.strictEqual(fields[0].value, 'Usage: `12.34%`');
          assert.strictEqual(getEditReplyPayload(interaction).content, '**__Megas:__** Top 2 Mega Stone users of OU (Gen 6)');
        }
      );
    }
  },
  {
    name: 'megas render application emojis when available',
    run: async () => {
      await withStubbedMegasData(
        [createMoveSetUsage('Charizard', 12.34), createMoveSetUsage('Gengar', 9.87)],
        {
          Charizard: createPokemon('Charizard'),
          Gengar: createPokemon('Gengar'),
        },
        async (command) => {
          const interaction = createInteraction('megas', { generation: '6', meta: 'ou' });

          await command.execute(interaction as never);

          assert.deepStrictEqual(getFieldNames(interaction), ['#1 <:charizard:123> Charizard', '#2 Gengar']);
        },
        {
          Charizard: '<:charizard:123>',
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