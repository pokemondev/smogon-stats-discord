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

function createMoveSetLookup(): Record<string, MoveSetUsage[]> {
  const sourceFormats = PokemonEmoji.buildRosterSources()
    .map(source => `${source.format.generation}/${source.format.meta}`);
  const moveSetsByFormat = Object.fromEntries(sourceFormats.map(formatKey => [formatKey, [] as MoveSetUsage[]]));
  const vgcFormatKeys = sourceFormats.filter(formatKey => (formatKey.split('/').pop() ?? '').includes('vgc'));
  const [firstVgcFormatKey, secondVgcFormatKey] = vgcFormatKeys;

  if (firstVgcFormatKey) {
    moveSetsByFormat[firstVgcFormatKey] = [
      createMoveSet('Incineroar', [
        { name: 'Sitrus Berry', percentage: 45.0 },
        { name: 'Safety Goggles', percentage: 30.0 },
        { name: 'Other', percentage: 25.0 },
      ]),
      createMoveSet('Rillaboom', [
        { name: 'Choice Band', percentage: 60.0 },
        { name: 'Others', percentage: 40.0 },
      ]),
    ];
  }

  if (secondVgcFormatKey) {
    moveSetsByFormat[secondVgcFormatKey] = [
      createMoveSet('Incineroar', [
        { name: 'Sitrus Berry', percentage: 50.0 },
        { name: 'Assault Vest', percentage: 30.0 },
      ]),
    ];
  }

  const gen9UbersKey = sourceFormats.find(formatKey => formatKey === 'gen9/ubers');
  if (gen9UbersKey) {
    moveSetsByFormat[gen9UbersKey] = [
      createMoveSet('Koraidon', [
        { name: 'Choice Scarf', percentage: 55.0 },
      ]),
    ];
  }

  const gen9OuKey = sourceFormats.find(formatKey => formatKey === 'gen9/ou');
  if (gen9OuKey) {
    moveSetsByFormat[gen9OuKey] = [
      createMoveSet('Gholdengo', [
        { name: 'Choice Specs', percentage: 70.0 },
      ]),
    ];
  }

  return moveSetsByFormat;
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
    name: 'buildRoster deduplicates items across formats and ignores configured item names',
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
        'gen9/championsvgc2026regma': [
          createMoveSet('Incineroar', [
            { name: 'Sitrus Berry', percentage: 50.0 },
            { name: 'Assault Vest', percentage: 30.0 },
            { name: 'Silver Powder', percentage: 20.0 },
          ]),
        ],
        'gen9/ubers': [
          createMoveSet('Koraidon', [
            { name: 'Choice Scarf', percentage: 55.0 },
            { name: 'Deep Sea Tooth', percentage: 45.0 },
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

      const roster = await ItemEmoji.buildList(stats as never);

      const emojiNames = roster.entries.map(e => e.emojiName);
      assert.ok(emojiNames.includes('item_sitrus_berry'), 'Expected item_sitrus_berry');
      assert.ok(emojiNames.includes('item_safety_goggles'), 'Expected item_safety_goggles');
      assert.ok(emojiNames.includes('item_choice_band'), 'Expected item_choice_band');
      assert.ok(emojiNames.includes('item_assault_vest'), 'Expected item_assault_vest');
      assert.ok(emojiNames.includes('item_choice_scarf'), 'Expected item_choice_scarf');
      assert.ok(emojiNames.includes('item_choice_specs'), 'Expected item_choice_specs');

      assert.ok(!emojiNames.includes('item_other'), 'Expected Other to be ignored');
      assert.ok(!emojiNames.includes('item_others'), 'Expected Others to be ignored');
      assert.ok(!emojiNames.includes('item_silver_powder'), 'Expected Silver Powder to be ignored');
      assert.ok(!emojiNames.includes('item_deep_sea_tooth'), 'Expected Deep Sea Tooth to be ignored');

      const uniqueKeys = new Set(roster.entries.map(e => e.emojiKey));
      assert.strictEqual(uniqueKeys.size, roster.entries.length, 'Expected no duplicate emoji keys');
    },
  },
  {
    name: 'configured ignores match item variants with and without separators',
    run: () => {
      assert.strictEqual(ItemEmoji.shouldIgnore('SilverPowder'), true);
      assert.strictEqual(ItemEmoji.shouldIgnore('Silver Powder'), true);
      assert.strictEqual(ItemEmoji.shouldIgnore('Deep Sea Tooth'), true);
      assert.strictEqual(ItemEmoji.shouldIgnore('deep-sea-tooth'), true);
      assert.strictEqual(ItemEmoji.shouldIgnore('Choice Specs'), false);
    },
  },
  {
    name: 'item roster entries use correct structure',
    run: async () => {
      const sourceFormats = PokemonEmoji.buildRosterSources()
        .map(source => `${source.format.generation}/${source.format.meta}`);
      const moveSetsByFormat = Object.fromEntries(sourceFormats.map(formatKey => [formatKey, [] as MoveSetUsage[]]));
      const firstVgcFormatKey = sourceFormats.find(formatKey => (formatKey.split('/').pop() ?? '').includes('vgc'));

      if (firstVgcFormatKey) {
        moveSetsByFormat[firstVgcFormatKey] = [
          createMoveSet('Incineroar', [
            { name: 'Choice Scarf', percentage: 50.0 },
          ]),
        ];
      }

      const stats = new FakeSmogonStats(moveSetsByFormat);
      const roster = await ItemEmoji.buildList(stats as never);

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
