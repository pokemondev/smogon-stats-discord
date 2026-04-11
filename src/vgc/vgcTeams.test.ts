import assert = require('assert');
import { PokemonDb } from '../pokemon/pokemonDb';
import { VgcTeams } from './vgcTeams';

process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

interface TestCase {
  name: string;
  run: () => void;
}

function createSampleTeam(teamId: string, description: string) {
  return {
    teamId,
    description,
    owner: 'Owner',
    teamLink: 'https://pokepast.es/example',
    hasEvs: true,
    sourceType: 'Owner',
    rentalCode: 'None',
    date: '1 Apr 2026',
    event: 'Event',
    rank: 1,
    members: [
      { name: 'Charizard', item: 'Choice Specs', ability: 'Solar Power', teraType: 'Fire', moves: ['Heat Wave', 'Air Slash', 'Protect', 'Solar Beam'] },
      { name: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', teraType: 'Grass', moves: ['Fake Out', 'Flare Blitz', 'Parting Shot', 'Knock Off'] },
      { name: 'Amoonguss', item: 'Rocky Helmet', ability: 'Regenerator', teraType: 'Water', moves: ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect'] },
      { name: 'Dragonite', item: 'Loaded Dice', ability: 'Inner Focus', teraType: 'Normal', moves: ['Extreme Speed', 'Scale Shot', 'Stomping Tantrum', 'Protect'] },
      { name: 'Whimsicott', item: 'Focus Sash', ability: 'Prankster', teraType: 'Ghost', moves: ['Moonblast', 'Tailwind', 'Encore', 'Protect'] },
      { name: 'Zamazenta', item: 'Clear Amulet', ability: 'Dauntless Shield', teraType: 'Steel', moves: ['Behemoth Bash', 'Body Press', 'Wide Guard', 'Protect'] },
    ],
  };
}

const pokemonDb = new PokemonDb();
const vgcTeams = new VgcTeams(pokemonDb);

const tests: TestCase[] = [
  {
    name: 'returns teams for a requested regulation without filters',
    run: () => {
      const teams = vgcTeams.getTeams({ generation: 'gen9', meta: 'vgc2026regi' });

      assert.ok(teams.length > 0, 'Expected local VGC teams for VGC 2026 Reg. I.');
      assert.strictEqual(teams[0].date, '7 Apr 2026');
      assert.strictEqual(teams[0].rank, 4);
      assert.strictEqual(teams[0].members.length, 6);
      assert.ok(teams.every(team => team.members.length === 6));
    },
  },
  {
    name: 'sorts teams by newest date and then by best rank',
    run: () => {
      const teams = vgcTeams.getTeams({ generation: 'gen9', meta: 'vgc2026regi' });

      assert.strictEqual(teams[0].date, '7 Apr 2026');
      assert.strictEqual(teams[0].rank, 4);
      assert.strictEqual(teams[1].date, '7 Apr 2026');
      assert.strictEqual(teams[1].rank, 4);
      assert.strictEqual(teams[2].date, '7 Apr 2026');
      assert.strictEqual(teams[2].rank, 14);
      assert.strictEqual(teams[4].date, '6 Apr 2026');
      assert.strictEqual(teams[4].rank, 1);
    },
  },
  {
    name: 'returns teams filtered by one or two pokemon using the startup index',
    run: () => {
      const format = { generation: 'gen9', meta: 'vgc2026regi' };
      const zamazentaTeams = vgcTeams.getTeamsByPokemon(format, 'Zamazenta');
      const duoTeams = vgcTeams.getTeamsByPokemon(format, 'Zamazenta', 'Calyrex-Shadow');
      const missingTeams = vgcTeams.getTeamsByPokemon(format, 'DefinitelyNotAPokemon');

      assert.ok(zamazentaTeams.length > 0, 'Expected Zamazenta to appear in local Reg. I teams.');
      assert.ok(duoTeams.length > 0, 'Expected Zamazenta + Calyrex-Shadow to appear together in local Reg. I teams.');
      assert.ok(duoTeams.every(team => team.members.some(member => member.name === 'Zamazenta')));
      assert.ok(duoTeams.every(team => team.members.some(member => member.name === 'Calyrex-Shadow')));
      assert.deepStrictEqual(missingTeams, []);
    },
  },
  {
    name: 'resolves a team by id and includes its regulation format',
    run: () => {
      const resolvedTeam = vgcTeams.getTeamById('i1280');

      assert.ok(resolvedTeam, 'Expected a VGC team to be resolved by id.');
      assert.strictEqual(resolvedTeam?.format.generation, 'gen9');
      assert.strictEqual(resolvedTeam?.format.meta, 'vgc2026regi');
      assert.strictEqual(resolvedTeam?.team.teamId, 'I1280');
      assert.strictEqual(resolvedTeam?.team.members.length, 6);
    },
  },
  {
    name: 'returns undefined for an unknown team id',
    run: () => {
      const resolvedTeam = vgcTeams.getTeamById('missing-team');

      assert.strictEqual(resolvedTeam, undefined);
    },
  },
  {
    name: 'keeps the existing default-regulation team when indexing a duplicate id later',
    run: () => {
      const service = new VgcTeams(pokemonDb) as never as {
        indexTeamId: (team: ReturnType<typeof createSampleTeam>, format: { generation: string; meta: string }) => void;
        getTeamById: (teamId: string) => { format: { generation: string; meta: string }; team: ReturnType<typeof createSampleTeam> } | undefined;
      };
      const duplicateId = 'duplicate-team-id';

      service.indexTeamId(createSampleTeam(duplicateId, 'Default Regulation Team'), { generation: 'gen9', meta: 'vgc2026regf' });
      service.indexTeamId(createSampleTeam(duplicateId, 'Later Non-Default Team'), { generation: 'gen9', meta: 'vgc2026regi' });

      const resolvedTeam = service.getTeamById(duplicateId);

      assert.ok(resolvedTeam, 'Expected duplicate team id to remain indexed.');
      assert.strictEqual(resolvedTeam?.format.meta, 'vgc2026regf');
      assert.strictEqual(resolvedTeam?.team.description, 'Default Regulation Team');
    },
  },
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