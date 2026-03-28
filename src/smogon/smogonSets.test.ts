import assert = require('assert');
import { PokemonDb } from '../pokemon/pokemonDb';
import { SmogonSets } from './smogonSets';
import { SmogonFormat } from './usageModels';

interface TestCase {
  name: string;
  run: () => void;
}

const pokemonDb = new PokemonDb();
const smogonSets = new SmogonSets(pokemonDb);

function getSets(pokemonName: string, format: SmogonFormat) {
  const pokemon = pokemonDb.getPokemon(pokemonName);
  assert.ok(pokemon, `Expected Pokemon '${pokemonName}' to exist in the local database.`);
  return smogonSets.get(pokemon, format);
}

function getStoredSetNames(generation: string, pokemonName: string): string[] {
  const generationSets = (smogonSets as any).setsDb.get(generation);
  assert.ok(generationSets, `Expected sets database to contain generation '${generation}'.`);

  const pokemonSets = generationSets.get(pokemonName);
  assert.ok(pokemonSets, `Expected loaded sets for '${pokemonName}' in '${generation}'.`);
  return pokemonSets.map((set: { name: string }) => set.name);
}

const tests: TestCase[] = [
  {
    name: 'loads ou sets across every supported generation',
    run: () => {
      const cases = [
        { pokemon: 'Alomomola', format: { generation: 'gen6', meta: 'ou' } as SmogonFormat },
        { pokemon: 'Amoonguss', format: { generation: 'gen7', meta: 'ou' } as SmogonFormat },
        { pokemon: 'Amoonguss', format: { generation: 'gen8', meta: 'ou' } as SmogonFormat },
        { pokemon: 'Incineroar', format: { generation: 'gen9', meta: 'ou' } as SmogonFormat },
      ];

      cases.forEach(testCase => {
        const sets = getSets(testCase.pokemon, testCase.format);
        assert.ok(
          sets.length > 0,
          `Expected OU sets for ${testCase.pokemon} in ${testCase.format.generation}.`
        );
        assert.ok(sets.every(set => set.format.generation === testCase.format.generation && set.format.meta === testCase.format.meta));
      });
    }
  },
  {
    name: 'loads supported vgc seasons from local set snapshots',
    run: () => {
      const cases = [
        { pokemon: 'Amoonguss', format: { generation: 'gen7', meta: 'vgc2019' } as SmogonFormat, prefix: 'VGC 2019' },
        { pokemon: 'Amoonguss', format: { generation: 'gen8', meta: 'vgc2021' } as SmogonFormat, prefix: 'VGC 2021' },
        { pokemon: 'Incineroar', format: { generation: 'gen9', meta: 'vgc2026regi' } as SmogonFormat, prefix: 'VGC 2025 Reg I' },
      ];

      cases.forEach(testCase => {
        const sets = getSets(testCase.pokemon, testCase.format);
        assert.ok(
          sets.length > 0,
          `Expected VGC sets for ${testCase.pokemon} in ${testCase.format.generation} ${testCase.format.meta}.`
        );
        assert.ok(sets.every(set => set.name.startsWith(testCase.prefix)), `Expected every set to start with '${testCase.prefix}'.`);
      });
    }
  },
  {
    name: 'drops unsupported side formats and unsupported vgc years while loading sets',
    run: () => {
      const aegislashBladeNames = getStoredSetNames('gen8', 'Aegislash-Blade');
      assert.ok(aegislashBladeNames.some(name => name.startsWith('OU ')));
      assert.strictEqual(aegislashBladeNames.some(name => name.startsWith('1v1 ')), false);
      assert.strictEqual(aegislashBladeNames.some(name => name.startsWith('National Dex ')), false);

      const amoongussGen8Names = getStoredSetNames('gen8', 'Amoonguss');
      assert.ok(amoongussGen8Names.some(name => name.startsWith('VGC 2021')));
      assert.strictEqual(amoongussGen8Names.some(name => name.startsWith('VGC 2022')), false);
    }
  },
  {
    name: 'returns no regf sets until the local gen9 snapshots include them',
    run: () => {
      const sets = getSets('Incineroar', { generation: 'gen9', meta: 'vgc2026regf' });
      assert.deepStrictEqual(sets, []);
    }
  }
];

function run(): void {
  tests.forEach(test => {
    test.run();
    console.log(`PASS ${test.name}`);
  });
}

try {
  run();
}
catch (error) {
  console.error(error);
  process.exit(1);
}