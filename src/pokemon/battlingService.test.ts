import assert = require('assert');
import { MoveSetUsage, PokemonUsage } from '../models/smogonUsage';
import { BattlingService } from './battlingService';
import { BattleRoleFitStatus } from '../models/battling';
import { BaseStatTarget, FormatStatBucket } from '../models/statsRanking';
import { MoveCategory } from '../models/moves';
import { Pokemon, PokemonType } from '../models/pokemon';
import { BattleRolesHelper } from './battleRolesHelper';

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

function createMoveSetUsage(name: string, options: { moves?: string[]; abilities?: string[] } = {}): MoveSetUsage {
  return {
    name,
    abilities: (options.abilities ?? []).map((ability, index) => ({ name: ability, percentage: 100 - index })),
    items: [],
    spreads: [],
    moves: (options.moves ?? []).map((move, index) => ({ name: move, percentage: 100 - index })),
    teraTypes: [],
    teamMates: [],
    checksAndCounters: [],
  };
}

function createUsage(name: string, rank: number, usageRaw: number): PokemonUsage {
  return {
    name,
    rank,
    usagePercentage: usageRaw,
    usageRaw,
  };
}

function createPokemon(name: string, stat: number): Pokemon {
  return {
    name,
    type1: PokemonType.Normal,
    type2: PokemonType.Normal,
    baseStats: {
      hp: 50,
      atk: stat,
      def: stat,
      spA: stat,
      spD: stat,
      spe: stat,
      tot: 50 + (stat * 5),
    },
    tier: 'OU',
    possiblesAbilities: [],
    evolutions: [],
    generation: 'gen9',
    isAltForm: false,
    weight: 100,
    height: 1,
  };
}

function createService(options: {
  pokemonByName?: Record<string, Pokemon>;
  moveCategoryByName?: Record<string, MoveCategory>;
  formatStats?: {
    getMinimumStatForBucket?: (bucket: FormatStatBucket) => number | undefined | Promise<number | undefined>;
    isInBucket?: (target: BaseStatTarget, bucket: FormatStatBucket) => boolean | Promise<boolean>;
  };
} = {}): BattlingService {
  const pokemonMap = new Map(
    Object.values(options.pokemonByName ?? {}).map(pokemon => [pokemon.name.toLowerCase(), pokemon])
  );
  const moveCategoryMap = new Map(
    Object.entries(options.moveCategoryByName ?? {}).map(([name, category]) => [name.toLowerCase(), category])
  );
  const formatStats = {
    getMinimumStatForBucket: async (_format: unknown, _target: BaseStatTarget, bucket: FormatStatBucket) => options.formatStats?.getMinimumStatForBucket
      ? options.formatStats.getMinimumStatForBucket(bucket)
      : 150,
    isInBucket: async (_format: unknown, target: BaseStatTarget, _baseStats: unknown, bucket: FormatStatBucket) => options.formatStats?.isInBucket
      ? options.formatStats.isInBucket(target, bucket)
      : false,
  };

  return new BattlingService(
    {
      getPokemon: (name: string) => pokemonMap.get(name.toLowerCase()),
    } as never,
    {
      getMove: (name: string) => {
        const category = moveCategoryMap.get(name.toLowerCase());
        return category
          ? { name, category } as never
          : undefined;
      },
    } as never,
    formatStats as never,
  );
}

const service = new BattlingService();

const tests: TestCase[] = [
  {
    name: 'SmogonMetaRoleOrder defines stable display order for Smogon formats',
    run: async () => {
      const roleNames = BattleRolesHelper.getMetaRoleOrder(false).map(key => BattleRolesHelper.getRoleDefinition(key)!.displayName);
      assert.deepStrictEqual(roleNames, [
        'High Atk Stats',
        'Set-uppers',
        'Priority Users',
        'Fast',
        'Pivot',
        'Weather Setters',
        'Redirection',
        'Hazards Control',
        'Stats Reducing',
        'Status Inflicting',
        'High Defs Stats',
        'Stall',
      ]);
    },
  },
  {
    name: 'VgcMetaRoleOrder defines stable display order for VGC formats',
    run: async () => {
      const roleNames = BattleRolesHelper.getMetaRoleOrder(true).map(key => BattleRolesHelper.getRoleDefinition(key)!.displayName);
      assert.deepStrictEqual(roleNames, [
        'High Atk Stats',
        'Set-uppers',
        'Priority Users',
        'Supporters',
        'Weather Setters',
        'Redirection',
        'Stats Reducing',
        'Status Inflicting',
        'High Defs Stats',
        'Speed Control',
        'Trick Room',
        'Tailwind',
      ]);
    },
  },
  {
    name: 'matches move-based weather setters from the battle roles file',
    run: async () => {
      assert.strictEqual(await service.isWeatherSetter({ generation: 'gen9', meta: 'ou' } as never, createMoveSetUsage('Pelipper', { moves: ['Sunny Day'] })), true);
    },
  },
  {
    name: 'matches ability-based weather setters from the battle roles file',
    run: async () => {
      assert.strictEqual(await service.isWeatherSetter({ generation: 'gen9', meta: 'ou' } as never, createMoveSetUsage('Pelipper', { abilities: ['Drizzle'] })), true);
    },
  },
  {
    name: 'matches broader ability overrides for hazards control',
    run: async () => {
      assert.strictEqual(await service.isHazardsControl({ generation: 'gen9', meta: 'ou' } as never, createMoveSetUsage('Glimmora', { abilities: ['Toxic Debris'] })), true);
    },
  },
  {
    name: 'matches broader ability overrides for pivot roles',
    run: async () => {
      assert.strictEqual(await service.isPivot({ generation: 'gen9', meta: 'ou' } as never, createMoveSetUsage('Amoonguss', { abilities: ['Regenerator'] })), true);
    },
  },
  {
    name: 'matches stat-reducing presets while excluding speed-only effects',
    run: async () => {
      assert.strictEqual(await service.hasRole({ generation: 'gen9', meta: 'ou' } as never, 'StatsReducing', createMoveSetUsage('Incineroar', { abilities: ['Intimidate'] })), true);
      assert.strictEqual(await service.hasRole({ generation: 'gen9', meta: 'ou' } as never, 'StatsReducing', createMoveSetUsage('Amoonguss', { abilities: ['Gooey'] })), false);
    },
  },
  {
    name: 'matches status-inflicting presets from both moves and abilities',
    run: async () => {
      assert.strictEqual(await service.hasRole({ generation: 'gen9', meta: 'ou' } as never, 'StatusInflicting', createMoveSetUsage('Amoonguss', { moves: ['Spore'] })), true);
      assert.strictEqual(await service.hasRole({ generation: 'gen9', meta: 'ou' } as never, 'StatusInflicting', createMoveSetUsage('Pecharunt', { abilities: ['Poison Puppeteer'] })), true);
    },
  },
  {
    name: 'returns all matching signal roles for overlapping movesets',
    run: async () => {
      const matches = await service.getMatchingRoles({ generation: 'gen9', meta: 'ou' } as never, createMoveSetUsage('Slowking', { moves: ['Chilly Reception'] }));
      assert.deepStrictEqual(matches.map(role => role.displayName), ['Pivot', 'Supporters', 'Weather Setters', 'Stall']);
    },
  },
  {
    name: 'classifies supporters from top moves after removing set-uppers',
    run: async () => {
      const moveSet = createMoveSetUsage('Whimsicott', {
        moves: ['Swords Dance', 'Tailwind', 'Protect', 'Encore', 'Helping Hand', 'Charm', 'Sunny Day', 'Taunt', 'Moonblast', 'U-turn'],
      });

      assert.strictEqual(service.isSupporter(moveSet), true);
    },
  },
  {
    name: 'does not classify supporters without a strict status-move majority',
    run: async () => {
      const moveSet = createMoveSetUsage('Dragonite', {
        moves: ['Swords Dance', 'Bulk Up', 'Moonblast', 'U-turn', 'Heat Wave', 'Play Rough'],
      });

      assert.strictEqual(service.isSupporter(moveSet), false);
    },
  },
  {
    name: 'ranks strong attackers by strongest attacking stat before usage',
    run: async () => {
      const entries = await service.buildMetaStateRoleEntries(
        { generation: 'gen9', meta: 'ou' } as never,
        BattleRolesHelper.getMetaRoleOrder(false),
        [
          createUsage('Dragonite', 1, 21.1),
          createUsage('Chi-Yu', 2, 19.3),
          createUsage('Scizor', 3, 17.2),
        ],
        [
          createMoveSetUsage('Dragonite', { moves: ['Dragon Dance'] }),
          createMoveSetUsage('Chi-Yu', { moves: ['Nasty Plot'] }),
          createMoveSetUsage('Scizor', { moves: ['Bullet Punch'] }),
        ],
      );

      const attackers = entries.find(entry => entry.roleName === 'High Atk Stats');
      assert.deepStrictEqual(attackers?.pokemonNames, ['Chi-Yu', 'Dragonite', 'Scizor']);
    },
  },
  {
    name: 'includes top-half defenders in stall role rankings',
    run: async () => {
      const rankingService = createService({
        pokemonByName: {
          Mon1: createPokemon('Mon1', 200),
          Mon2: createPokemon('Mon2', 180),
          Mon3: createPokemon('Mon3', 160),
          Mon4: createPokemon('Mon4', 100),
          Mon5: createPokemon('Mon5', 90),
          Mon6: createPokemon('Mon6', 80),
        },
        formatStats: {
          getMinimumStatForBucket: async (bucket) => bucket === FormatStatBucket.Highest50p ? 160 : undefined,
        },
      });

      const entries = await rankingService.buildMetaStateRoleEntries(
        { generation: 'gen9', meta: 'ou' } as never,
        ['Stall'],
        [
          createUsage('Mon1', 1, 30),
          createUsage('Mon2', 2, 25),
          createUsage('Mon3', 3, 20),
          createUsage('Mon4', 4, 15),
          createUsage('Mon5', 5, 10),
          createUsage('Mon6', 6, 5),
        ],
        [
          createMoveSetUsage('Mon1'),
          createMoveSetUsage('Mon2'),
          createMoveSetUsage('Mon3'),
          createMoveSetUsage('Mon4'),
          createMoveSetUsage('Mon5'),
          createMoveSetUsage('Mon6'),
        ],
      );

      assert.deepStrictEqual(entries[0]?.pokemonNames, ['Mon1', 'Mon2', 'Mon3']);
    },
  },
  {
    name: 'ranks Trick Room users by slowest speed before usage',
    run: async () => {
      const entries = await service.buildMetaStateRoleEntries(
        { generation: 'gen9', meta: 'vgc2026regi' } as never,
        BattleRolesHelper.getMetaRoleOrder(true),
        [
          createUsage('Farigiraf', 1, 24.5),
          createUsage('Hatterene', 2, 20.8),
        ],
        [
          createMoveSetUsage('Farigiraf', { moves: ['Trick Room'] }),
          createMoveSetUsage('Hatterene', { moves: ['Trick Room'] }),
        ],
      );

      const trickRoom = entries.find(entry => entry.roleName === 'Trick Room');
      assert.deepStrictEqual(trickRoom?.pokemonNames, ['Hatterene', 'Farigiraf']);
    },
  },
  {
    name: 'ranks Tailwind users by fastest speed before usage',
    run: async () => {
      const entries = await service.buildMetaStateRoleEntries(
        { generation: 'gen9', meta: 'vgc2026regi' } as never,
        BattleRolesHelper.getMetaRoleOrder(true),
        [
          createUsage('Whimsicott', 1, 28.1),
          createUsage('Talonflame', 4, 14.2),
        ],
        [
          createMoveSetUsage('Whimsicott', { moves: ['Tailwind'] }),
          createMoveSetUsage('Talonflame', { moves: ['Tailwind'] }),
        ],
      );

      const tailwind = entries.find(entry => entry.roleName === 'Tailwind');
      assert.deepStrictEqual(tailwind?.pokemonNames, ['Talonflame', 'Whimsicott']);
    },
  },
  {
    name: 'getRoleFitStatus maps computed roles to format stat buckets',
    run: async () => {
      const format = { generation: 'gen9', meta: 'ou' } as never;
      const serviceWithBuckets = createService({
        pokemonByName: {
          Attacker: createPokemon('Attacker', 200),
          Speedster: createPokemon('Speedster', 180),
          Wall: createPokemon('Wall', 160),
        },
        formatStats: {
          getMinimumStatForBucket: async () => 120,
          isInBucket: async (target, bucket) => {
            if (target === BaseStatTarget.Attacker) {
              return bucket === FormatStatBucket.Highest25p;
            }

            if (target === BaseStatTarget.Spe) {
              return bucket === FormatStatBucket.Highest50p;
            }

            return false;
          },
        },
      });

      assert.strictEqual(await serviceWithBuckets.getRoleFitStatus('StrongAttackers', format, 'Attacker', undefined), BattleRoleFitStatus.Yes);
      assert.strictEqual(await serviceWithBuckets.getRoleFitStatus('Fast', format, 'Speedster', undefined), BattleRoleFitStatus.Eventually);
      assert.strictEqual(await serviceWithBuckets.getRoleFitStatus('StrongDefenders', format, 'Wall', undefined), BattleRoleFitStatus.No);
    },
  },
  {
    name: 'getRoleFitStatus returns maybe when computed-role format stats are missing',
    run: async () => {
      const rankingService = createService({
        pokemonByName: {
          Mon1: createPokemon('Mon1', 200),
        },
        formatStats: {
          getMinimumStatForBucket: async () => undefined,
        },
      });

      assert.strictEqual(await rankingService.getRoleFitStatus('StrongAttackers', { generation: 'gen9', meta: 'ou' } as never, 'Mon1', undefined), BattleRoleFitStatus.Eventually);
    },
  },
  {
    name: 'getRoleFitStatus treats top-half defenders as eventual stall fits',
    run: async () => {
      const rankingService = createService({
        pokemonByName: {
          Wall: createPokemon('Wall', 200),
        },
        formatStats: {
          getMinimumStatForBucket: async () => 150,
          isInBucket: async (target, bucket) => target === BaseStatTarget.Defender && bucket === FormatStatBucket.Highest50p,
        },
      });

      assert.strictEqual(await rankingService.getRoleFitStatus('Stall', { generation: 'gen9', meta: 'ou' } as never, 'Wall', createMoveSetUsage('Wall')), BattleRoleFitStatus.Eventually);
    },
  },
  {
    name: 'getRoleFitStatus returns maybe when the target pokemon is missing',
    run: async () => {
      const rankingService = createService({
        pokemonByName: {},
      });

      assert.strictEqual(await rankingService.getRoleFitStatus('StrongAttackers', { generation: 'gen9', meta: 'ou' } as never, 'Mon1', undefined), BattleRoleFitStatus.Eventually);
    },
  },
  {
    name: 'getRoleFitStatus delegates preset role checks to existing move and ability matching',
    run: async () => {
      const format = { generation: 'gen9', meta: 'ou' } as never;
      assert.strictEqual(await service.getRoleFitStatus('WeatherSetters', format, 'Pelipper', createMoveSetUsage('Pelipper', { abilities: ['Drizzle'] })), BattleRoleFitStatus.Yes);
      assert.strictEqual(await service.getRoleFitStatus('WeatherSetters', format, 'Pelipper', createMoveSetUsage('Pelipper', { moves: ['Hurricane'] })), BattleRoleFitStatus.No);
      assert.strictEqual(await service.getRoleFitStatus('WeatherSetters', format, 'Pelipper', undefined), BattleRoleFitStatus.Eventually);
    },
  },
  {
    name: 'getRoleFitStatus keeps supporter, trick room, and tailwind on move-based checks',
    run: async () => {
      const rankingService = createService({
        moveCategoryByName: {
          'Helping Hand': MoveCategory.Status,
          Protect: MoveCategory.Status,
          Encore: MoveCategory.Status,
          Tailwind: MoveCategory.Status,
          Moonblast: MoveCategory.Special,
          'Trick Room': MoveCategory.Status,
        },
      });

      const supporterMoveSet = createMoveSetUsage('Whimsicott', {
        moves: ['Helping Hand', 'Protect', 'Encore', 'Tailwind', 'Moonblast'],
      });
      const trickRoomMoveSet = createMoveSetUsage('Farigiraf', {
        moves: ['Trick Room', 'Protect'],
      });
      const tailwindMoveSet = createMoveSetUsage('Talonflame', {
        moves: ['Tailwind', 'Brave Bird'],
      });

      const format = { generation: 'gen9', meta: 'ou' } as never;
      assert.strictEqual(await rankingService.getRoleFitStatus('Supporters', format, 'Whimsicott', supporterMoveSet), BattleRoleFitStatus.Yes);
      assert.strictEqual(await rankingService.getRoleFitStatus('TrickRoom', format, 'Farigiraf', trickRoomMoveSet), BattleRoleFitStatus.Yes);
      assert.strictEqual(await rankingService.getRoleFitStatus('Tailwind', format, 'Talonflame', tailwindMoveSet), BattleRoleFitStatus.Yes);
    },
  },
  {
    name: 'returns false for unmatched movesets',
    run: async () => {
      const format = { generation: 'gen9', meta: 'ou' } as never;
      const moveSet = createMoveSetUsage('Testmon', { moves: ['Moonblast'], abilities: ['Pressure'] });
      assert.strictEqual(await service.isSpeedControl(format, moveSet), false);
      assert.strictEqual(await service.isWeatherSetter(format, moveSet), false);
      assert.strictEqual(await service.isHazardsControl(format, moveSet), false);
      assert.strictEqual(await service.isPivot(format, moveSet), false);
      assert.strictEqual(await service.isSetUpper(format, moveSet), false);
      assert.strictEqual(await service.isPriority(format, moveSet), false);
      assert.strictEqual(await service.isStall(format, moveSet), false);
      assert.strictEqual(service.isSupporter(moveSet), false);
    },
  },
];

async function run(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`PASS ${test.name}`);
  }
}

void run();