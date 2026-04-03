import assert = require('assert');
import FakeTimers = require('@sinonjs/fake-timers');
import { FileHelper } from '../common/fileHelper';
import { SmogonStats } from './smogonStats';
import { SmogonFormat } from './usageModels';

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

function buildStatsFilePath(statsType: string, format: SmogonFormat): string {
  return `smogon-stats/${format.generation}/${format.meta}/${statsType}-${format.generation}${format.meta}.json`;
}

function getStatsPayload(statsType: string): any {
  if (statsType === 'leads') {
    return {
      data: {
        rows: [
          [1, 'Garchomp', 0, 0, 25.12],
          [2, 'Dragapult', 0, 0, 18.84]
        ]
      }
    };
  }

  return {
    data: {
      rows: [
        [1, 'Garchomp', 25.12],
        [2, 'Dragapult', 18.84]
      ]
    }
  };
}

async function withStubbedLoader(runTest: (calls: string[]) => Promise<void>): Promise<void> {
  const calls: string[] = [];
  const originalLoader = FileHelper.loadFileDataAsAny;

  (FileHelper as any).loadFileDataAsAny = (filename: string) => {
    calls.push(filename);
    const statsType = filename.split('/').pop().split('-')[0];
    return getStatsPayload(statsType);
  };

  try {
    await runTest(calls);
  }
  finally {
    (FileHelper as any).loadFileDataAsAny = originalLoader;
  }
}

async function withFakeClock(runTest: (clock: any) => Promise<void>): Promise<void> {
  const clock = FakeTimers.install({
    now: new Date('2026-03-26T00:00:00Z').getTime(),
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate']
  });

  try {
    await runTest(clock);
  }
  finally {
    clock.uninstall();
  }
}

function getCallCount(calls: string[], statsType: string, format: SmogonFormat): number {
  const expectedFilePath = buildStatsFilePath(statsType, format);
  return calls.filter(filePath => filePath === expectedFilePath).length;
}

async function assertReloadsAfterTtl(format: SmogonFormat, ttlInMilliseconds: number): Promise<void> {
  await withFakeClock(async (clock) => {
    await withStubbedLoader(async (calls) => {
      const stats = new SmogonStats();

      await stats.getUsages(format, false);
      await clock.tickAsync(ttlInMilliseconds - 1000);
      await stats.getUsages(format, false);

      assert.strictEqual(getCallCount(calls, 'usage', format), 1);

      await clock.tickAsync(1001);
      await stats.getUsages(format, false);

      assert.strictEqual(getCallCount(calls, 'usage', format), 2);
    });
  });
}

async function assertUsage(gen: string, metas: string[]): Promise<void> {
  const stats = new SmogonStats();
  for (const meta of metas) {
    const format = { generation: gen, meta } as SmogonFormat;
    const usages = await stats.getUsages(format, false);
    assert.ok(Array.isArray(usages), `usages should be an array for ${gen} ${meta}`);
    assert.ok(usages.length > 0, `usages should not be empty for ${gen} ${meta}`);
    assert.ok(usages[0].name, `each usage entry should have a name for ${gen} ${meta}`);
    assert.ok(typeof usages[0].usageRaw === 'number', `each usage entry should have a numeric usageRaw for ${gen} ${meta}`);
  }
}

async function assertMoveset(gen: string, metas: string[]): Promise<void> {
  const stats = new SmogonStats();
  for (const meta of metas) {
    const format = { generation: gen, meta } as SmogonFormat;
    const movesets = await stats.getMoveSets(format);
    assert.ok(Array.isArray(movesets), `movesets should be an array for ${gen} ${meta}`);
    assert.ok(movesets.length > 0, `movesets should not be empty for ${gen} ${meta}`);
    assert.ok(movesets[0].name, `each moveset entry should have a name for ${gen} ${meta}`);
    assert.ok(Array.isArray(movesets[0].moves), `each moveset entry should have a moves array for ${gen} ${meta}`);
  }
}

async function assertLeads(gen: string, metas: string[]): Promise<void> {
  const stats = new SmogonStats();
  for (const meta of metas) {
    const format = { generation: gen, meta } as SmogonFormat;
    const leads = await stats.getLeads(format);
    assert.ok(Array.isArray(leads), `leads should be an array for ${gen} ${meta}`);
    assert.ok(leads.length > 0, `leads should not be empty for ${gen} ${meta}`);
    assert.ok(leads[0].name, `each lead entry should have a name for ${gen} ${meta}`);
    assert.ok(typeof leads[0].usageRaw === 'number', `each lead entry should have a numeric usageRaw for ${gen} ${meta}`);
  }
}

const tests: TestCase[] = [
  {
    name: 'reuses cached stats inside the ttl window',
    run: async () => {
      const format = { generation: 'gen9', meta: 'ou' } as SmogonFormat;

      await withStubbedLoader(async (calls) => {
        const stats = new SmogonStats();

        await stats.getUsages(format, false);
        await stats.getUsages(format, false);

        assert.strictEqual(getCallCount(calls, 'usage', format), 1);
      });
    }
  },
  {
    name: 'keeps gen9 ou cached for ten minutes',
    run: async () => {
      await assertReloadsAfterTtl({ generation: 'gen9', meta: 'ou' }, 10 * 60 * 1000);
    }
  },
  {
    name: 'keeps gen9 vgc metas cached for ten minutes',
    run: async () => {
      await assertReloadsAfterTtl({ generation: 'gen9', meta: 'vgc2026regf' }, 10 * 60 * 1000);
      await assertReloadsAfterTtl({ generation: 'gen9', meta: 'vgc2026regi' }, 10 * 60 * 1000);
    }
  },
  {
    name: 'keeps gen8 ou and vgc cached for five minutes',
    run: async () => {
      await assertReloadsAfterTtl({ generation: 'gen8', meta: 'ou' }, 5 * 60 * 1000);
      await assertReloadsAfterTtl({ generation: 'gen8', meta: 'vgc2022' }, 5 * 60 * 1000);
    }
  },
  {
    name: 'expires every other format after two minutes',
    run: async () => {
      await assertReloadsAfterTtl({ generation: 'gen9', meta: 'uu' }, 2 * 60 * 1000);
      await assertReloadsAfterTtl({ generation: 'gen7', meta: 'ou' }, 2 * 60 * 1000);
    }
  },
  {
    name: 'keeps cache entries isolated by stats type and format',
    run: async () => {
      const ou = { generation: 'gen9', meta: 'ou' } as SmogonFormat;
      const vgc = { generation: 'gen9', meta: 'vgc2026regf' } as SmogonFormat;

      await withStubbedLoader(async (calls) => {
        const stats = new SmogonStats();

        await stats.getUsages(ou, false);
        await stats.getUsages(vgc, false);
        await stats.getLeads(ou);

        await stats.getUsages(ou, false);
        await stats.getUsages(vgc, false);
        await stats.getLeads(ou);

        assert.strictEqual(getCallCount(calls, 'usage', ou), 1);
        assert.strictEqual(getCallCount(calls, 'usage', vgc), 1);
        assert.strictEqual(getCallCount(calls, 'leads', ou), 1);
      });
    }
  },
  {
    name: 'loads explicit regulation metas from their own stats files',
    run: async () => {
      const format = { generation: 'gen9', meta: 'vgc2026regi' } as SmogonFormat;

      await withStubbedLoader(async (calls) => {
        const stats = new SmogonStats();

        await stats.getUsages(format, false);

        assert.strictEqual(getCallCount(calls, 'usage', format), 1);
      });
    }
  },
  {
    name: 'loads usage data from disk for all gen/metas',
    run: async () => {
      const gen9Metas = ['ou', 'uu', 'ru', 'nu', 'ubers', 'vgc2026regf', 'vgc2026regi'];
      const gen8Metas = ['ou', 'uu', 'ru', 'nu', 'ubers', 'vgc2022'];
      
      await assertUsage('gen9', gen9Metas);
      await assertUsage('gen8', gen8Metas);
      await assertUsage('gen7', ['ou']);
      await assertUsage('gen6', ['ou']);
    }
  },
  {
    name: 'loads leads data from disk for all gen/metas',
    run: async () => {
      const gen9Metas = ['ou', 'uu', 'ru', 'nu', 'ubers', 'vgc2026regf', 'vgc2026regi'];
      const gen8Metas = ['ou', 'uu', 'ru', 'nu', 'ubers', 'vgc2022'];

      await assertLeads('gen9', gen9Metas);
      await assertLeads('gen8', gen8Metas);
      await assertLeads('gen7', ['ou']);
      await assertLeads('gen6', ['ou']);
    }
  },
  {
    name: 'loads moveset data from disk for all gen/metas',
    run: async () => {
      const gen9Metas = ['ou', 'uu', 'ru', 'nu', 'ubers', 'vgc2026regf', 'vgc2026regi'];
      const gen8Metas = ['ou', 'uu', 'ru', 'nu', 'ubers', 'vgc2022'];
      
      await assertMoveset('gen9', gen9Metas);
      await assertMoveset('gen8', gen8Metas);
      await assertMoveset('gen7', ['ou']);
      await assertMoveset('gen6', ['ou']);
    }
  },
  {
    name: 'reports missing stats files with context',
    run: async () => {
      const stats = new SmogonStats();
      const format = { generation: 'gen9', meta: 'vgc2026' } as SmogonFormat;
      let thrownError: Error;

      try {
        await stats.getLeads(format);
        assert.fail('Expected getLeads to reject for a missing stats file.');
      }
      catch (error) {
        thrownError = error;
      }

      assert.ok(thrownError.message.indexOf('Could not load leads data for Gen 9 VGC2026.') >= 0);
      assert.ok(thrownError.message.indexOf("Could not load data file 'data/smogon-stats/gen9/vgc2026/leads-gen9vgc2026.json'") >= 0);
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