import assert = require('assert');
import { ItemEmoji } from './itemEmoji';
import { PokemonEmoji } from './pokemonEmoji';
import { MoveSetUsage, SmogonFormat } from '../models/smogonUsage';

interface TestCase {
  name: string;
  run: () => Promise<void> | void;
}

class FakeSmogonStats {
  constructor(private readonly moveSetsByFormat: Record<string, MoveSetUsage[]>) {
  }

  public async getMoveSets(format: SmogonFormat): Promise<MoveSetUsage[]> {
    return this.moveSetsByFormat[`${format.generation}/${format.meta}`] ?? [];
  }
}

function createMoveSet(name: string, items: Array<{ name: string; percentage: number }>): MoveSetUsage {
  return {
    name,
    abilities: [],
    items,
    spreads: [],
    moves: [],
    teraTypes: [],
    teamMates: [],
    checksAndCounters: [],
  };
}

const tests: TestCase[] = [
  {
    name: 'item emoji keys match the requested discord naming format',
    run: () => {
      assert.strictEqual(ItemEmoji.toEmojiName('Eviolite'), 'item_eviolite');
      assert.strictEqual(ItemEmoji.toEmojiName('Choice Scarf'), 'item_choice_scarf');
      assert.strictEqual(ItemEmoji.toEmojiName('Heavy-Duty Boots'), 'item_heavy_duty_boots');
      assert.strictEqual(ItemEmoji.toEmojiName('Life Orb'), 'item_life_orb');
    },
  },
  {
    name: 'item minisprite urls preserve the forum minisprites filename convention',
    run: () => {
      assert.strictEqual(
        ItemEmoji.toMinispriteUrl('Eviolite'),
        'https://www.smogon.com/forums/media/minisprites/eviolite.png',
      );
      assert.strictEqual(
        ItemEmoji.toMinispriteUrl('Choice Scarf'),
        'https://www.smogon.com/forums/media/minisprites/choice-scarf.png',
      );
      assert.strictEqual(
        ItemEmoji.toMinispriteUrl('Heavy-Duty Boots'),
        'https://www.smogon.com/forums/media/minisprites/heavy-duty-boots.png',
      );
    },
  },
  {
    name: 'buildRoster deduplicates items across formats and ignores Other and Others',
    run: async () => {
      const stats = new FakeSmogonStats({
        'gen9/vgc2026regf': [
          createMoveSet('Incineroar', [
            { name: 'Sitrus Berry', percentage: 45.0 },
            { name: 'Safety Goggles', percentage: 30.0 },
            { name: 'Other', percentage: 25.0 },
          ]),
          createMoveSet('Rillaboom', [
            { name: 'Choice Band', percentage: 60.0 },
            { name: 'Others', percentage: 40.0 },
          ]),
        ],
        'gen9/vgc2026regi': [
          createMoveSet('Incineroar', [
            { name: 'Sitrus Berry', percentage: 50.0 },
            { name: 'Assault Vest', percentage: 30.0 },
          ]),
        ],
        'gen9/ubers': [
          createMoveSet('Koraidon', [
            { name: 'Choice Scarf', percentage: 55.0 },
          ]),
        ],
        'gen9/ou': [
          createMoveSet('Gholdengo', [
            { name: 'Choice Specs', percentage: 70.0 },
          ]),
        ],
        'gen9/uu': [],
        'gen9/ru': [],
        'gen9/nu': [],
      });

      const roster = await ItemEmoji.buildRoster(stats as never);

      const emojiNames = roster.entries.map(e => e.emojiName);
      assert.ok(emojiNames.includes('item_sitrus_berry'), 'Expected item_sitrus_berry');
      assert.ok(emojiNames.includes('item_safety_goggles'), 'Expected item_safety_goggles');
      assert.ok(emojiNames.includes('item_choice_band'), 'Expected item_choice_band');
      assert.ok(emojiNames.includes('item_assault_vest'), 'Expected item_assault_vest');
      assert.ok(emojiNames.includes('item_choice_scarf'), 'Expected item_choice_scarf');
      assert.ok(emojiNames.includes('item_choice_specs'), 'Expected item_choice_specs');

      assert.ok(!emojiNames.includes('item_other'), 'Expected Other to be ignored');
      assert.ok(!emojiNames.includes('item_others'), 'Expected Others to be ignored');

      const uniqueKeys = new Set(roster.entries.map(e => e.emojiKey));
      assert.strictEqual(uniqueKeys.size, roster.entries.length, 'Expected no duplicate emoji keys');
    },
  },
  {
    name: 'item roster entries use correct structure',
    run: async () => {
      const stats = new FakeSmogonStats({
        'gen9/vgc2026regf': [
          createMoveSet('Incineroar', [
            { name: 'Choice Scarf', percentage: 50.0 },
          ]),
        ],
        'gen9/vgc2026regi': [],
        'gen9/ubers': [],
        'gen9/ou': [],
        'gen9/uu': [],
        'gen9/ru': [],
        'gen9/nu': [],
      });

      const roster = await ItemEmoji.buildRoster(stats as never);

      assert.strictEqual(roster.entries.length, 1);
      const entry = roster.entries[0];
      assert.strictEqual(entry.itemName, 'Choice Scarf');
      assert.strictEqual(entry.emojiKey, 'choice_scarf');
      assert.strictEqual(entry.emojiName, 'item_choice_scarf');
      assert.strictEqual(entry.minispriteUrl, 'https://www.smogon.com/forums/media/minisprites/choice-scarf.png');
    },
  },
  {
    name: 'item prefix is item and pokemon prefix is pkm to avoid key collisions',
    run: () => {
      assert.strictEqual(ItemEmoji.Prefix, 'item');
      assert.strictEqual(PokemonEmoji.Prefix, 'pkm');
      assert.notStrictEqual(ItemEmoji.Prefix, PokemonEmoji.Prefix);
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
