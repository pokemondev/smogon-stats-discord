import { FileHelper } from '../common/fileHelper';
import { compareCandidatesByStat, compareCandidatesBySpeed, compareCandidatesByUsage, compareByUsage } from '../common/sortingHelper';
import { BattleRoleDefinition, BattleRoleFitStatus, BattleRoleKey, MetaStateRoleEntry, PresetBattleRoleKey } from '../models/battling';
import { Direction } from '../models/common';
import { MoveCategory } from '../models/moves';
import { Pokemon } from '../models/pokemon';
import { MoveSetUsage, PokemonUsage } from '../models/smogonUsage';
import { BattleRolesHelper } from './battleRolesHelper';
import { Movedex } from './movedex';
import { PokemonDb } from './pokemonDb';

type PresetFileData = Partial<Record<PresetBattleRoleKey, string[]>>;

type MetaStateCandidate = {
  moveSet?: MoveSetUsage;
  pokemon?: Pokemon;
  usage: PokemonUsage;
};

const statRoleUsageLimit = 100;
const strongFitThreshold = 15;
const partialFitThreshold = 30;
const isSupporterMoveUsageThreshold = 85;

export class BattlingService {
  private readonly rolePresets = {} as Record<PresetBattleRoleKey, Set<string>>; // set at runtime based on file data (loadFileData)

  private readonly roleCheckers: Partial<Record<BattleRoleKey, (moveSet: MoveSetUsage) => boolean>> = {
    Supporters: (moveSet) => this.isSupporter(moveSet),
    TrickRoom: (moveSet) => this.usesMove(moveSet, 'Trick Room'),
    Tailwind: (moveSet) => this.usesMove(moveSet, 'Tailwind'),
  };

  constructor(
    private readonly pokemonDb: PokemonDb = new PokemonDb(),
    private readonly movedex: Movedex = new Movedex(),
  ) {
    this.loadFileData();
  }

  public getMatchingRoles(moveSet: MoveSetUsage): BattleRoleDefinition[] {
    return BattleRolesHelper.getRoleDefinitions().filter(role => this.hasRole(role.key, moveSet));
  }

  public buildMetaStateRoleEntries(
    roleKeys: BattleRoleKey[],
    usages: PokemonUsage[],
    moveSets: MoveSetUsage[],
    limit: number = 5,
  ): MetaStateRoleEntry[] {
    const candidates = this.buildCandidates(usages, moveSets);
    if (!candidates.length) {
      return [];
    }

    return roleKeys
      .map(key => BattleRolesHelper.getRoleDefinition(key))
      .filter((role): role is BattleRoleDefinition => !!role)
      .map(role => ({
        roleName: role.displayName,
        pokemonNames: this.getPokemonForRole(role, candidates, limit),
      }));
  }

  public getRoleFitStatus(role: BattleRoleKey, pokemonName: string, moveSet: MoveSetUsage | undefined, usages: PokemonUsage[]): BattleRoleFitStatus {
    const definition = BattleRolesHelper.getRoleDefinition(role);
    if (!definition) {
      return BattleRoleFitStatus.No;
    }

    switch (definition.rankingType) {
      case 'strong-attackers':
        return this.getTopStatFitStatus(usages, pokemonName, pokemon => Math.max(pokemon.baseStats.atk, pokemon.baseStats.spA));
      case 'fast':
        return this.getTopStatFitStatus(usages, pokemonName, pokemon => pokemon.baseStats.spe);
      case 'strong-defenders':
        return this.getTopStatFitStatus(usages, pokemonName, pokemon => Math.max(pokemon.baseStats.def, pokemon.baseStats.spD));
      case 'preset':
      case 'supporters':
      case 'trick-room':
      case 'tailwind':
      default:
        return this.getMoveSetFitStatus(role, moveSet);
    }
  }

  public hasRole(role: BattleRoleKey, moveSet: MoveSetUsage): boolean {
    const checker = this.roleCheckers[role];
    if (checker !== undefined) {
      return checker(moveSet);
    }

    if (role in this.rolePresets) {
      return this.hasPresetRole(role as PresetBattleRoleKey, moveSet);
    }

    return false;
  }

  public isSpeedControl(moveSet: MoveSetUsage): boolean {
    return this.hasRole('SpeedControl', moveSet);
  }

  public isWeatherSetter(moveSet: MoveSetUsage): boolean {
    return this.hasRole('WeatherSetters', moveSet);
  }

  public isHazardsControl(moveSet: MoveSetUsage): boolean {
    return this.hasRole('HazardsControl', moveSet);
  }

  public isPivot(moveSet: MoveSetUsage): boolean {
    return this.hasRole('Pivot', moveSet);
  }

  public isSetUpper(moveSet: MoveSetUsage): boolean {
    return this.hasRole('SetUpper', moveSet);
  }

  public isPriority(moveSet: MoveSetUsage): boolean {
    return this.hasRole('Priority', moveSet);
  }

  public isStall(moveSet: MoveSetUsage): boolean {
    return this.hasRole('Stall', moveSet);
  }

  public isSupporter(moveSet: MoveSetUsage): boolean {
    let allMoves = (moveSet.moves ?? []).filter(m => m.name !== 'Other');
    const hasBothProtection = allMoves.some(move => move.name === 'Protect') && allMoves.some(move => move.name === 'Detect');
    if (hasBothProtection) {
      const protectMove = moveSet.moves?.find(move => move.name === 'Protect')!;
      const detectMove = moveSet.moves?.find(move => move.name === 'Detect')!;
      const protectionMoveToRemove = protectMove.percentage < detectMove.percentage ? 'Protect' : 'Detect';      
      allMoves = allMoves.filter(move => move.name !== protectionMoveToRemove);
    }

    const consideredMoves = allMoves.filter(move => !this.rolePresets.SetUpper.has(BattlingService.normalize(move.name)));
    if (!consideredMoves.length) {
      return false;
    }
    
    const statusMoves = consideredMoves.filter(move => move.name !== 'Protect' && move.name !== 'Detect' && this.movedex.getMove(move.name)?.category === MoveCategory.Status);
    const anyStatusMoveOverStatusThreshold = statusMoves.some(move => move.percentage >= isSupporterMoveUsageThreshold);
    if (anyStatusMoveOverStatusThreshold) {
      console.log(`Supporter check for ${moveSet.name}: at least one status move over usage threshold (${isSupporterMoveUsageThreshold}%) among considered moves (${consideredMoves.length} moves)`);
      return true;
    }

    const pivotMoves = consideredMoves.filter(move => this.rolePresets.Pivot.has(BattlingService.normalize(move.name)));
    const supporterMoves = new Set([...statusMoves.map(m => m.name), ...pivotMoves.map(m => m.name)]);
    console.log(`Supporter check for ${moveSet.name}: ${supporterMoves.size} status moves out of ${consideredMoves.length} considered moves (${allMoves.length} total moves)`);
    console.log(supporterMoves);
    return supporterMoves.size >= consideredMoves.length / 2;
  }

  private hasPresetRole(role: PresetBattleRoleKey, moveSet: MoveSetUsage): boolean {
    const presets = this.rolePresets[role];
    if (!presets || !presets.size) {
      return false;
    }

    return this.getMoveAndAbilityKeys(moveSet).some(key => presets.has(key));
  }

  private getMoveSetFitStatus(role: BattleRoleKey, moveSet: MoveSetUsage | undefined): BattleRoleFitStatus {
    if (!moveSet?.name) {
      return BattleRoleFitStatus.Eventually;
    }

    return this.hasRole(role, moveSet)
      ? BattleRoleFitStatus.Yes
      : BattleRoleFitStatus.No;
  }

  private buildCandidates(usages: PokemonUsage[], moveSets: MoveSetUsage[]): MetaStateCandidate[] {
    const moveSetByName = new Map(moveSets.map(moveSet => [moveSet.name.toLowerCase(), moveSet]));
    return [...usages]
      .sort((left, right) => compareByUsage(left, right))
      .map((usage) => ({
        moveSet: moveSetByName.get(usage.name.toLowerCase()),
        pokemon: this.pokemonDb.getPokemon(usage.name),
        usage,
      }));
  }

  private getPokemonForRole(role: BattleRoleDefinition, candidates: MetaStateCandidate[], limit: number): string[] {
    switch (role.rankingType) {
      case 'strong-attackers':
        return this.getTopStatPokemonNames(
          candidates,
          (pokemon) => Math.max(pokemon.baseStats.atk, pokemon.baseStats.spA),
          Direction.Descending,
          limit,
        );
      case 'fast':
        return this.getTopStatPokemonNames(
          candidates,
          (pokemon) => pokemon.baseStats.spe,
          Direction.Descending,
          limit,
        );
      case 'strong-defenders':
        return this.getTopStatPokemonNames(
          candidates,
          (pokemon) => Math.max(pokemon.baseStats.def, pokemon.baseStats.spD),
          Direction.Descending,
          limit,
        );
      case 'supporters':
        return candidates
          .filter(candidate => candidate.moveSet && this.isSupporter(candidate.moveSet))
          .sort((left, right) => compareCandidatesByUsage(left, right))
          .slice(0, limit)
          .map(candidate => candidate.usage.name);
      case 'trick-room':
        return candidates
          .filter((candidate): candidate is MetaStateCandidate & { moveSet: MoveSetUsage; pokemon: Pokemon } =>
            !!candidate.moveSet && !!candidate.pokemon && this.usesMove(candidate.moveSet, 'Trick Room')
          )
          .sort((left, right) => compareCandidatesBySpeed(left, right, Direction.Ascending))
          .slice(0, limit)
          .map(candidate => candidate.usage.name);
      case 'tailwind':
        return candidates
          .filter((candidate): candidate is MetaStateCandidate & { moveSet: MoveSetUsage; pokemon: Pokemon } =>
            !!candidate.moveSet && !!candidate.pokemon && this.usesMove(candidate.moveSet, 'Tailwind')
          )
          .sort((left, right) => compareCandidatesBySpeed(left, right, Direction.Descending))
          .slice(0, limit)
          .map(candidate => candidate.usage.name);
      case 'preset':
      default:
        return candidates
          .filter(candidate => candidate.moveSet && this.hasRole(role.key, candidate.moveSet))
          .sort((left, right) => compareCandidatesByUsage(left, right))
          .slice(0, limit)
          .map(candidate => candidate.usage.name);
    }
  }

  private getTopStatPokemonNames(
    candidates: MetaStateCandidate[],
    getStat: (pokemon: Pokemon) => number,
    direction: Direction,
    limit: number,
  ): string[] {
    return candidates
      .filter((candidate): candidate is MetaStateCandidate & { pokemon: Pokemon } => !!candidate.pokemon)
      .slice(0, statRoleUsageLimit)
      .sort((left, right) => compareCandidatesByStat(left, right, getStat, direction))
      .slice(0, limit)
      .map(candidate => candidate.usage.name);
  }

  private getTopStatFitStatus(
    usages: PokemonUsage[],
    pokemonName: string,
    getStat: (pokemon: Pokemon) => number,
  ): BattleRoleFitStatus {
    if (!usages.length) {
      return BattleRoleFitStatus.Eventually;
    }

    const targetPokemon = this.pokemonDb.getPokemon(pokemonName);
    if (!targetPokemon) {
      return BattleRoleFitStatus.Eventually;
    }

    const statValues = this.buildCandidates(usages, [])
      .filter((candidate): candidate is MetaStateCandidate & { pokemon: Pokemon } => !!candidate.pokemon)
      .slice(0, statRoleUsageLimit)
      .sort((left, right) => compareCandidatesByStat(left, right, getStat, Direction.Descending))
      .map(candidate => getStat(candidate.pokemon));

    if (!statValues.length) {
      return BattleRoleFitStatus.Eventually;
    }

    const strongFitThresholdValue = statValues[Math.min(strongFitThreshold - 1, statValues.length - 1)];
    const partialFitThresholdValue = statValues[Math.min(partialFitThreshold - 1, statValues.length - 1)];
    const targetStat = getStat(targetPokemon);

    if (targetStat >= strongFitThresholdValue) {
      return BattleRoleFitStatus.Yes;
    }

    return targetStat >= partialFitThresholdValue
      ? BattleRoleFitStatus.Eventually
      : BattleRoleFitStatus.No;
  }

  private usesMove(moveSet: MoveSetUsage, moveName: string): boolean {
    const targetMove = BattlingService.normalize(moveName);
    return (moveSet.moves ?? []).some(move => BattlingService.normalize(move.name) === targetMove);
  }

  private getMoveAndAbilityKeys(moveSet: MoveSetUsage): string[] {
    const moveKeys = (moveSet.moves ?? []).map(move => BattlingService.normalize(move.name));
    const abilityKeys = (moveSet.abilities ?? []).map(ability => BattlingService.normalize(ability.name));
    return [...moveKeys, ...abilityKeys];
  }

  private static normalize(token: string): string {
    return token.trim().toLowerCase();
  }

  private loadFileData(): void {
    const fileData = FileHelper.loadFileData<PresetFileData>('battle-roles.json');
    const presetRoleKeys = BattleRolesHelper.getPresetRoleKeys();

    for (const key of presetRoleKeys) {
      const filePresets = fileData[key] ?? [];
      this.rolePresets[key] = new Set(filePresets.map(preset => BattlingService.normalize(preset)));
    }
  }
}