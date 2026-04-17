import { Direction } from '../models/common';
import { Pokemon } from '../models/pokemon';
import { PokemonUsage } from '../models/smogonUsage';

type WithUsage = { usage: PokemonUsage };
type WithPokemon = { pokemon: Pokemon };

export function compareByUsage(left: PokemonUsage, right: PokemonUsage): number {
  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  if (left.usageRaw !== right.usageRaw) {
    return right.usageRaw - left.usageRaw;
  }

  return left.name.localeCompare(right.name);
}

export function compareCandidatesByUsage(left: WithUsage, right: WithUsage): number {
  return compareByUsage(left.usage, right.usage);
}

export function compareCandidatesBySpeed(
  left: WithUsage & WithPokemon,
  right: WithUsage & WithPokemon,
  direction: Direction,
): number {
  if (left.pokemon.baseStats.spe !== right.pokemon.baseStats.spe) {
    return direction === Direction.Ascending
      ? left.pokemon.baseStats.spe - right.pokemon.baseStats.spe
      : right.pokemon.baseStats.spe - left.pokemon.baseStats.spe;
  }

  return compareCandidatesByUsage(left, right);
}

export function compareCandidatesByStat(
  left: WithUsage & WithPokemon,
  right: WithUsage & WithPokemon,
  getStat: (pokemon: Pokemon) => number,
  direction: Direction,
): number {
  const leftStat = getStat(left.pokemon);
  const rightStat = getStat(right.pokemon);

  if (leftStat !== rightStat) {
    return direction === Direction.Ascending
      ? leftStat - rightStat
      : rightStat - leftStat;
  }

  return compareCandidatesByUsage(left, right);
}
