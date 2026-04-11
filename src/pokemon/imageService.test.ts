import assert = require('assert');
import { ImageService } from './imageService';
import { Pokemon, PokemonType } from '../models/pokemon';

interface TestCase {
  name: string;
  run: () => void;
}

function createPokemon(name: string, isAltForm: boolean): Pokemon {
  return {
    name,
    type1: PokemonType.Normal,
    type2: null as never,
    baseStats: {
      hp: 1,
      atk: 1,
      def: 1,
      spA: 1,
      spD: 1,
      spe: 1,
      tot: 6,
    },
    tier: 'Unknown',
    possiblesAbilities: [],
    evolutions: [],
    generation: 'ScarletViolet',
    isAltForm,
    weight: 1,
    height: 1,
  };
}

const tests: TestCase[] = [
  {
    name: 'png removes spaces for non-alt forms',
    run: () => {
      const pokemon = createPokemon('Walking Wake', false);
      assert.strictEqual(
        ImageService.getPngUrl(pokemon),
        'https://play.pokemonshowdown.com/sprites/gen5/walkingwake.png',
      );
    },
  },
  {
    name: 'gif removes dashes for non-alt dashed forms',
    run: () => {
      const pokemon = createPokemon('Ho-Oh', false);
      assert.strictEqual(
        ImageService.getGifUrl(pokemon),
        'https://play.pokemonshowdown.com/sprites/xyani/hooh.gif',
      );
    },
  },
  {
    name: 'png keeps the first dash for one-dash alt forms',
    run: () => {
      const pokemon = createPokemon('Calyrex-Shadow', true);
      assert.strictEqual(
        ImageService.getPngUrl(pokemon),
        'https://play.pokemonshowdown.com/sprites/gen5/calyrex-shadow.png',
      );
    },
  },
  {
    name: 'gif removes remaining dashes from multi-dash alt forms',
    run: () => {
      const pokemon = createPokemon('Charizard-Mega-Y', true);
      assert.strictEqual(
        ImageService.getGifUrl(pokemon),
        'https://play.pokemonshowdown.com/sprites/xyani/charizard-megay.gif',
      );
    },
  },
  {
    name: 'gif uses the Miraidon exception url',
    run: () => {
      const pokemon = createPokemon('Miraidon', false);
      assert.strictEqual(
        ImageService.getGifUrl(pokemon),
        'https://play.pokemonshowdown.com/sprites/gen5ani/miraidon.gif',
      );
    },
  },
];

function run(): void {
  for (const test of tests) {
    test.run();
    console.log(`PASS ${test.name}`);
  }
}

run();