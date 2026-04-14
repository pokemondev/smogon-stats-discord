import assert = require('assert');
import { PokemonEmoji } from './pokemonEmoji';
import { Pokemon } from '../models/pokemon';
import { PokemonUsage, SmogonFormat } from '../models/smogonUsage';

interface TestCase {
  name: string;
  run: () => Promise<void> | void;
}

class FakeSmogonStats {
  constructor(private readonly usageByFormat: Record<string, PokemonUsage[]>) {
  }

  public async getUsages(format: SmogonFormat, top15 = true): Promise<PokemonUsage[]> {
    assert.strictEqual(top15, false);
    return this.usageByFormat[`${format.generation}/${format.meta}`] ?? [];
  }
}

class FakePokemonDb {
  constructor(private readonly pokemonByName: Record<string, Pokemon | undefined>) {
  }

  public getPokemon(name: string): Pokemon | undefined {
    return this.pokemonByName[name];
  }
}

function createPokemon(name: string): Pokemon {
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
      spe: 1,
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

const tests: TestCase[] = [
  {
    name: 'emoji keys match the requested discord naming format',
    run: () => {
      assert.strictEqual(PokemonEmoji.toEmojiName('Pikachu'), 'pkm_pikachu');
      assert.strictEqual(PokemonEmoji.toEmojiName('Charizard-Mega-Y'), 'pkm_charizard_mega_y');
      assert.strictEqual(PokemonEmoji.toEmojiName('Chien-Pao'), 'pkm_chien_pao');
      assert.strictEqual(PokemonEmoji.toEmojiName('Flutter Mane'), 'pkm_flutter_mane');
      assert.strictEqual(PokemonEmoji.toEmojiName("Oricorio-Pa'u"), 'pkm_oricorio_pau');
    },
  },
  {
    name: 'minisprite urls preserve the xyicons filename convention',
    run: () => {
      assert.strictEqual(
        PokemonEmoji.toMinispriteUrl('Ho-Oh'),
        'https://www.smogon.com/dex/media/sprites/xyicons/ho-oh.png',
      );
      assert.strictEqual(
        PokemonEmoji.toMinispriteUrl('Charizard-Mega-Y'),
        'https://www.smogon.com/dex/media/sprites/xyicons/charizard-mega-y.png',
      );
      assert.strictEqual(
        PokemonEmoji.toMinispriteUrl("Oricorio-Pa'u"),
        'https://www.smogon.com/dex/media/sprites/xyicons/oricorio-pau.png',
      );
    },
  },
  {
    name: 'chunkIntoBatches uses sequential 8-sized groups',
    run: () => {
      const batches = PokemonEmoji.chunkIntoBatches(Array.from({ length: 17 }, (_, index) => index + 1), 8);
      assert.deepStrictEqual(batches.map(batch => batch.length), [8, 8, 1]);
      assert.deepStrictEqual(batches[0], [1, 2, 3, 4, 5, 6, 7, 8]);
      assert.deepStrictEqual(batches[2], [17]);
    },
  },
  {
    name: 'buildRoster deduplicates overlaps and records unresolved names',
    run: async () => {
      const stats = new FakeSmogonStats({
        'gen9/vgc2026regf': [
          createUsage('Urshifu-Rapid-Strike', 1, 40.1),
          createUsage('Rillaboom', 2, 32.5),
        ],
        'gen9/vgc2026regi': [
          createUsage('Rillaboom', 1, 38.4),
          createUsage('Incineroar', 2, 30.2),
        ],
        'gen9/ubers': [
          createUsage('Incineroar', 50, 5.2),
          createUsage('Unknown Form', 51, 4.8),
        ],
      });
      const pokemonDb = new FakePokemonDb({
        'Urshifu-Rapid-Strike': createPokemon('Urshifu-Rapid-Strike'),
        Rillaboom: createPokemon('Rillaboom'),
        Incineroar: createPokemon('Incineroar'),
      });

      const roster = await PokemonEmoji.buildRoster(stats as never, pokemonDb as never);

      assert.deepStrictEqual(
        roster.entries.map(entry => entry.emojiName),
        ['pkm_urshifu_rapid_strike', 'pkm_rillaboom', 'pkm_incineroar', 'pkm_unknown_form'],
      );
      assert.deepStrictEqual(roster.unresolvedNames, ['Unknown Form']);
      assert.deepStrictEqual(roster.entries[1].sourceFormats, ['gen9vgc2026regf', 'gen9vgc2026regi']);
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