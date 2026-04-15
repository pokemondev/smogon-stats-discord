import assert = require('assert');
import { PokemonDb } from './pokemonDb';

interface TestCase {
  name: string;
  run: () => void;
}

const pokemonDb = new PokemonDb();

const tests: TestCase[] = [
  {
    name: 'ability lookup resolves exact possible ability names',
    run: () => {
      assert.strictEqual(pokemonDb.getAbility('Adaptability'), 'Adaptability');
    }
  },
  {
    name: 'ability lookup is case-insensitive for exact matches',
    run: () => {
      assert.strictEqual(pokemonDb.getAbility('cursed body'), 'Cursed Body');
    }
  },
  {
    name: 'ability lookup resolves fuzzy matches from possible abilities',
    run: () => {
      assert.strictEqual(pokemonDb.getAbility('Adaptabilty'), 'Adaptability');
    }
  },
  {
    name: 'ability lookup returns undefined for unknown abilities',
    run: () => {
      assert.strictEqual(pokemonDb.getAbility('DefinitelyNotAnAbility'), undefined);
    }
  }
];

for (const test of tests) {
  try {
    test.run();
    console.log(`PASS: ${test.name}`);
  }
  catch (error) {
    console.error(`FAIL: ${test.name}`);
    console.error(error);
    process.exit(1);
  }
}