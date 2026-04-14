import assert = require('assert');
import { ConfigHelper } from '../config/configHelper';
import { ColorService } from '../pokemon/colorService';
import { PokemonDb } from '../pokemon/pokemonDb';
import { VgcResolvedTeam } from '../models/vgc';
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
      { name: 'Charizard', item: 'Choice Specs', ability: 'Solar Power', teraType: 'Fire', level: 50, nature: 'Timid', evs: { hp: 4, sa: 252, sp: 252 }, moves: ['Heat Wave', 'Air Slash', 'Protect', 'Solar Beam'] },
      { name: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', teraType: 'Grass', level: 50, nature: 'Careful', evs: { hp: 252, df: 76, sd: 180 }, moves: ['Fake Out', 'Flare Blitz', 'Parting Shot', 'Knock Off'] },
      { name: 'Amoonguss', item: 'Rocky Helmet', ability: 'Regenerator', teraType: 'Water', level: 50, nature: 'Bold', evs: { hp: 236, df: 156, sd: 116 }, ivs: { at: 0, sp: 0 }, moves: ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect'] },
      { name: 'Dragonite', item: 'Loaded Dice', ability: 'Inner Focus', teraType: 'Normal', level: 50, nature: 'Adamant', evs: { hp: 36, at: 252, sp: 220 }, moves: ['Extreme Speed', 'Scale Shot', 'Stomping Tantrum', 'Protect'] },
      { name: 'Whimsicott', item: 'Focus Sash', ability: 'Prankster', teraType: 'Ghost', level: 50, nature: 'Timid', evs: { hp: 4, sa: 252, sp: 252 }, ivs: { at: 0 }, moves: ['Moonblast', 'Tailwind', 'Encore', 'Protect'] },
      { name: 'Zamazenta', item: 'Clear Amulet', ability: 'Dauntless Shield', teraType: 'Steel', level: 50, nature: 'Jolly', evs: { hp: 4, at: 252, sp: 252 }, moves: ['Behemoth Bash', 'Body Press', 'Wide Guard', 'Protect'] },
    ],
  };
}

function createResolvedTeam(teamId: string, meta: string = 'vgc2026regi'): VgcResolvedTeam {
  return {
    format: { generation: 'gen9', meta },
    team: createSampleTeam(teamId, 'Sample Team'),
  };
}

function getNumericColor(color: unknown): number {
  return Number.parseInt(String(color).replace('#', ''), 16);
}

class FakeChatInputCommandInteraction {
  public readonly commandName = 'vgc';
  public readonly user = { tag: 'test-user' };
  public readonly createdTimestamp = Date.now();
  public deferred = false;
  public replied = false;
  public readonly calls: InteractionCall[] = [];

  constructor(
    private readonly strings: Record<string, string | undefined>,
    private readonly subcommand: 'teams' | 'team-details' = 'teams',
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

const config = ConfigHelper.loadAndValidate({ loadEnvironment: false });
const pokemonDb = new PokemonDb();

const tests: TestCase[] = [
  {
    name: 'command data includes the team-details subcommand with a required team-id option',
    run: async () => {
      const command = new VgcCommand({ pokemonDb } as never);
      const json = command.data.toJSON();
      const subcommand = json.options?.find(option => option.name === 'team-details') as {
        options?: Array<{ name: string; required?: boolean; description?: string; type?: number }>;
      } | undefined;
      const teamIdOption = subcommand?.options?.find(option => option.name === 'team-id');

      assert.ok(subcommand, 'Expected team-details subcommand to be registered.');
      assert.ok(teamIdOption, 'Expected a required team-id option on team-details.');
      assert.strictEqual(teamIdOption?.description, 'VGC team id');
      assert.strictEqual(teamIdOption?.type, 3);
      assert.strictEqual(teamIdOption?.required, true);
    },
  },
  {
    name: 'teams renders member lists, ID labels, two-column separators, and footer links',
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
          getTeamById: () => undefined,
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
      assert.strictEqual(embed.fields[0].value, 'Charizard\nIncineroar\nAmoonguss\nDragonite\nWhimsicott\nZamazenta');
      assert.strictEqual(embed.fields[2].name, '\u200b');
      assert.strictEqual(embed.fields[2].inline, false);
    },
  },
  {
    name: 'teams render application emojis when available',
    run: async () => {
      const command = new VgcCommand({
        pokemonDb,
        pokemonEmojis: {
          formatPokemonDisplayName: (name: string) => name === 'Charizard' ? '<:charizard:123> Charizard' : name,
        },
        vgcTeams: {
          getTeams: () => [
            createSampleTeam('I1280', 'Sample Team 1'),
          ],
          getTeamsByPokemon: () => [],
          getTeamById: () => undefined,
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction({});

      await command.execute(interaction as never);

      const editReplyCall = interaction.calls.find(call => call.name === 'editReply');
      const payload = editReplyCall?.payload as { embeds: Array<{ toJSON?: () => any }> };
      const embed = payload.embeds[0].toJSON ? payload.embeds[0].toJSON() : payload.embeds[0];

      assert.strictEqual(embed.fields[0].value, '<:charizard:123> Charizard\nIncineroar\nAmoonguss\nDragonite\nWhimsicott\nZamazenta');
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
          getTeamById: () => undefined,
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
          getTeamById: () => undefined,
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
          getTeamById: () => undefined,
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
  {
    name: 'team-details renders six Smogon-style sets in two columns and uses the most used team member for embed color and image',
    run: async () => {
      const command = new VgcCommand({
        pokemonDb,
        smogonStats: {
          getUsages: async () => [
            { rank: 1, name: 'Incineroar', usageRaw: 25.1 },
            { rank: 2, name: 'Zamazenta', usageRaw: 20.4 },
          ],
        },
        vgcTeams: {
          getTeams: () => [],
          getTeamsByPokemon: () => [],
          getTeamById: () => createResolvedTeam('I1280'),
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction({ 'team-id': 'i1280' }, 'team-details');

      await command.execute(interaction as never);

      assert.deepStrictEqual(interaction.calls.map(call => call.name), ['deferReply', 'editReply']);

      const editReplyCall = interaction.calls.find(call => call.name === 'editReply');
      const payload = editReplyCall?.payload as { content: string; embeds: Array<{ toJSON?: () => any }> };
      const embed = payload.embeds[0].toJSON ? payload.embeds[0].toJSON() : payload.embeds[0];
      const incineroar = pokemonDb.getPokemon('Incineroar');
      assert.ok(incineroar, 'Expected Incineroar in the pokemon database.');

      assert.strictEqual(payload.content, '**__VGC Team Details:__** I1280');
      assert.strictEqual(embed.title, 'VGC 2026 Reg. I - Sample Team');
      assert.strictEqual(embed.color, getNumericColor(ColorService.getColorForType(incineroar.type1)));
      assert.ok((embed.thumbnail?.url ?? '').toLowerCase().includes('incineroar'));
      assert.strictEqual(embed.fields[0].name, 'Charizard');
      assert.strictEqual(embed.fields[0].inline, true);
      assert.ok(embed.fields[0].value.includes('```Charizard @ Choice Specs'));
      assert.ok(embed.fields[0].value.includes('Ability: Solar Power'));
      assert.ok(embed.fields[0].value.includes('- Heat Wave'));
      assert.ok(embed.fields[3].value.includes('IVs: 0 Atk / 0 Spe'));
      assert.ok(embed.fields[3].value.includes('Bold Nature'));
      assert.strictEqual(embed.fields[2].name, '\u200b');
      assert.strictEqual(embed.fields[5].name, '\u200b');
      assert.strictEqual(embed.fields.filter((field: { inline?: boolean }) => field.inline).length, 6);
    },
  },
  {
    name: 'team-details falls back to the first team member when usage data is unavailable',
    run: async () => {
      const command = new VgcCommand({
        pokemonDb,
        smogonStats: {
          getUsages: async () => {
            throw new Error('missing usage data');
          },
        },
        vgcTeams: {
          getTeams: () => [],
          getTeamsByPokemon: () => [],
          getTeamById: () => createResolvedTeam('I1280'),
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction({ 'team-id': 'I1280' }, 'team-details');

      await command.execute(interaction as never);

      const editReplyCall = interaction.calls.find(call => call.name === 'editReply');
      const payload = editReplyCall?.payload as { embeds: Array<{ toJSON?: () => any }> };
      const embed = payload.embeds[0].toJSON ? payload.embeds[0].toJSON() : payload.embeds[0];
      const charizard = pokemonDb.getPokemon('Charizard');
      assert.ok(charizard, 'Expected Charizard in the pokemon database.');

      assert.strictEqual(embed.color, getNumericColor(ColorService.getColorForType(charizard.type1)));
      assert.ok((embed.thumbnail?.url ?? '').toLowerCase().includes('charizard'));
    },
  },
  {
    name: 'team-details replies immediately when the team id cannot be resolved',
    run: async () => {
      const command = new VgcCommand({
        pokemonDb,
        smogonStats: {
          getUsages: async () => [],
        },
        vgcTeams: {
          getTeams: () => [],
          getTeamsByPokemon: () => [],
          getTeamById: () => undefined,
        },
      } as never);
      const interaction = new FakeChatInputCommandInteraction({ 'team-id': 'missing' }, 'team-details');

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