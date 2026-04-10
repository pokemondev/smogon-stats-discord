import assert = require('assert');
import { ConfigHelper } from '../config/configHelper';
import { PokemonDb } from '../pokemon/pokemonDb';
import { VgcCommand } from './vgcCommand';

process.env.BOT_NAME = process.env.BOT_NAME || 'Smogon Stats';
process.env.TOKEN = process.env.TOKEN || 'test-token';
process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

type InteractionCall = {
  name: 'reply' | 'deferReply' | 'editReply' | 'followUp';
  payload?: unknown;
};

function createSampleTeam(teamId: string, description: string) {
  return {
    teamId,
    description,
    owner: 'Owner',
    teamLink: 'https://pokepast.es/example',
    hasEvs: false,
    sourceType: 'Extracted',
    rentalCode: 'None',
    date: '6 Apr 2026',
    event: 'Event',
    rank: 1,
    members: [
      { name: 'Charizard', item: 'Item', ability: 'Ability', teraType: 'Fire', moves: [] },
      { name: 'Incineroar', item: 'Item', ability: 'Ability', teraType: 'Fire', moves: [] },
      { name: 'Amoonguss', item: 'Item', ability: 'Ability', teraType: 'Grass', moves: [] },
      { name: 'Dragonite', item: 'Item', ability: 'Ability', teraType: 'Normal', moves: [] },
      { name: 'Whimsicott', item: 'Item', ability: 'Ability', teraType: 'Fairy', moves: [] },
      { name: 'Zamazenta', item: 'Item', ability: 'Ability', teraType: 'Steel', moves: [] },
    ],
  };
}

class FakeChatInputCommandInteraction {
  public readonly commandName = 'vgc';
  public readonly user = { tag: 'test-user' };
  public readonly createdTimestamp = Date.now();
  public deferred = false;
  public replied = false;
  public readonly calls: InteractionCall[] = [];

  constructor(private readonly strings: Record<string, string | undefined>) {
  }

  public readonly options = {
    getSubcommand: (_required?: boolean) => 'teams',
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

const config = ConfigHelper.loadAndValidate({ loadEnvironment: false });
const pokemonDb = new PokemonDb();

const tests: TestCase[] = [
  {
    name: 'teams renders code-block members, ID labels, two-column separators, and footer links',
    run: async () => {
      const command = new VgcCommand({
        pokemonDb,
        vgcTeams: {
          getTeams: () => [
            createSampleTeam('I1280', 'Sample Team 1'),
            createSampleTeam('I1279', 'Sample Team 2'),
            createSampleTeam('I1278', 'Sample Team 3'),
          ],
          getTeamsByPokemon: () => [],
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction({});

      await command.execute(interaction as never);

      const editReplyCall = interaction.calls.find(call => call.name === 'editReply');
      assert.ok(editReplyCall, 'Expected an editReply call.');

      const payload = editReplyCall?.payload as { embeds: Array<{ toJSON?: () => any }> };
      const embed = payload.embeds[0].toJSON ? payload.embeds[0].toJSON() : payload.embeds[0];

      assert.strictEqual(embed.footer?.text, 'Check more details at x.com/VGCPastes and limitlessvgc.com');
      assert.strictEqual(embed.fields[0].name, '#1 Sample Team 1 (ID I1280)');
      assert.strictEqual(embed.fields[0].value, '```\nCharizard\nIncineroar\nAmoonguss\nDragonite\nWhimsicott\nZamazenta\n```');
      assert.strictEqual(embed.fields[2].name, '\u200b');
      assert.strictEqual(embed.fields[2].inline, false);
    },
  },
  {
    name: 'teams normalizes pokemon1 with fuzzy matching before querying the service',
    run: async () => {
      const calls: Array<{ pokemon1: string; pokemon2?: string }> = [];
      const command = new VgcCommand({
        pokemonDb,
        vgcTeams: {
          getTeams: () => [],
          getTeamsByPokemon: (_format: { generation: string; meta: string }, pokemon1: string, pokemon2?: string) => {
            calls.push({ pokemon1, pokemon2 });
            return [
              createSampleTeam('I1280', 'Sample Team'),
            ];
          },
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction({
        pokemon1: 'charzard',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].pokemon1, 'Charizard');
      assert.strictEqual(calls[0].pokemon2, undefined);
    },
  },
  {
    name: 'teams promotes pokemon2 to pokemon1 when pokemon1 is omitted',
    run: async () => {
      const calls: Array<{ format: { generation: string; meta: string }; pokemon1: string; pokemon2?: string }> = [];
      const command = new VgcCommand({
        pokemonDb,
        vgcTeams: {
          getTeams: () => [],
          getTeamsByPokemon: (format: { generation: string; meta: string }, pokemon1: string, pokemon2?: string) => {
            calls.push({ format, pokemon1, pokemon2 });
            return [
              createSampleTeam('I1280', 'Sample Team'),
            ];
          },
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction({
        pokemon2: 'charizard',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].format.meta, 'vgc2026regf');
      assert.strictEqual(calls[0].pokemon1, 'Charizard');
      assert.strictEqual(calls[0].pokemon2, undefined);
    },
  },
  {
    name: 'teams replies immediately when a pokemon filter cannot be resolved',
    run: async () => {
      const command = new VgcCommand({
        pokemonDb,
        vgcTeams: {
          getTeams: () => [],
          getTeamsByPokemon: () => [],
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction({
        pokemon1: 'missingno',
      });

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), ['reply']);
      assert.strictEqual(interaction.deferred, false);
    },
  },
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