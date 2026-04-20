import assert = require('assert');
import FakeTimers = require('@sinonjs/fake-timers');
import { BaseStatTarget, FormatStatBucket } from '../models/statsRanking';
import { BaseStats, Pokemon, PokemonType } from '../models/pokemon';
import { PokemonUsage, SmogonFormat } from '../models/smogonUsage';
import { FormatStats } from './formatStats';

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

function createBaseStats(stat: number, overrides: Partial<BaseStats> = {}): BaseStats {
  return {
    hp: overrides.hp ?? 50,
    atk: overrides.atk ?? stat,
    def: overrides.def ?? stat,
    spA: overrides.spA ?? stat,
    spD: overrides.spD ?? stat,
    spe: overrides.spe ?? stat,
    tot: overrides.tot ?? (50 + ((overrides.atk ?? stat) + (overrides.def ?? stat) + (overrides.spA ?? stat) + (overrides.spD ?? stat) + (overrides.spe ?? stat))),
  };
}

function createPokemon(name: string, baseStats: BaseStats): Pokemon {
  return {
    name,
    type1: PokemonType.Normal,
    type2: PokemonType.Normal,
    baseStats,
    tier: 'OU',
    possiblesAbilities: [],
    evolutions: [],
    generation: 'gen9',
    isAltForm: false,
    weight: 100,
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

function createService(options: {
  usages: PokemonUsage[];
  pokemonByName: Record<string, Pokemon | undefined>;
}): FormatStats {
  const pokemonMap = new Map(Object.entries(options.pokemonByName).map(([name, pokemon]) => [name.toLowerCase(), pokemon]));

  return new FormatStats(
    {
      getUsages: async () => options.usages,
    } as never,
    {
      getPokemon: (name: string) => pokemonMap.get(name.toLowerCase()),
    } as never,
  );
}

async function withFakeClock(runTest: (clock: any) => Promise<void>): Promise<void> {
  const clock = FakeTimers.install({
    now: new Date('2026-04-17T00:00:00Z').getTime(),
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate'],
  });

  try {
    await runTest(clock);
  }
  finally {
    clock.uninstall();
  }
}

const defaultFormat = { generation: 'gen9', meta: 'ou' } as SmogonFormat;

const percentileService = createService({
  usages: [
    createUsage('Mon1', 1, 20),
    createUsage('Mon2', 2, 19),
    createUsage('Mon3', 3, 18),
    createUsage('Mon4', 4, 17),
    createUsage('Mon5', 5, 16),
    createUsage('Mon6', 6, 15),
    createUsage('Mon7', 7, 14),
    createUsage('Mon8', 8, 13),
  ],
  pokemonByName: {
    Mon1: createPokemon('Mon1', createBaseStats(200)),
    Mon2: createPokemon('Mon2', createBaseStats(190)),
    Mon3: createPokemon('Mon3', createBaseStats(180)),
    Mon4: createPokemon('Mon4', createBaseStats(170)),
    Mon5: createPokemon('Mon5', createBaseStats(160)),
    Mon6: createPokemon('Mon6', createBaseStats(150)),
    Mon7: createPokemon('Mon7', createBaseStats(140)),
    Mon8: createPokemon('Mon8', createBaseStats(130)),
  },
});

const tests: TestCase[] = [
  {
    name: 'computes minimum thresholds for each percentile bucket from full usage data',
    run: async () => {
      assert.strictEqual(await percentileService.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest10p), 200);
      assert.strictEqual(await percentileService.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest25p), 190);
      assert.strictEqual(await percentileService.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest50p), 170);
      assert.strictEqual(await percentileService.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest75p), 150);
    },
  },
  {
    name: 'returns the strongest matching bucket for a base stat value',
    run: async () => {
      assert.strictEqual(await percentileService.getBucketForBaseStats(defaultFormat, BaseStatTarget.Spe, createBaseStats(205)), FormatStatBucket.Highest10p);
      assert.strictEqual(await percentileService.getBucketForBaseStats(defaultFormat, BaseStatTarget.Spe, createBaseStats(195)), FormatStatBucket.Highest25p);
      assert.strictEqual(await percentileService.getBucketForBaseStats(defaultFormat, BaseStatTarget.Spe, createBaseStats(175)), FormatStatBucket.Highest50p);
      assert.strictEqual(await percentileService.getBucketForBaseStats(defaultFormat, BaseStatTarget.Spe, createBaseStats(155)), FormatStatBucket.Highest75p);
      assert.strictEqual(await percentileService.getBucketForBaseStats(defaultFormat, BaseStatTarget.Spe, createBaseStats(120)), undefined);
    },
  },
  {
    name: 'uses aggregate attacker and defender targets from the stronger side',
    run: async () => {
      const aggregateService = createService({
        usages: [
          createUsage('GlassCannon', 1, 20),
          createUsage('Wall', 2, 18),
          createUsage('Balanced', 3, 15),
          createUsage('Average', 4, 12),
        ],
        pokemonByName: {
          GlassCannon: createPokemon('GlassCannon', createBaseStats(80, { atk: 95, spA: 170, def: 50, spD: 70 })),
          Wall: createPokemon('Wall', createBaseStats(70, { atk: 60, spA: 55, def: 160, spD: 145 })),
          Balanced: createPokemon('Balanced', createBaseStats(90, { atk: 110, spA: 105, def: 100, spD: 90 })),
          Average: createPokemon('Average', createBaseStats(75, { atk: 85, spA: 80, def: 85, spD: 80 })),
        },
      });

      assert.strictEqual(
        await aggregateService.getBucketForBaseStats(defaultFormat, BaseStatTarget.Attacker, createBaseStats(70, { atk: 90, spA: 171 })),
        FormatStatBucket.Highest10p,
      );
      assert.strictEqual(
        await aggregateService.getBucketForBaseStats(defaultFormat, BaseStatTarget.Defender, createBaseStats(70, { def: 90, spD: 150 })),
        FormatStatBucket.Highest50p,
      );
    },
  },
  {
    name: 'includes ties beyond the percentile boundary by using the cutoff value',
    run: async () => {
      const tiedService = createService({
        usages: [
          createUsage('Mon1', 1, 20),
          createUsage('Mon2', 2, 19),
          createUsage('Mon3', 3, 18),
          createUsage('Mon4', 4, 17),
        ],
        pokemonByName: {
          Mon1: createPokemon('Mon1', createBaseStats(200)),
          Mon2: createPokemon('Mon2', createBaseStats(180)),
          Mon3: createPokemon('Mon3', createBaseStats(180)),
          Mon4: createPokemon('Mon4', createBaseStats(120)),
        },
      });

      assert.strictEqual(await tiedService.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest50p), 180);
      assert.strictEqual(await tiedService.isInBucket(defaultFormat, BaseStatTarget.Spe, createBaseStats(180), FormatStatBucket.Highest50p), true);
    },
  },
  {
    name: 'skips usage entries that do not resolve in the Pokemon database',
    run: async () => {
      const sparseService = createService({
        usages: [
          createUsage('Known1', 1, 20),
          createUsage('Missing', 2, 19),
          createUsage('Known2', 3, 18),
          createUsage('Known3', 4, 17),
        ],
        pokemonByName: {
          Known1: createPokemon('Known1', createBaseStats(200)),
          Known2: createPokemon('Known2', createBaseStats(180)),
          Known3: createPokemon('Known3', createBaseStats(160)),
        },
      });

      assert.strictEqual(await sparseService.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest50p), 180);
    },
  },
  {
    name: 'returns undefined thresholds and false bucket checks when a format has no resolved stats data',
    run: async () => {
      const emptyService = createService({
        usages: [createUsage('Missing', 1, 10)],
        pokemonByName: {},
      });

      assert.strictEqual(await emptyService.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest25p), undefined);
      assert.strictEqual(await emptyService.getBucketForBaseStats(defaultFormat, BaseStatTarget.Spe, createBaseStats(200)), undefined);
      assert.strictEqual(await emptyService.isInBucket(defaultFormat, BaseStatTarget.Spe, createBaseStats(200), FormatStatBucket.Highest25p), false);
    },
  },
  {
    name: 'reuses cached format stats inside the shared ttl window',
    run: async () => {
      await withFakeClock(async (clock) => {
        let calls = 0;
        const stats = new FormatStats(
          {
            getUsages: async () => {
              calls += 1;
              return [createUsage('Mon1', 1, 20)];
            },
          } as never,
          {
            getPokemon: () => createPokemon('Mon1', createBaseStats(200)),
          } as never,
        );

        await stats.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest25p);
        await stats.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest25p);
        assert.strictEqual(calls, 1);

        await clock.tickAsync((10 * 60 * 1000) - 1000);
        await stats.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest25p);
        assert.strictEqual(calls, 1);

        await clock.tickAsync(1001);
        await stats.getMinimumStatForBucket(defaultFormat, BaseStatTarget.Spe, FormatStatBucket.Highest25p);
        assert.strictEqual(calls, 2);
      });
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