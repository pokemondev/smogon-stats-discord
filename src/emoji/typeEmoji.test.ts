import assert = require('assert');
import * as path from 'path';
import { TypeEmoji } from './typeEmoji';
import { PokemonType } from '../models/pokemon';

interface TestCase {
  name: string;
  run: () => void;
}

const tests: TestCase[] = [
  {
    name: 'emoji names follow the type_ prefix convention',
    run: () => {
      assert.strictEqual(TypeEmoji.toEmojiName('Fire'), 'type_fire');
      assert.strictEqual(TypeEmoji.toEmojiName('Water'), 'type_water');
      assert.strictEqual(TypeEmoji.toEmojiName('Electric'), 'type_electric');
      assert.strictEqual(TypeEmoji.toEmojiName('Stellar'), 'type_stellar');
    },
  },
  {
    name: 'emoji keys are lowercase type names',
    run: () => {
      assert.strictEqual(TypeEmoji.toEmojiKey('Fire'), 'fire');
      assert.strictEqual(TypeEmoji.toEmojiKey('Dragon'), 'dragon');
      assert.strictEqual(TypeEmoji.toEmojiKey('Stellar'), 'stellar');
    },
  },
  {
    name: 'roster covers all 18 PokemonType values plus Stellar',
    run: () => {
      const enumValues = Object.values(PokemonType) as string[];
      const expectedTypes = [...enumValues, 'Stellar'];
      const list = TypeEmoji.buildList();
      const rosterTypeNames = list.entries.map(e => e.typeName);
      assert.deepStrictEqual(rosterTypeNames.sort(), expectedTypes.sort());
    },
  },
  {
    name: 'roster produces 19 entries',
    run: () => {
      const list = TypeEmoji.buildList();
      assert.strictEqual(list.entries.length, 19);
    },
  },
  {
    name: 'roster has no duplicate emoji names',
    run: () => {
      const list = TypeEmoji.buildList();
      const names = list.entries.map(e => e.emojiName);
      const unique = new Set(names);
      assert.strictEqual(unique.size, names.length);
    },
  },  
  {
    name: 'non-Electric entries resolve to expected lowercase filenames',
    run: () => {
      const list = TypeEmoji.buildList();
      const fireEntry = list.entries.find(e => e.typeName === 'Fire');
      const stellarEntry = list.entries.find(e => e.typeName === 'Stellar');
      assert.ok(fireEntry, 'Fire entry must exist in roster');
      assert.ok(stellarEntry, 'Stellar entry must exist in roster');
      assert.ok(fireEntry.localFilePath.endsWith('fire.png'));
      assert.ok(stellarEntry.localFilePath.endsWith('stellar.png'));
    },
  },
  {
    name: 'local file paths point into res/types-icons',
    run: () => {
      const list = TypeEmoji.buildList();
      for (const entry of list.entries) {
        assert.ok(
          entry.localFilePath.includes(path.join('res', 'types-icons')),
          `Expected path to include res/types-icons, got: ${entry.localFilePath}`
        );
      }
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
