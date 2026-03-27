import assert = require('assert');
import { FormatConfig } from './formatConfig';

interface TestCase {
  name: string;
  run: () => void;
}

function withEnv(values: { DEFAULT_GENERATION?: string; DEFAULT_META?: string }, run: () => void): void {
  const previousGeneration = process.env.DEFAULT_GENERATION;
  const previousMeta = process.env.DEFAULT_META;

  if (values.DEFAULT_GENERATION === undefined) {
    delete process.env.DEFAULT_GENERATION;
  } else {
    process.env.DEFAULT_GENERATION = values.DEFAULT_GENERATION;
  }

  if (values.DEFAULT_META === undefined) {
    delete process.env.DEFAULT_META;
  } else {
    process.env.DEFAULT_META = values.DEFAULT_META;
  }

  try {
    run();
  }
  finally {
    if (previousGeneration === undefined) {
      delete process.env.DEFAULT_GENERATION;
    } else {
      process.env.DEFAULT_GENERATION = previousGeneration;
    }

    if (previousMeta === undefined) {
      delete process.env.DEFAULT_META;
    } else {
      process.env.DEFAULT_META = previousMeta;
    }
  }
}

const tests: TestCase[] = [
  {
    name: 'normalizes valid configured defaults',
    run: () => withEnv({ DEFAULT_GENERATION: '9', DEFAULT_META: 'uber' }, () => {
      assert.deepStrictEqual(FormatConfig.getDefaultFormat(), { generation: 'gen9', meta: 'ubers' });
    })
  },
  {
    name: 'rejects missing generation config',
    run: () => withEnv({ DEFAULT_META: 'vgc2026regf' }, () => {
      assert.throws(() => FormatConfig.getDefaultFormat(), /DEFAULT_GENERATION/);
    })
  },
  {
    name: 'rejects ambiguous vgc config',
    run: () => withEnv({ DEFAULT_GENERATION: 'gen9', DEFAULT_META: 'vgc' }, () => {
      assert.throws(() => FormatConfig.getDefaultFormat(), /concrete metagame/);
    })
  },
  {
    name: 'rejects incompatible configured format pairs',
    run: () => withEnv({ DEFAULT_GENERATION: 'gen8', DEFAULT_META: 'vgc2026regf' }, () => {
      assert.throws(() => FormatConfig.getDefaultFormat(), /do not form a supported format/);
    })
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