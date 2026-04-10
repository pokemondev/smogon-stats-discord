import assert = require('assert');
import { PokemonDb } from '../pokemon/pokemonDb';
import { VgcTeams } from './vgcTeams';

process.env.DEFAULT_GENERATION = process.env.DEFAULT_GENERATION || 'gen9';
process.env.DEFAULT_META = process.env.DEFAULT_META || 'vgc2026regf';

interface TestCase {
  name: string;
  run: () => void;
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