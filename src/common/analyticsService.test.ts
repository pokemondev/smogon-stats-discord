import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import { AnalyticsService } from './analyticsService';
import { PokemonDb } from '../pokemon/pokemonDb';

process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

function createTempFilePath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smogon-analytics-service-'));
  return path.join(directory, 'command-stats.json');
}

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath).toString());
}

class FakeInteraction {
  constructor(
    public readonly commandName: string,
    private readonly subcommand?: string,
    private readonly strings: Record<string, string | undefined> = {},
    public readonly guildId?: string,
  ) {
  }

  public readonly options = {
    getSubcommand: (_required?: boolean) => this.subcommand ?? null,
    getString: (name: string) => this.strings[name] ?? null,
  };
}

const pokemonDb = new PokemonDb();

const tests: TestCase[] = [
  {
    name: 'loads an existing analytics snapshot from disk',
    run: async () => {
      const filePath = createTempFilePath();
      fs.writeFileSync(filePath, JSON.stringify({
        schemaVersion: 1,
        totalProcessedCommands: 3,
        commandCounts: { 'pokemon/summary': 2 },
        failedCommandCounts: { 'pokemon/summary': 1 },
        guildCommandCounts: { guild1: { 'pokemon/summary': 2 } },
        pokemonCounts: { Incineroar: 2 },
        metaCounts: { ou: 2 },
        generationCounts: { gen9: 2 },
      }, null, 2));

      const service = new AnalyticsService(pokemonDb, { flushEvery: 10, filePath });
      const snapshot = service.getSnapshot();

      assert.strictEqual(snapshot.totalProcessedCommands, 3);
      assert.strictEqual(snapshot.commandCounts['pokemon/summary'], 2);
      assert.strictEqual(snapshot.failedCommandCounts['pokemon/summary'], 1);
      assert.strictEqual(snapshot.guildCommandCounts.guild1['pokemon/summary'], 2);
      assert.strictEqual(snapshot.pokemonCounts.Incineroar, 2);
      assert.deepStrictEqual(snapshot.pokemonInfoCategoryCounts, {});
    }
  },
  {
    name: 'tracks command interactions, logs summaries, and saves snapshots',
    run: async () => {
      const filePath = createTempFilePath();
      const logs: string[] = [];
      const service = new AnalyticsService(pokemonDb, {
        flushEvery: 2,
        filePath,
        now: () => new Date('2026-03-30T12:00:00Z'),
        log: message => logs.push(message),
      });

      service.recordCommandAttempt(new FakeInteraction('pokemon', 'info', {
        name: 'incineroar',
        category: 'items',
        meta: 'ou',
        generation: '9',
      }, 'guild-1') as never);
      service.recordCommandAttempt(new FakeInteraction('stats', 'usage', {
        meta: 'ou',
        generation: '9',
      }, 'guild-1') as never);
      service.recordCommandFailure(new FakeInteraction('pokemon', 'info', {
        name: 'incineroar',
        category: 'items',
        meta: 'ou',
        generation: '9',
      }, 'guild-1') as never);

      await service.flush();

      const snapshot = service.getSnapshot();
      assert.strictEqual(snapshot.totalProcessedCommands, 2);
      assert.strictEqual(snapshot.commandCounts['pokemon/info'], 1);
      assert.strictEqual(snapshot.commandCounts['stats/usage'], 1);
      assert.strictEqual(snapshot.failedCommandCounts['pokemon/info'], 1);
      assert.strictEqual(snapshot.guildCommandCounts['guild-1']['pokemon/info'], 1);
      assert.strictEqual(snapshot.guildCommandCounts['guild-1']['stats/usage'], 1);
      assert.strictEqual(snapshot.pokemonCounts.Incineroar, 1);
      assert.strictEqual(snapshot.pokemonInfoCategoryCounts.items, 1);
      assert.strictEqual(snapshot.metaCounts.ou, 2);
      assert.strictEqual(snapshot.generationCounts.gen9, 2);
      assert.strictEqual(logs.length, 1);
      assert.ok(logs[0].indexOf('Top commands: pokemon/info=1, stats/usage=1.') >= 0);
      assert.ok(logs[0].indexOf('Top pokemon info categories: items=1.') >= 0);

      const summary = service.getSummary('guild-1');
      assert.ok(summary.indexOf('Top commands overall') >= 0);
      assert.ok(summary.indexOf('Top commands for this server') >= 0);
      assert.ok(summary.indexOf('Top pokemon info categories overall') >= 0);
      assert.strictEqual(summary.indexOf('4.'), -1);

      const persisted = readJson(filePath);
      assert.strictEqual(persisted.totalProcessedCommands, 2);
      assert.strictEqual(persisted.lastSavedAt, '2026-03-30T12:00:00.000Z');
    }
  },
  {
    name: 'skips unresolved pokemon names while still counting the command and failure',
    run: async () => {
      const filePath = createTempFilePath();
      const service = new AnalyticsService(pokemonDb, {
        flushEvery: 10,
        filePath,
      });

      const interaction = new FakeInteraction('pokemon', 'sets', {
        name: 'missingno',
        meta: 'ou',
        generation: '9',
      }, 'guild-2');

      service.recordCommandAttempt(interaction as never);
      service.recordCommandFailure(interaction as never);

      const snapshot = service.getSnapshot();
      assert.strictEqual(snapshot.commandCounts['pokemon/sets'], 1);
      assert.strictEqual(snapshot.failedCommandCounts['pokemon/sets'], 1);
      assert.strictEqual(snapshot.pokemonCounts.MissingNo, undefined);
      assert.deepStrictEqual(snapshot.pokemonInfoCategoryCounts, {});
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