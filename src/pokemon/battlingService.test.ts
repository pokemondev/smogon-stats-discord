import assert = require('assert');
import { MoveSetUsage, PokemonUsage } from '../models/smogonUsage';
import { BattlingService } from './battlingService';
import { BattleRoleFitStatus } from '../models/battling';
import { MoveCategory } from '../models/moves';
import { Pokemon, PokemonType } from '../models/pokemon';
import { BattleRolesHelper } from './battleRolesHelper';

interface TestCase {
  name: string;
  run: () => void;
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
} = {}): BattlingService {
  const pokemonMap = new Map(
    Object.values(options.pokemonByName ?? {}).map(pokemon => [pokemon.name.toLowerCase(), pokemon])
  );
  const moveCategoryMap = new Map(
    Object.entries(options.moveCategoryByName ?? {}).map(([name, category]) => [name.toLowerCase(), category])
  );

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
  );
}

const service = new BattlingService();

const tests: TestCase[] = [
  {
    name: 'SmogonMetaRoleOrder defines stable display order for Smogon formats',
    run: () => {
      const roleNames = BattleRolesHelper.getMetaRoleOrder(false).map(key => BattleRolesHelper.getRoleDefinition(key)!.displayName);
      assert.deepStrictEqual(roleNames, [
        'Strong Attackers',
        'Set-uppers',
        'Priorities',
        'Fast',
        'Pivot',
        'Speed Control',
        'Hazards Control',
        'Strong Defenders',
        'Stall',
        'Weather setters',
      ]);
    },
  },
  {
    name: 'VgcMetaRoleOrder defines stable display order for VGC formats',
    run: () => {
      const roleNames = BattleRolesHelper.getMetaRoleOrder(true).map(key => BattleRolesHelper.getRoleDefinition(key)!.displayName);
      assert.deepStrictEqual(roleNames, [
        'Strong Attackers',
        'Set-uppers',
        'Priorities',
        'Supporters',
        'Weather setters',
        'Strong Defenders',
        'Speed Control',
        'Trick Room',
        'Tailwind',
      ]);
    },
  },
  {
    name: 'matches move-based weather setters from the battle roles file',
    run: () => {
      assert.strictEqual(service.isWeatherSetter(createMoveSetUsage('Pelipper', { moves: ['Sunny Day'] })), true);
    },
  },
  {
    name: 'matches ability-based weather setters from the battle roles file',
    run: () => {
      assert.strictEqual(service.isWeatherSetter(createMoveSetUsage('Pelipper', { abilities: ['Drizzle'] })), true);
    },
  },
  {
    name: 'matches broader ability overrides for hazards control',
    run: () => {
      assert.strictEqual(service.isHazardsControl(createMoveSetUsage('Glimmora', { abilities: ['Toxic Debris'] })), true);
    },
  },
  {
    name: 'matches broader ability overrides for pivot roles',
    run: () => {
      assert.strictEqual(service.isPivot(createMoveSetUsage('Amoonguss', { abilities: ['Regenerator'] })), true);
    },
  },
  {
    name: 'returns all matching signal roles for overlapping movesets',
    run: () => {
      const matches = service.getMatchingRoles(createMoveSetUsage('Slowking', { moves: ['Chilly Reception'] }));
      assert.deepStrictEqual(matches.map(role => role.displayName), ['Pivot', 'Supporters', 'Weather setters']);
    },
  },
  {
    name: 'classifies supporters from top moves after removing set-uppers',
    run: () => {
      const moveSet = createMoveSetUsage('Whimsicott', {
        moves: ['Swords Dance', 'Tailwind', 'Protect', 'Encore', 'Helping Hand', 'Charm', 'Sunny Day', 'Taunt', 'Moonblast', 'U-turn'],
      });

      assert.strictEqual(service.isSupporter(moveSet), true);
    },
  },
  {
    name: 'does not classify supporters without a strict status-move majority',
    run: () => {
      const moveSet = createMoveSetUsage('Dragonite', {
        moves: ['Swords Dance', 'Bulk Up', 'Moonblast', 'U-turn', 'Heat Wave', 'Play Rough'],
      });

      assert.strictEqual(service.isSupporter(moveSet), false);
    },
  },
  {
    name: 'ranks strong attackers by strongest attacking stat before usage',
    run: () => {
      const entries = service.buildMetaStateRoleEntries(
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

      const attackers = entries.find(entry => entry.roleName === 'Strong Attackers');
      assert.deepStrictEqual(attackers?.pokemonNames, ['Chi-Yu', 'Dragonite', 'Scizor']);
    },
  },
  {
    name: 'ranks Trick Room users by slowest speed before usage',
    run: () => {
      const entries = service.buildMetaStateRoleEntries(
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
    run: () => {
      const entries = service.buildMetaStateRoleEntries(
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
    name: 'getRoleFitStatus uses top stat cutoff values for yes maybe and no',
    run: () => {
      const pokemonByName = Object.fromEntries([
        ...Array.from({ length: 15 }, (_, index) => {
          const name = `Mon${index + 1}`;
          return [name, createPokemon(name, 300)];
        }),
        ...Array.from({ length: 15 }, (_, index) => {
          const name = `Mon${index + 16}`;
          return [name, createPokemon(name, 200)];
        }),
        ...Array.from({ length: 5 }, (_, index) => {
          const name = `Mon${index + 31}`;
          return [name, createPokemon(name, 100)];
        }),
      ]);
      const usages = Array.from({ length: 35 }, (_, index) => createUsage(`Mon${index + 1}`, index + 1, 100 - index));
      const rankingService = createService({ pokemonByName });

      assert.strictEqual(rankingService.getRoleFitStatus('StrongAttackers', 'Mon5', undefined, usages), BattleRoleFitStatus.Yes);
      assert.strictEqual(rankingService.getRoleFitStatus('StrongAttackers', 'Mon20', undefined, usages), BattleRoleFitStatus.Eventually);
      assert.strictEqual(rankingService.getRoleFitStatus('StrongAttackers', 'Mon33', undefined, usages), BattleRoleFitStatus.No);
    },
  },
  {
    name: 'getRoleFitStatus treats tied stats beyond rank 25 as maybe when they match the cutoff value',
    run: () => {
      const pokemonByName = Object.fromEntries([
        ...Array.from({ length: 15 }, (_, index) => {
          const name = `Mon${index + 1}`;
          return [name, createPokemon(name, 300)];
        }),
        ...Array.from({ length: 20 }, (_, index) => {
          const name = `Mon${index + 16}`;
          return [name, createPokemon(name, 200)];
        }),
      ]);
      const usages = Array.from({ length: 35 }, (_, index) => createUsage(`Mon${index + 1}`, index + 1, 100 - index));
      const rankingService = createService({ pokemonByName });

      assert.strictEqual(rankingService.getRoleFitStatus('StrongAttackers', 'Mon35', undefined, usages), BattleRoleFitStatus.Eventually);
      assert.strictEqual(rankingService.getRoleFitStatus('StrongAttackers', 'Mon20', undefined, usages), BattleRoleFitStatus.Eventually);
    },
  },
  {
    name: 'getRoleFitStatus returns no when target stat is below the top25 cutoff value',
    run: () => {
      const pokemonByName = Object.fromEntries(
        Array.from({ length: 35 }, (_, index) => {
          const position = index + 1;
          const name = `Mon${position}`;
          const stat = position <= 15 ? 300 : position <= 30 ? 200 : 100;
          return [name, createPokemon(name, stat)];
        })
      );
      const usages = Array.from({ length: 35 }, (_, index) => createUsage(`Mon${index + 1}`, index + 1, 100 - index));
      const rankingService = createService({ pokemonByName });

      assert.strictEqual(rankingService.getRoleFitStatus('StrongAttackers', 'Mon33', undefined, usages), BattleRoleFitStatus.No);
    },
  },
  {
    name: 'getRoleFitStatus returns maybe when ranked-role usage data is missing',
    run: () => {
      const rankingService = createService({
        pokemonByName: {
          Mon1: createPokemon('Mon1', 200),
        },
      });

      assert.strictEqual(rankingService.getRoleFitStatus('StrongAttackers', 'Mon1', undefined, []), BattleRoleFitStatus.Eventually);
    },
  },
  {
    name: 'getRoleFitStatus delegates preset role checks to existing move and ability matching',
    run: () => {
      assert.strictEqual(service.getRoleFitStatus('WeatherSetters', 'Pelipper', createMoveSetUsage('Pelipper', { abilities: ['Drizzle'] }), []), BattleRoleFitStatus.Yes);
      assert.strictEqual(service.getRoleFitStatus('WeatherSetters', 'Pelipper', createMoveSetUsage('Pelipper', { moves: ['Hurricane'] }), []), BattleRoleFitStatus.No);
      assert.strictEqual(service.getRoleFitStatus('WeatherSetters', 'Pelipper', undefined, []), BattleRoleFitStatus.Eventually);
    },
  },
  {
    name: 'getRoleFitStatus keeps supporter, trick room, and tailwind on move-based checks',
    run: () => {
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

      assert.strictEqual(rankingService.getRoleFitStatus('Supporters', 'Whimsicott', supporterMoveSet, []), BattleRoleFitStatus.Yes);
      assert.strictEqual(rankingService.getRoleFitStatus('TrickRoom', 'Farigiraf', trickRoomMoveSet, []), BattleRoleFitStatus.Yes);
      assert.strictEqual(rankingService.getRoleFitStatus('Tailwind', 'Talonflame', tailwindMoveSet, []), BattleRoleFitStatus.Yes);
    },
  },
  {
    name: 'returns false for unmatched movesets',
    run: () => {
      const moveSet = createMoveSetUsage('Testmon', { moves: ['Moonblast'], abilities: ['Pressure'] });
      assert.strictEqual(service.isSpeedControl(moveSet), false);
      assert.strictEqual(service.isWeatherSetter(moveSet), false);
      assert.strictEqual(service.isHazardsControl(moveSet), false);
      assert.strictEqual(service.isPivot(moveSet), false);
      assert.strictEqual(service.isSetUpper(moveSet), false);
      assert.strictEqual(service.isPriority(moveSet), false);
      assert.strictEqual(service.isStall(moveSet), false);
      assert.strictEqual(service.isSupporter(moveSet), false);
    },
  },
];

function run(): void {
  for (const test of tests) {
    test.run();
    console.log(`PASS ${test.name}`);
  }
}

run();