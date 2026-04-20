import assert = require('assert');
import { AppDataSource } from '../appDataSource';
import { ConfigHelper } from '../config/configHelper';
import { MoveSetUsage, PokemonMoveSetSearch, PokemonUsage, SmogonFormat } from '../models/smogonUsage';
import { PokemonType } from '../models/pokemon';
import { MessageFlags } from 'discord.js';
import { BattleRoleFitStatus, BattleRoleKey } from '../models/battling';

process.env.BOT_NAME = process.env.BOT_NAME || 'Smogon Stats';
process.env.TOKEN = process.env.TOKEN || 'test-token';
process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

const { PokemonCommand, createPokemonCommandData } = require('./pokemonCommand') as typeof import('./pokemonCommand');

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

function createUsage(name: string, rank: number, usageRaw: number): PokemonUsage {
  return {
    name,
    rank,
    usageRaw,
    usagePercentage: usageRaw,
  };
}

function getReplyPayload(interaction: FakeChatInputCommandInteraction): { content?: string; flags?: MessageFlags } {
  const replyCall = interaction.calls.find(call => call.name === 'reply');
  assert.ok(replyCall, 'Expected a reply call.');
  return (replyCall?.payload ?? {}) as { content?: string; flags?: MessageFlags };
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

async function withStubbedMoveLookup(
  moveTypeByName: Record<string, PokemonType>,
  runTest: () => void
): Promise<void> {
  const originalGetMove = dataSource.movedex.getMove.bind(dataSource.movedex);
  dataSource.movedex.getMove = (name: string) => {
    const type = moveTypeByName[name];
    if (!type) {
      return undefined;
    }

    return { name, type } as never;
  };

  try {
    await runTest();
  }
  finally {
    dataSource.movedex.getMove = originalGetMove;
  }
}

async function withStubbedSearch(
  implementation: (format: SmogonFormat, search: PokemonMoveSetSearch) => Promise<PokemonUsage[]>,
  runTest: (command: InstanceType<typeof PokemonCommand>) => Promise<void>
): Promise<void> {
  const originalSearchPokemon = dataSource.smogonStats.searchPokemon.bind(dataSource.smogonStats);
  dataSource.smogonStats.searchPokemon = implementation;

  try {
    await runTest(new PokemonCommand(dataSource));
  }
  finally {
    dataSource.smogonStats.searchPokemon = originalSearchPokemon;
  }
}

async function withStubbedBattleRoleData(
  options: {
    moveSet?: MoveSetUsage | undefined;
    usages?: PokemonUsage[];
    getRoleFitStatus?: (role: BattleRoleKey, pokemonName: string) => BattleRoleFitStatus | Promise<BattleRoleFitStatus>;
  },
  runTest: (command: InstanceType<typeof PokemonCommand>) => Promise<void>
): Promise<void> {
  const originalGetMoveSet = dataSource.smogonStats.getMoveSet.bind(dataSource.smogonStats);
  const originalGetUsages = dataSource.smogonStats.getUsages.bind(dataSource.smogonStats);
  const originalGetRoleFitStatus = dataSource.battlingService.getRoleFitStatus.bind(dataSource.battlingService);

  dataSource.smogonStats.getMoveSet = async () => options.moveSet;
  dataSource.smogonStats.getUsages = async () => options.usages ?? [];
  dataSource.battlingService.getRoleFitStatus = async (role, format, pokemonName, _moveSet) => options.getRoleFitStatus
    ? options.getRoleFitStatus(role, pokemonName)
    : originalGetRoleFitStatus(role, format, pokemonName, _moveSet);

  try {
    await runTest(new PokemonCommand(dataSource));
  }
  finally {
    dataSource.smogonStats.getMoveSet = originalGetMoveSet;
    dataSource.smogonStats.getUsages = originalGetUsages;
    dataSource.battlingService.getRoleFitStatus = originalGetRoleFitStatus;
  }
}

async function withStubbedAbilityLookup(
  implementation: (name: string) => string | undefined,
  runTest: () => Promise<void>
): Promise<void> {
  const originalGetAbility = dataSource.pokemonDb.getAbility.bind(dataSource.pokemonDb);
  dataSource.pokemonDb.getAbility = implementation;

  try {
    await runTest();
  }
  finally {
    dataSource.pokemonDb.getAbility = originalGetAbility;
  }
}

const tests: TestCase[] = [
  {
    name: 'command data includes search subcommand with move and ability filters before format args',
    run: async () => {
      const commandData = createPokemonCommandData().toJSON();
      const options = (commandData.options ?? []) as Array<{ name: string; options?: Array<{ name: string }> }>;
      const search = options.find(option => option.name === 'search');

      assert.ok(search);
      assert.deepStrictEqual(search?.options?.map(option => option.name), ['move1', 'move2', 'ability', 'meta', 'generation']);
    }
  },
  {
    name: 'command data includes battle-roles subcommand with summary-style format args',
    run: async () => {
      const commandData = createPokemonCommandData().toJSON();
      const options = (commandData.options ?? []) as Array<{ name: string; options?: Array<{ name: string }> }>;
      const battleRoles = options.find(option => option.name === 'battle-roles');

      assert.ok(battleRoles);
      assert.deepStrictEqual(battleRoles?.options?.map(option => option.name), ['name', 'meta', 'generation']);
    }
  },
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
    name: 'battle-roles defers before editing successful responses',
    run: async () => {
      await withStubbedBattleRoleData(
        {
          moveSet: createEmptyMoveSet('Incineroar'),
          usages: [createUsage('Incineroar', 1, 22.4)],
          getRoleFitStatus: () => BattleRoleFitStatus.Yes,
        },
        async (command) => {
          const interaction = createInteraction('battle-roles', {
            name: 'incineroar',
            generation: '9',
            meta: 'ou',
          });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
        }
      );
    }
  },
  {
    name: 'search rejects empty filters before deferring',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('search', {
        generation: '9',
        meta: 'ou',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'reply' ]);
      assert.strictEqual(getReplyPayload(interaction).content, 'Provide at least one of move1, move2, or ability for /pokemon search.');
      assert.strictEqual(getReplyPayload(interaction).flags, MessageFlags.Ephemeral);
    }
  },
  {
    name: 'search rejects unknown moves before deferring',
    run: async () => {
      const command = new PokemonCommand(dataSource);
      const interaction = createInteraction('search', {
        move1: 'DefinitelyNotAMove',
        generation: '9',
        meta: 'ou',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'reply' ]);
      assert.strictEqual(getReplyPayload(interaction).content, "Could not find the provided move: 'DefinitelyNotAMove'.");
    }
  },
  {
    name: 'search rejects unknown abilities before deferring',
    run: async () => {
      await withStubbedAbilityLookup(
        () => undefined,
        async () => {
          const command = new PokemonCommand(dataSource);
          const interaction = createInteraction('search', {
            ability: 'DefinitelyNotAnAbility',
            generation: '9',
            meta: 'ou',
          });

          await command.execute(interaction as never);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'reply' ]);
          assert.strictEqual(getReplyPayload(interaction).content, "Could not find the provided ability: 'DefinitelyNotAnAbility'.");
        }
      );
    }
  },
  {
    name: 'search resolves fuzzy move and ability inputs before querying stats',
    run: async () => {
      await withStubbedAbilityLookup(
        (name: string) => name === 'Cursed Bodi' ? 'Cursed Body' : undefined,
        async () => {
          await withStubbedMoveLookup(
            {
              Protect: PokemonType.Normal,
            },
            async () => {
              await withStubbedSearch(
                async (_format, _search) => [],
                async (command) => {
                  const originalGetMove = dataSource.movedex.getMove.bind(dataSource.movedex);
                  let capturedFormat: SmogonFormat | undefined;
                  let capturedSearch: PokemonMoveSetSearch | undefined;

                  dataSource.movedex.getMove = (name: string) => {
                    if (name === 'Protectt') {
                      return { name: 'Protect', type: PokemonType.Normal } as never;
                    }

                    return originalGetMove(name);
                  };

                  dataSource.smogonStats.searchPokemon = async (format, search) => {
                    capturedFormat = format;
                    capturedSearch = search;
                    return [];
                  };

                  try {
                    const interaction = createInteraction('search', {
                      move1: 'Protectt',
                      ability: 'Cursed Bodi',
                      generation: '9',
                      meta: 'ou',
                    });

                    await command.execute(interaction as never);

                    assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
                    assert.deepStrictEqual(capturedFormat, { generation: 'gen9', meta: 'ou' });
                    assert.deepStrictEqual(capturedSearch, { move1: 'Protect', ability: 'Cursed Body' });
                  }
                  finally {
                    dataSource.movedex.getMove = originalGetMove;
                  }
                }
              );
            }
          );
        }
      );
    }
  },
  {
    name: 'search renders ranked usage results with query title',
    run: async () => {
      await withStubbedSearch(
        async () => [createUsage('Dragapult', 1, 18.84), createUsage('Gengar', 5, 9.45)],
        async (command) => {
          const interaction = createInteraction('search', {
            move1: 'Fire Blast',
            move2: 'Protect',
            generation: '9',
            meta: 'ou',
          });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          const embed = getEditReplyEmbed(interaction);

          assert.deepStrictEqual(interaction.calls.map(call => call.name), [ 'deferReply', 'editReply' ]);
          assert.strictEqual(payload.content, '**__Search:__** Top 2 matching Pokemon of OU (Gen 9)');
          assert.strictEqual(embed.title, "Pokemon using 'Fire Blast' and 'Protect'");
          assert.deepStrictEqual(getFieldNames(interaction), ['#1 Dragapult', '#2 Gengar']);
          assert.strictEqual(embed.fields[0].value, 'Usage: `18.84%`');
          assert.strictEqual(embed.fields[1].value, 'Usage: `9.45%`');
        }
      );
    }
  },
  {
    name: 'search renders application pokemon emojis when available',
    run: async () => {
      await withStubbedPokemonEmojiDisplayNames(
        {
          Dragapult: '<:dragapult:123>',
        },
        async () => {
          await withStubbedSearch(
            async () => [createUsage('Dragapult', 1, 18.84)],
            async (command) => {
              const interaction = createInteraction('search', {
                ability: 'Cursed Body',
                generation: '9',
                meta: 'ou',
              });

              await command.execute(interaction as never);

              assert.deepStrictEqual(getFieldNames(interaction), ['#1 <:dragapult:123> Dragapult']);
            }
          );
        }
      );
    }
  },
  {
    name: 'search reports no data when filters resolve but nothing matches',
    run: async () => {
      await withStubbedSearch(
        async () => [],
        async (command) => {
          const interaction = createInteraction('search', {
            move1: 'Water Pulse',
            move2: 'Protect',
            ability: 'Cursed Body',
            generation: '9',
            meta: 'ou',
          });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          assert.strictEqual(payload.content, "No Pokemon found for 'Water Pulse', 'Protect' and 'Cursed Body' ability in OU (Gen 9).");
        }
      );
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
    name: 'battle-roles renders smogon category fields with yes, maybe, and no markers',
    run: async () => {
      await withStubbedBattleRoleData(
        {
          moveSet: createEmptyMoveSet('Incineroar'),
          usages: [createUsage('Incineroar', 1, 22.4)],
          getRoleFitStatus: (role) => {
            const statuses: Partial<Record<BattleRoleKey, BattleRoleFitStatus>> = {
              StrongAttackers: BattleRoleFitStatus.Yes,
              SetUpper: BattleRoleFitStatus.No,
              Priority: BattleRoleFitStatus.No,
              Fast: BattleRoleFitStatus.Eventually,
              Pivot: BattleRoleFitStatus.Yes,
              WeatherSetters: BattleRoleFitStatus.No,
              HazardsControl: BattleRoleFitStatus.Eventually,
              SpeedControl: BattleRoleFitStatus.No,
              StrongDefenders: BattleRoleFitStatus.Yes,
              Stall: BattleRoleFitStatus.No,
            };

            return statuses[role] ?? BattleRoleFitStatus.No;
          },
        },
        async (command) => {
          const interaction = createInteraction('battle-roles', {
            name: 'incineroar',
            generation: '9',
            meta: 'ou',
          });

          await command.execute(interaction as never);

          const payload = getEditReplyPayload(interaction);
          const embed = getEditReplyEmbed(interaction);

          assert.strictEqual(payload.content, '**__Incineroar Battle Roles:__** OU (Gen 9)');
          assert.deepStrictEqual(getFieldNames(interaction), ['Offensive', 'Utility/Support', '\u200b', 'Defensive']);
          assert.strictEqual(embed.fields[0].value, '🟢 High Atk Stats\n🔴 Set-uppers\n🔴 Priority Users\n🟡 Fast');
          assert.strictEqual(embed.fields[1].value, '🟢 Pivot\n🔴 Weather Setters\n🔴 Redirection\n🟡 Hazards Control\n🔴 Stats Reducing\n🔴 Status Inflicting');
          assert.strictEqual(embed.fields[2].value, '\u200b');
          assert.strictEqual(embed.fields[3].value, '🟢 High Defs Stats\n🔴 Stall');
        }
      );
    }
  },
  {
    name: 'battle-roles filters displayed roles for vgc formats',
    run: async () => {
      await withStubbedBattleRoleData(
        {
          moveSet: createEmptyMoveSet('Incineroar'),
          usages: [createUsage('Incineroar', 1, 22.4)],
          getRoleFitStatus: () => BattleRoleFitStatus.Yes,
        },
        async (command) => {
          const interaction = createInteraction('battle-roles', {
            name: 'incineroar',
            generation: '9',
            meta: 'vgc2026regi',
          });

          await command.execute(interaction as never);

          const embed = getEditReplyEmbed(interaction);

          assert.deepStrictEqual(getFieldNames(interaction), ['Offensive', 'Utility/Support', '\u200b', 'Speed/Modes', 'Defensive']);
          assert.strictEqual(embed.fields[0].value, '🟢 High Atk Stats\n🟢 Set-uppers\n🟢 Priority Users');
          assert.strictEqual(embed.fields[1].value, '🟢 Supporter\n🟢 Weather Setters\n🟢 Redirection\n🟢 Stats Reducing\n🟢 Status Inflicting');
          assert.strictEqual(embed.fields[2].value, '\u200b');
          assert.strictEqual(embed.fields[3].value, '🟢 Speed Control\n🟢 Trick Room\n🟢 Tailwind');
          assert.strictEqual(embed.fields[4].value, '🟢 High Defs Stats');
          assert.strictEqual(embed.fields.some((field: { value: string }) => field.value.includes('Pivot')), false);
          assert.strictEqual(embed.fields.some((field: { value: string }) => field.value.includes('Hazards Control')), false);
          assert.strictEqual(embed.fields.some((field: { value: string }) => field.value.includes('Fast')), false);
          assert.strictEqual(embed.fields.some((field: { value: string }) => field.value.includes('Stall')), false);
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
  },
  {
    name: 'summary renders type emojis in Moves compact field',
    run: async () => {
      await withStubbedMoveLookup(
        {
          'Knock Off': PokemonType.Dark,
          'Fake Out': PokemonType.Normal,
        },
        async () => {
          await withStubbedTypeEmojiDisplayNames(
            {
              Dark: '<:type_dark:10>',
              Normal: '<:type_normal:11>',
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
                  moves: [
                    { name: 'Knock Off', percentage: 80.0 },
                    { name: 'Fake Out', percentage: 65.5 },
                  ],
                  items: [{ name: 'Safety Goggles', percentage: 60.0 }],
                },
              });
              (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

              await command.execute(interaction as never);

              const embed = getEditReplyEmbed(interaction);
              const movesField = embed.fields.find((field: { name: string }) => field.name === 'Moves');
              assert.ok(movesField, 'Expected a Moves field in summary embed.');
              assert.strictEqual(movesField.value, '<:type_dark:10> Knock Off: `80.00%`\n<:type_normal:11> Fake Out: `65.50%`');
            }
          );
        }
      );
    }
  },
  {
    name: 'info/moves renders type emojis in field titles',
    run: async () => {
      await withStubbedMoveLookup(
        {
          'Knock Off': PokemonType.Dark,
          'Flare Blitz': PokemonType.Fire,
        },
        async () => {
          await withStubbedTypeEmojiDisplayNames(
            {
              Dark: '<:type_dark:10>',
              Fire: '<:type_fire:12>',
            },
            async () => {
              const command = new PokemonCommand(dataSource);
              const interaction = createInteraction('info', {
                name: 'incineroar',
                category: 'moves',
                generation: '9',
                meta: 'ou',
              });

              (command as any).getMoveSetCommandData = async (query: { pokemon: any; format: any }) => ({
                format: query.format,
                pokemon: query.pokemon,
                moveSet: {
                  ...createEmptyMoveSet(query.pokemon.name),
                  moves: [
                    { name: 'Knock Off', percentage: 80.0 },
                    { name: 'Flare Blitz', percentage: 60.0 },
                  ],
                },
              });

              await command.execute(interaction as never);

              const fieldNames = getFieldNames(interaction);
              assert.strictEqual(fieldNames[0], '#1 <:type_dark:10> Knock Off');
              assert.strictEqual(fieldNames[1], '#2 <:type_fire:12> Flare Blitz');
            }
          );
        }
      );
    }
  },
  {
    name: 'moves fall back to plain name when move is not in movedex',
    run: async () => {
      await withStubbedTypeEmojiDisplayNames(
        { Dark: '<:type_dark:10>' },
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
              moves: [{ name: 'UnknownMove', percentage: 30.0 }],
              items: [{ name: 'Safety Goggles', percentage: 60.0 }],
            },
          });
          (command as any).getGeneralInfoData = async () => 'Meta: `OU`';

          await command.execute(interaction as never);

          const embed = getEditReplyEmbed(interaction);
          const movesField = embed.fields.find((field: { name: string }) => field.name === 'Moves');
          assert.ok(movesField, 'Expected a Moves field.');
          assert.strictEqual(movesField.value, 'UnknownMove: `30.00%`');
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