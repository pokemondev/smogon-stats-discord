import assert = require('assert');
import { EmojiService } from './emojiService';

interface TestCase {
  name: string;
  run: () => Promise<void> | void;
}

function createFakeEmoji(name: string): { name: string; toString: () => string } {
  return { name, toString: () => `<:${name}:123>` };
}

function createFakeClient(emojiNames: string[]): object {
  const emojis = emojiNames.map(createFakeEmoji);
  return {
    application: {
      emojis: {
        fetch: async () => ({
          forEach: (fn: (emoji: ReturnType<typeof createFakeEmoji>) => void) => emojis.forEach(fn),
        }),
      },
    },
  };
}

const tests: TestCase[] = [
  {
    name: 'known pokemon emoji is returned directly',
    run: async () => {
      const service = new EmojiService();
      await service.initialize(createFakeClient(['pkm_pikachu', 'pkm_missingno', 'others_unknown']) as never);
      assert.strictEqual(service.getPokemonEmoji('Pikachu'), '<:pkm_pikachu:123>');
    },
  },
  {
    name: 'missingno pokemon emoji is returned directly',
    run: async () => {
      const service = new EmojiService();
      await service.initialize(createFakeClient(['pkm_pikachu', 'pkm_missingno', 'others_unknown']) as never);
      assert.strictEqual(service.getPokemonEmoji('MissingNo'), '<:pkm_missingno:123>');
    },
  },
  {
    name: 'missing pokemon emoji falls back to missingno emoji by default',
    run: async () => {
      const service = new EmojiService();
      await service.initialize(createFakeClient(['pkm_pikachu', 'pkm_missingno', 'others_unknown']) as never);
      assert.strictEqual(service.getPokemonEmoji('Missing Pokemon'), '<:pkm_missingno:123>');
    },
  },
  {
    name: 'missing item emoji falls back to unknown emoji by default',
    run: async () => {
      const service = new EmojiService();
      await service.initialize(createFakeClient(['pkm_missingno', 'item_sitrus_berry', 'others_unknown']) as never);
      assert.strictEqual(service.getItemEmoji('Missing Item'), '<:others_unknown:123>');
    },
  },
  {
    name: 'missing type emoji falls back to unknown emoji by default',
    run: async () => {
      const service = new EmojiService();
      await service.initialize(createFakeClient(['pkm_missingno', 'type_fire', 'others_unknown']) as never);
      assert.strictEqual(service.getTypeEmoji('MissingType'), '<:others_unknown:123>');
    },
  },
  {
    name: 'fallback is skipped when fallbackToUnknown is false',
    run: async () => {
      const service = new EmojiService();
      await service.initialize(createFakeClient(['pkm_pikachu', 'pkm_missingno', 'item_sitrus_berry', 'type_fire', 'others_unknown']) as never);
      assert.strictEqual(service.getPokemonEmoji('Missing Pokemon', false), undefined);
      assert.strictEqual(service.getItemEmoji('Missing Item', false), undefined);
      assert.strictEqual(service.getTypeEmoji('MissingType', false), undefined);
    },
  },
  {
    name: 'pokemon fallback is skipped when pkm_missingno is not loaded',
    run: async () => {
      const service = new EmojiService();
      await service.initialize(createFakeClient(['pkm_pikachu', 'others_unknown']) as never);
      assert.strictEqual(service.getPokemonEmoji('Missing Pokemon'), undefined);
    },
  },
  {
    name: 'getLoadedEmojiCount includes the unknown emoji when loaded',
    run: async () => {
      const service = new EmojiService();
      await service.initialize(createFakeClient(['pkm_pikachu', 'pkm_missingno', 'item_sitrus_berry', 'type_fire', 'others_unknown']) as never);
      assert.strictEqual(service.getLoadedEmojiCount(), 5);
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
