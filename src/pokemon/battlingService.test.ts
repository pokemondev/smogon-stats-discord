import assert = require('assert');
import { MoveSetUsage, PokemonUsage } from '../models/smogonUsage';
import { BattlingService } from './battlingService';
import { SmogonMetaRoleOrder, VgcMetaRoleOrder, RoleDefinitions } from '../models/battling';

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

const service = new BattlingService();

const tests: TestCase[] = [
  {
    name: 'SmogonMetaRoleOrder defines stable display order for Smogon formats',
    run: () => {
      const roleNames = SmogonMetaRoleOrder.map(key => RoleDefinitions.find(r => r.key === key)!.displayName);
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
      const roleNames = VgcMetaRoleOrder.map(key => RoleDefinitions.find(r => r.key === key)!.displayName);
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
        SmogonMetaRoleOrder,
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
        VgcMetaRoleOrder,
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
        VgcMetaRoleOrder,
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