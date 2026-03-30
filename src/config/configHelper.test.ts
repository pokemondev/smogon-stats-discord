import assert = require('assert');
import { ConfigHelper } from './configHelper';

interface TestCase {
  name: string;
  run: () => void;
}

function withEnv(values: { [key: string]: string | undefined }, run: () => void): void {
  const previousValues = new Map<string, string | undefined>();

  Object.keys(values).forEach(key => {
    previousValues.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });

  try {
    run();
  }
  finally {
    previousValues.forEach((value, key) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    });
  }
}

const tests: TestCase[] = [
  {
    name: 'validates runtime bot config together with default format config',
    run: () => withEnv({
      BOT_NAME: 'Smogon Stats',
      TOKEN: 'test-token',
      COMMAND_STATS_FLUSH_EVERY: '5',
      DEFAULT_GENERATION: 'gen9',
      DEFAULT_META: 'vgc2026regf',
    }, () => {
      const config = ConfigHelper.loadAndValidate({ loadEnvironment: false });

      assert.strictEqual(config.client.botName, 'Smogon Stats');
      assert.strictEqual(config.client.token, 'test-token');
      assert.deepStrictEqual(config.defaultFormat, { generation: 'gen9', meta: 'vgc2026regf' });
      assert.deepStrictEqual(config.analytics, { flushEvery: 5 });
    })
  },
  {
    name: 'requires client id when validating command registration config',
    run: () => withEnv({
      BOT_NAME: 'Smogon Stats',
      TOKEN: 'test-token',
      CLIENT_ID: undefined,
      DEFAULT_GENERATION: 'gen9',
      DEFAULT_META: 'vgc2026regf',
    }, () => {
      assert.throws(() => ConfigHelper.loadAndValidate({ requireClientId: true, loadEnvironment: false }), /CLIENT_ID environment variable is required to register commands/);
    })
  },
  {
    name: 'fails runtime validation when bot name is missing',
    run: () => withEnv({
      BOT_NAME: undefined,
      TOKEN: 'test-token',
      DEFAULT_GENERATION: 'gen9',
      DEFAULT_META: 'vgc2026regf',
    }, () => {
      assert.throws(() => ConfigHelper.loadAndValidate({ loadEnvironment: false }), /BOT_NAME environment variable is required/);
    })
  },
  {
    name: 'fails runtime validation when token is missing',
    run: () => withEnv({
      BOT_NAME: 'Smogon Stats',
      TOKEN: undefined,
      DEFAULT_GENERATION: 'gen9',
      DEFAULT_META: 'vgc2026regf',
    }, () => {
      assert.throws(() => ConfigHelper.loadAndValidate({ loadEnvironment: false }), /TOKEN environment variable is required/);
    })
  },
  {
    name: 'uses a default analytics flush interval when not configured',
    run: () => withEnv({
      BOT_NAME: 'Smogon Stats',
      TOKEN: 'test-token',
      COMMAND_STATS_FLUSH_EVERY: undefined,
      DEFAULT_GENERATION: 'gen9',
      DEFAULT_META: 'vgc2026regf',
    }, () => {
      const config = ConfigHelper.loadAndValidate({ loadEnvironment: false });

      assert.strictEqual(config.analytics.flushEvery, 25);
    })
  },
  {
    name: 'rejects invalid analytics flush interval values',
    run: () => withEnv({
      BOT_NAME: 'Smogon Stats',
      TOKEN: 'test-token',
      COMMAND_STATS_FLUSH_EVERY: '0',
      DEFAULT_GENERATION: 'gen9',
      DEFAULT_META: 'vgc2026regf',
    }, () => {
      assert.throws(() => ConfigHelper.loadAndValidate({ loadEnvironment: false }), /COMMAND_STATS_FLUSH_EVERY/);
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