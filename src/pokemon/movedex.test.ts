import assert = require('assert');
import { Movedex } from './movedex';
import { MoveCategory } from '../models/moves';
import { PokemonType } from '../models/pokemon';

interface TestCase {
  name: string;
  run: () => void;
}

const movedex = new Movedex();

const tests: TestCase[] = [
  {
    name: 'returns correct fields for an exact move name match',
    run: () => {
      const move = movedex.getMove('Earthquake');
      assert.ok(move, "Expected 'Earthquake' to be found.");
      assert.strictEqual(move.name, 'Earthquake');
      assert.strictEqual(move.type, PokemonType.Ground);
      assert.strictEqual(move.category, MoveCategory.Physical);
      assert.strictEqual(move.power, 100);
      assert.strictEqual(move.pp, 10);
      assert.strictEqual(move.accuracy, 100);
      assert.strictEqual(move.priority, 0);
      assert.ok(Array.isArray(move.flags));
    }
  },
  {
    name: 'resolves a move via fuzzy matching when name has a typo',
    run: () => {
      const move = movedex.getMove('Earthquak');
      assert.ok(move, "Expected fuzzy match for 'Earthquak' to resolve.");
      assert.strictEqual(move.name, 'Earthquake');
    }
  },
  {
    name: 'returns undefined for an unrecognised move name',
    run: () => {
      const move = movedex.getMove('DefinitelyNotARealMove');
      assert.strictEqual(move, undefined, "Expected undefined for unknown move name.");
    }
  },
  {
    name: 'status move has power 0 and MoveCategory.Status',
    run: () => {
      const move = movedex.getMove('Acid Armor');
      assert.ok(move, "Expected 'Acid Armor' to be found.");
      assert.strictEqual(move.category, MoveCategory.Status);
      assert.strictEqual(move.power, 0);
      assert.strictEqual(move.type, PokemonType.Poison);
    }
  },
  {
    name: 'lookup is case-insensitive for exact matches',
    run: () => {
      const move = movedex.getMove('earthquake');
      assert.ok(move, "Expected lowercase exact match to resolve.");
      assert.strictEqual(move.name, 'Earthquake');
    }
  },
  {
    name: 'returns correct fields for a Special move',
    run: () => {
      const move = movedex.getMove('10,000,000 Volt Thunderbolt');
      assert.ok(move, "Expected '10,000,000 Volt Thunderbolt' to be found.");
      assert.strictEqual(move.category, MoveCategory.Special);
      assert.strictEqual(move.type, PokemonType.Electric);
      assert.strictEqual(move.power, 195);
      assert.strictEqual(move.pp, 1);
      assert.deepStrictEqual(move.flags, []);
    }
  }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`PASS: ${test.name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${test.name}`);
    console.error(err);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
}
