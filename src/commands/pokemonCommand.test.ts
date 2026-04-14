import assert = require('assert');
import { AppDataSource } from '../appDataSource';
import { ConfigHelper } from '../config/configHelper';
import { MoveSetUsage } from '../models/smogonUsage';

process.env.BOT_NAME = process.env.BOT_NAME || 'Smogon Stats';
process.env.TOKEN = process.env.TOKEN || 'test-token';
process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

const { PokemonCommand } = require('./pokemonCommand') as typeof import('./pokemonCommand');

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

type InteractionCall = {
  name: 'reply' | 'deferReply' | 'editReply' | 'followUp';
  payload?: unknown;
};

class FakeChatInputCommandInteraction {
  public readonly commandName = 'pokemon';
  public readonly user = { tag: 'test-user' };
  public readonly createdTimestamp = Date.now();
  public deferred = false;
  public replied = false;
  public readonly calls: InteractionCall[] = [];

  constructor(
    private readonly subcommand: string,
    private readonly strings: Record<string, string | undefined>
  ) {
  }

  public readonly options = {
    getSubcommand: (_required?: boolean) => this.subcommand,
    getString: (name: string, required?: boolean) => {
      const value = this.strings[name];
      if ((value === undefined || value === null) && required) {
        throw new Error(`Missing required option '${name}'.`);
      }

      return value ?? null;
    },
  };

  public async reply(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'reply', payload });
    this.replied = true;
  }

  public async deferReply(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'deferReply', payload });
    this.deferred = true;
  }

  public async editReply(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'editReply', payload });
  }

  public async followUp(payload?: unknown): Promise<void> {
    this.calls.push({ name: 'followUp', payload });
  }
}

const dataSource = new AppDataSource(ConfigHelper.loadAndValidate({ loadEnvironment: false }));

function createInteraction(subcommand: string, strings: Record<string, string | undefined>): FakeChatInputCommandInteraction {
  return new FakeChatInputCommandInteraction(subcommand, strings);
}

function createEmptyMoveSet(pokemonName: string): MoveSetUsage {
  return {
    name: pokemonName,
    abilities: [],
    items: [],
    spreads: [],
    moves: [],
    teraTypes: [],
    teamMates: [],
    checksAndCounters: [],
  };
}

function getEditReplyPayload(interaction: FakeChatInputCommandInteraction): { content?: string; embeds: Array<{ toJSON?: () => any }> } {
  const editReplyCall = interaction.calls.find(call => call.name === 'editReply');
  assert.ok(editReplyCall, 'Expected an editReply call.');
  return editReplyCall?.payload as { content?: string; embeds: Array<{ toJSON?: () => any }> };
}

function getEditReplyEmbed(interaction: FakeChatInputCommandInteraction): any {
  const payload = getEditReplyPayload(interaction);
  const embed = payload.embeds[0];
  return embed.toJSON ? embed.toJSON() : embed;
}

function getFieldNames(interaction: FakeChatInputCommandInteraction): string[] {
  return getEditReplyEmbed(interaction).fields.map((field: { name: string }) => field.name);
}

async function withStubbedPokemonEmojiDisplayNames(
  emojiDisplayByPokemonName: Record<string, string>,
  runTest: () => void
): Promise<void> {
  const originalGetPokemonEmoji = dataSource.emojiService.getPokemonEmoji.bind(dataSource.emojiService);
  dataSource.emojiService.getPokemonEmoji = (name: string) => emojiDisplayByPokemonName[name];

  try {
    await runTest();
  }
  finally {
    dataSource.emojiService.getPokemonEmoji = originalGetPokemonEmoji;
  }
}

async function withStubbedItemEmojiDisplayNames(
  emojiDisplayByItemName: Record<string, string>,
  runTest: () => void
): Promise<void> {
  const originalGetItemEmoji = dataSource.emojiService.getItemEmoji.bind(dataSource.emojiService);
  dataSource.emojiService.getItemEmoji = (name: string) => emojiDisplayByItemName[name];

  try {
    await runTest();
  }
  finally {
    dataSource.emojiService.getItemEmoji = originalGetItemEmoji;
  }
}

async function withStubbedTypeEmojiDisplayNames(
  emojiDisplayByTypeName: Record<string, string>,
  runTest: () => void
): Promise<void> {
  const originalGetTypeEmoji = dataSource.emojiService.getTypeEmoji.bind(dataSource.emojiService);
  dataSource.emojiService.getTypeEmoji = (name: string) => emojiDisplayByTypeName[name];

  try {
    await runTest();
  }
  finally {
    dataSource.emojiService.getTypeEmoji = originalGetTypeEmoji;
  }
}

const tests: TestCase[] = [
  {
    name: 'sets defers before editing successful responses',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('sets', {
        name: 'incineroar',
        generation: '9',
        meta: 'ou',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
    }
  },
  {
    name: 'sets replies immediately for invalid pokemon names',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('sets', {
        name: 'missingno',
        generation: '9',
        meta: 'ou',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'reply' ]);
      assert.strictEqual(interaction.deferred, false);
    }
  },
  {
    name: 'info defers before editing successful responses',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('info', {
        name: 'incineroar',
        category: 'items',
        generation: '9',
        meta: 'ou',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: createEmptyMoveSet(query.pokemon.name),
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
    }
  },
  {
    name: 'summary defers before editing successful responses',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('summary', {
        name: 'incineroar',
        generation: '9',
        meta: 'ou',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: createEmptyMoveSet(query.pokemon.name),
      });
      (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
    }
  },
  {
    name: 'info renders numbered titles while keeping standard usage values unchanged',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('info', {
        name: 'incineroar',
        category: 'items',
        generation: '9',
        meta: 'ou',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: {
          ...createEmptyMoveSet(query.pokemon.name),
          items: [
            { name: 'Safety Goggles', percentage: 42.35 },
            { name: 'Sitrus Berry', percentage: 18.5 },
          ],
        },
      });

      await command.execute(interaction as never);

      const embed = getEditReplyEmbed(interaction);
      assert.deepStrictEqual(getFieldNames(interaction), ['#1 Safety Goggles', '#2 Sitrus Berry']);
      assert.strictEqual(embed.fields[0].value, 'Usage: `42.35%`');
      assert.strictEqual(embed.fields[1].value, 'Usage: `18.50%`');
    }
  },
  {
    name: 'info renders numbered titles while keeping checks formatting unchanged',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('info', {
        name: 'incineroar',
        category: 'checks',
        generation: '9',
        meta: 'ou',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: {
          ...createEmptyMoveSet(query.pokemon.name),
          checksAndCounters: [
            { name: 'Great Tusk', percentage: 0, kOed: 51.2, switchedOut: 33.4 },
          ],
        },
      });

      await command.execute(interaction as never);

      const embed = getEditReplyEmbed(interaction);
      assert.deepStrictEqual(getFieldNames(interaction), ['#1 Great Tusk']);
      assert.strictEqual(embed.fields[0].value, 'KO-ed: `51.20%`\nSW. out: `33.40%`');
    }
  },
  {
    name: 'info renders application emojis for pokemon-name categories',
    run: async () => {
      await withStubbedPokemonEmojiDisplayNames(
        {
          'Great Tusk': '<:great_tusk:123> Great Tusk',
        },
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('info', {
            name: 'incineroar',
            category: 'checks',
            generation: '9',
            meta: 'ou',
          });

          (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
            format: query.format,
            pokemon: query.pokemon,
            moveSet: {
              ...createEmptyMoveSet(query.pokemon.name),
              checksAndCounters: [
                { name: 'Great Tusk', percentage: 0, kOed: 51.2, switchedOut: 33.4 },
              ],
            },
          });

          await command.execute(interaction as never);

          const fieldNames = getFieldNames(interaction);
          assert.strictEqual(fieldNames[0].includes('#1'), true);
          assert.strictEqual(fieldNames[0].includes('Great Tusk'), true);
        }
      );
    }
  },
  {
    name: 'summary shows Team Mates for VGC using moves-style formatting and top 4 only',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('summary', {
        name: 'incineroar',
        generation: '9',
        meta: 'vgc2026regi',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: {
          ...createEmptyMoveSet(query.pokemon.name),
          teamMates: [
            { name: 'Miraidon', percentage: 42.345 },
            { name: 'Calyrex-Shadow', percentage: 37.1 },
            { name: 'Urshifu-Rapid-Strike', percentage: 25.555 },
            { name: 'Amoonguss', percentage: 19.999 },
            { name: 'Farigiraf', percentage: 10.5 },
          ],
          checksAndCounters: [
            { name: 'Landorus-Therian', percentage: 0, kOed: 55.1, switchedOut: 24.8 },
          ],
        },
      });
      (command as any).getGeneralInfoData = async () => 'Meta: `VGC 2026 Reg. I`';

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);

      const embed = getEditReplyEmbed(interaction);
      const teamMatesField = embed.fields.find((field: { name: string; value: string }) => field.name === 'Team Mates');

      assert.ok(teamMatesField, 'Expected Team Mates field for VGC summary.');
      assert.strictEqual(embed.fields.some((field: { name: string }) => field.name === 'Counters & Checks'), false);
      assert.strictEqual(teamMatesField.value, [
        'Miraidon: `42.34%`',
        'Calyrex-Shadow: `37.10%`',
        'Urshifu-Rapid-Strike: `25.55%`',
        'Amoonguss: `20.00%`',
      ].join('\n'));
      assert.strictEqual(teamMatesField.value.includes('Farigiraf'), false);
    }
  },
  {
    name: 'summary renders application emojis in VGC Team Mates field',
    run: async () => {
      await withStubbedPokemonEmojiDisplayNames(
        {
          Miraidon: '<:miraidon:123>',
        },
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('summary', {
            name: 'incineroar',
            generation: '9',
            meta: 'vgc2026regi',
          });

          (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
            format: query.format,
            pokemon: query.pokemon,
            moveSet: {
              ...createEmptyMoveSet(query.pokemon.name),
              teamMates: [
                { name: 'Miraidon', percentage: 42.345 },
              ],
            },
          });
          (command as any).getGeneralInfoData = async () => 'Meta: `VGC 2026 Reg. I`';

          await command.execute(interaction as never);

          const embed = getEditReplyEmbed(interaction);
          const teamMatesField = embed.fields.find((field: { name: string; value: string }) => field.name === 'Team Mates');

          assert.strictEqual(teamMatesField?.value, '<:miraidon:123> Miraidon: `42.34%`');
        }
      );
    }
  },
  {
    name: 'summary keeps Counters & Checks for non-VGC formats',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('summary', {
        name: 'incineroar',
        generation: '9',
        meta: 'ou',
      });

      (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
        format: query.format,
        pokemon: query.pokemon,
        moveSet: {
          ...createEmptyMoveSet(query.pokemon.name),
          teamMates: [
            { name: 'Rillaboom', percentage: 18.75 },
          ],
          checksAndCounters: [
            { name: 'Great Tusk', percentage: 0, kOed: 51.2, switchedOut: 33.4 },
          ],
        },
      });
      (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

      await command.execute(interaction as never);

      const embed = getEditReplyEmbed(interaction);
      const countersField = embed.fields.find((field: { name: string; value: string }) => field.name === 'Counters & Checks');

      assert.ok(countersField, 'Expected Counters & Checks field for non-VGC summary.');
      assert.strictEqual(embed.fields.some((field: { name: string }) => field.name === 'Team Mates'), false);
      assert.strictEqual(countersField.value, 'Great Tusk: `KO 51.2% / SW 33.4%`');
    }
  },
  {
    name: 'summary renders application emojis in Counters & Checks field',
    run: async () => {
      await withStubbedPokemonEmojiDisplayNames(
        {
          'Great Tusk': '<:great_tusk:123>',
        },
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('summary', {
            name: 'incineroar',
            generation: '9',
            meta: 'ou',
          });

          (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
            format: query.format,
            pokemon: query.pokemon,
            moveSet: {
              ...createEmptyMoveSet(query.pokemon.name),
              checksAndCounters: [
                { name: 'Great Tusk', percentage: 0, kOed: 51.2, switchedOut: 33.4 },
              ],
            },
          });
          (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

          await command.execute(interaction as never);

          const embed = getEditReplyEmbed(interaction);
          const countersField = embed.fields.find((field: { name: string; value: string }) => field.name === 'Counters & Checks');

          assert.strictEqual(countersField?.value, '<:great_tusk:123> Great Tusk: `KO 51.2% / SW 33.4%`');
        }
      );
    }
  },
  {
    name: 'info renders application emojis for item categories when registered',
    run: async () => {
      await withStubbedItemEmojiDisplayNames(
        {
          'Safety Goggles': '<:item_safety_goggles:123>',
        },
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('info', {
            name: 'incineroar',
            category: 'items',
            generation: '9',
            meta: 'ou',
          });

          (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
            format: query.format,
            pokemon: query.pokemon,
            moveSet: {
              ...createEmptyMoveSet(query.pokemon.name),
              items: [
                { name: 'Safety Goggles', percentage: 42.35 },
                { name: 'Sitrus Berry', percentage: 18.5 },
              ],
            },
          });

          await command.execute(interaction as never);

          const fieldNames = getFieldNames(interaction);
          assert.strictEqual(fieldNames[0].includes('#1'), true);
          assert.strictEqual(fieldNames[0].includes('<:item_safety_goggles:123>'), true);
          assert.strictEqual(fieldNames[0].includes('Safety Goggles'), true);
          assert.strictEqual(fieldNames[1], '#2 Sitrus Berry');
        }
      );
    }
  },
  {
    name: 'summary renders application emojis in items summary field',
    run: async () => {
      await withStubbedItemEmojiDisplayNames(
        {
          'Choice Band': '<:item_choice_band:456>',
        },
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('summary', {
            name: 'incineroar',
            generation: '9',
            meta: 'ou',
          });

          (command as any).getMoveSetCommandData = async (query: { pokemon: { name: string }; format: { generation: string; meta: string } }) => ({
            format: query.format,
            pokemon: query.pokemon,
            moveSet: {
              ...createEmptyMoveSet(query.pokemon.name),
              items: [
                { name: 'Choice Band', percentage: 55.0 },
                { name: 'Life Orb', percentage: 22.5 },
              ],
              moves: [{ name: 'Knock Off', percentage: 90.0 }],
            },
          });
          (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

          await command.execute(interaction as never);

          const embed = getEditReplyEmbed(interaction);
          const itemsField = embed.fields.find((field: { name: string; value: string }) => field.name === 'Items');

          assert.ok(itemsField, 'Expected an Items field in the summary embed.');
          assert.strictEqual(itemsField.value, '<:item_choice_band:456> Choice Band: `55.00%`\nLife Orb: `22.50%`');
        }
      );
    }
  },
  {
    name: 'summary renders type emojis in General Info type field',
    run: async () => {
      await withStubbedTypeEmojiDisplayNames(
        {
          Fire: '<:type_fire:1>',
          Dark: '<:type_dark:2>',
        },
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('summary', {
            name: 'incineroar',
            generation: '9',
            meta: 'ou',
          });

          (command as any).getMoveSetCommandData = async (query: { pokemon: any; format: any }) => ({
            format: query.format,
            pokemon: query.pokemon,
            moveSet: createEmptyMoveSet(query.pokemon.name),
          });

          await command.execute(interaction as never);

          const embed = getEditReplyEmbed(interaction);
          const generalInfoField = embed.fields.find((field: { name: string }) => field.name === 'General Info');
          assert.ok(generalInfoField, 'Expected a General Info field.');
          assert.ok(generalInfoField.value.includes('<:type_fire:1>'), 'Expected Fire type emoji in General Info.');
          assert.ok(generalInfoField.value.includes('<:type_dark:2>'), 'Expected Dark type emoji in General Info.');
        }
      );
    }
  },
  {
    name: 'summary renders type emojis in Weak/Resist field for non-gen9 formats',
    run: async () => {
      await withStubbedTypeEmojiDisplayNames(
        {
          Rock: '<:type_rock:3>',
          Water: '<:type_water:4>',
          Ground: '<:type_ground:5>',
          Fighting: '<:type_fighting:6>',
          Fire: '<:type_fire:7>',
          Ice: '<:type_ice:8>',
          Dark: '<:type_dark:9>',
          Ghost: '<:type_ghost:10>',
          Grass: '<:type_grass:11>',
          Steel: '<:type_steel:12>',
          Normal: '<:type_normal:13>',
          Psychic: '<:type_psychic:14>',
        },
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('summary', {
            name: 'incineroar',
            generation: '8',
            meta: 'ou',
          });

          (command as any).getMoveSetCommandData = async (query: { pokemon: any; format: any }) => ({
            format: query.format,
            pokemon: query.pokemon,
            moveSet: createEmptyMoveSet(query.pokemon.name),
          });
          (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

          await command.execute(interaction as never);

          const embed = getEditReplyEmbed(interaction);
          const weakResistField = embed.fields.find((field: { name: string }) => field.name === 'Weak/Resist');
          assert.ok(weakResistField, 'Expected a Weak/Resist field for non-gen9 summary.');
          assert.ok(weakResistField.value.includes('<:type_'), 'Expected type emojis in Weak/Resist field.');
        }
      );
    }
  },
  {
    name: 'summary renders type emojis in Tera Types field for gen9 formats',
    run: async () => {
      await withStubbedTypeEmojiDisplayNames(
        {
          Fire: '<:type_fire:1>',
          Water: '<:type_water:2>',
        },
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('summary', {
            name: 'incineroar',
            generation: '9',
            meta: 'ou',
          });

          (command as any).getMoveSetCommandData = async (query: { pokemon: any; format: any }) => ({
            format: query.format,
            pokemon: query.pokemon,
            moveSet: {
              ...createEmptyMoveSet(query.pokemon.name),
              teraTypes: [
                { name: 'Fire', percentage: 45.5 },
                { name: 'Water', percentage: 30.0 },
              ],
              moves: [{ name: 'Knock Off', percentage: 90.0 }],
              items: [{ name: 'Safety Goggles', percentage: 60.0 }],
            },
          });
          (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

          await command.execute(interaction as never);

          const embed = getEditReplyEmbed(interaction);
          const teraField = embed.fields.find((field: { name: string }) => field.name === 'Tera Types');
          assert.ok(teraField, 'Expected a Tera Types field for gen9 summary.');
          assert.strictEqual(teraField.value, '<:type_fire:1> Fire: `45.50%`\n<:type_water:2> Water: `30.00%`');
        }
      );
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