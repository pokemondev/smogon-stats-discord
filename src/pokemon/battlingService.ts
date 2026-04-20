import { FileHelper } from '../common/fileHelper';
import { compareCandidatesByStat, compareCandidatesBySpeed, compareCandidatesByUsage, compareByUsage } from '../common/sortingHelper';
import { BattleRoleDefinition, BattleRoleFitStatus, BattleRoleKey, MetaStateRoleEntry, PresetBattleRoleKey } from '../models/battling';
import { Direction } from '../models/common';
import { BaseStatTarget, FormatStatBucket } from '../models/statsRanking';
import { MoveCategory } from '../models/moves';
import { Pokemon } from '../models/pokemon';
import { MoveSetUsage, PokemonUsage, SmogonFormat } from '../models/smogonUsage';
import { FormatStats } from '../smogon/formatStats';
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
const isSupporterMoveUsageThreshold = 85;

export class BattlingService {
  private readonly rolePresets = {} as Record<PresetBattleRoleKey, Set<string>>; // set at runtime based on file data (loadFileData)

  private readonly roleCheckers: Partial<Record<BattleRoleKey, (format: SmogonFormat, moveSet: MoveSetUsage) => Promise<BattleRoleFitStatus>>> = {
    Supporters: (_format, moveSet) => Promise.resolve(this.ToRoleFitStatus(this.isSupporter(moveSet))),
    TrickRoom: (_format, moveSet) => Promise.resolve(this.ToRoleFitStatus(this.usesMove(moveSet, 'Trick Room'))),
    Tailwind: (_format, moveSet) => Promise.resolve(this.ToRoleFitStatus(this.usesMove(moveSet, 'Tailwind'))),
    Stall: (format, moveSet) => this.isStall(format, moveSet),
  };

  constructor(
    private readonly pokemonDb: PokemonDb = new PokemonDb(),
    private readonly movedex: Movedex = new Movedex(),
    private readonly formatStats: FormatStats = new FormatStats(),
  ) {
    this.loadFileData();
  }

  public async getMatchingRoles(format: SmogonFormat, moveSet: MoveSetUsage): Promise<BattleRoleDefinition[]> {
    const results = await Promise.all(
      BattleRolesHelper.getRoleDefinitions().map(async role => ({
        role,
        status: await this.hasRole(format, role.key, moveSet),
      }))
    );
    return results.filter(r => r.status !== BattleRoleFitStatus.No).map(r => r.role);
  }

  public buildMetaStateRoleEntries(
    format: SmogonFormat,
    roleKeys: BattleRoleKey[],
    usages: PokemonUsage[],
    moveSets: MoveSetUsage[],
    limit: number = 5,
  ): Promise<MetaStateRoleEntry[]> {
    const candidates = this.buildCandidates(usages, moveSets);
    if (!candidates.length) {
      return Promise.resolve([]);
    }

    return Promise.all(
      roleKeys
        .map(key => BattleRolesHelper.getRoleDefinition(key))
        .filter((role): role is BattleRoleDefinition => !!role)
        .map(async role => ({
          roleName: role.displayName,
          pokemonNames: await this.getPokemonForRole(format, role, candidates, limit),
        }))
    );
  }

  public async getRoleFitStatus(
    role: BattleRoleKey,
    format: SmogonFormat,
    pokemonName: string,
    moveSet: MoveSetUsage | undefined,
  ): Promise<BattleRoleFitStatus> {
    const definition = BattleRolesHelper.getRoleDefinition(role);
    if (!definition)
      return BattleRoleFitStatus.No;
    
    if (!moveSet)
      return BattleRoleFitStatus.No;

    switch (definition.rankingType) {
      case 'strong-attackers':
        return this.getFormatStatFitStatus(format, pokemonName, BaseStatTarget.Attacker);
      case 'fast':
        return this.getFormatStatFitStatus(format, pokemonName, BaseStatTarget.Spe);
      case 'strong-defenders':
        return this.getFormatStatFitStatus(format, pokemonName, BaseStatTarget.Defender);
      case 'stall':
        return this.getFormatStatFitStatus(format, pokemonName, BaseStatTarget.Defender);
      case 'preset':
      case 'supporters':
      case 'trick-room':
      case 'tailwind':
      default:
        return this.hasRole(format, role, moveSet);
    }
  }

  public async hasRole(format: SmogonFormat, role: BattleRoleKey, moveSet: MoveSetUsage): Promise<BattleRoleFitStatus> {
    const checker = this.roleCheckers[role];
    if (checker !== undefined) {
      return checker(format, moveSet);
    }

    if (role in this.rolePresets) {
      return this.ToRoleFitStatus(this.hasPresetRole(role as PresetBattleRoleKey, moveSet));
    }

    return BattleRoleFitStatus.No;
  }

  public async isSpeedControl(format: SmogonFormat, moveSet: MoveSetUsage): Promise<BattleRoleFitStatus> {
    return this.hasRole(format, 'SpeedControl', moveSet);
  }

  public async isWeatherSetter(format: SmogonFormat, moveSet: MoveSetUsage): Promise<BattleRoleFitStatus> {
    return this.hasRole(format, 'WeatherSetters', moveSet);
  }

  public async isHazardsControl(format: SmogonFormat, moveSet: MoveSetUsage): Promise<BattleRoleFitStatus> {
    return this.hasRole(format, 'HazardsControl', moveSet);
  }

  public async isPivot(format: SmogonFormat, moveSet: MoveSetUsage): Promise<BattleRoleFitStatus> {
    return this.hasRole(format, 'Pivot', moveSet);
  }

  public async isSetUpper(format: SmogonFormat, moveSet: MoveSetUsage): Promise<BattleRoleFitStatus> {
    return this.hasRole(format, 'SetUpper', moveSet);
  }

  public async isPriority(format: SmogonFormat, moveSet: MoveSetUsage): Promise<BattleRoleFitStatus> {
    return this.hasRole(format, 'Priority', moveSet);
  }

  public async isStall(format: SmogonFormat, moveSet: MoveSetUsage): Promise<BattleRoleFitStatus> {
    if (!this.hasPresetRole('Stall', moveSet))
      return BattleRoleFitStatus.No;

    if (!moveSet.name)
      return BattleRoleFitStatus.No;

    const pokemon = this.pokemonDb.getPokemon(moveSet.name);
    if (!pokemon)
      return BattleRoleFitStatus.No;

    const lowestTrackedThreshold = await this.formatStats.getMinimumStatForBucket(format, BaseStatTarget.Defender, FormatStatBucket.Highest50p);
    if (lowestTrackedThreshold === undefined)
      return BattleRoleFitStatus.No;

    const inDefender25p = await this.formatStats.isInBucket(format, BaseStatTarget.Defender, pokemon.baseStats, FormatStatBucket.Highest25p);
    if (inDefender25p)
      return BattleRoleFitStatus.Yes;

    const inDefender50p = await this.formatStats.isInBucket(format, BaseStatTarget.Defender, pokemon.baseStats, FormatStatBucket.Highest50p);
    return inDefender50p ? BattleRoleFitStatus.Eventually : BattleRoleFitStatus.No;
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
      //console.log(`Supporter check for ${moveSet.name}: at least one status move over usage threshold (${isSupporterMoveUsageThreshold}%) among considered moves (${consideredMoves.length} moves)`);
      return true;
    }

    const pivotMoves = consideredMoves.filter(move => this.rolePresets.Pivot.has(BattlingService.normalize(move.name)));
    const supporterMoves = new Set([...statusMoves.map(m => m.name), ...pivotMoves.map(m => m.name)]);
    //console.log(`Supporter check for ${moveSet.name}: ${supporterMoves.size} status moves out of ${consideredMoves.length} considered moves (${allMoves.length} total moves)`);
    //console.log(supporterMoves);
    return supporterMoves.size >= consideredMoves.length / 2;
  }

  // helpers
  private hasPresetRole(role: PresetBattleRoleKey, moveSet: MoveSetUsage): boolean {
    const presets = this.rolePresets[role];
    if (!presets || !presets.size) {
      return false;
    }

    return this.getMoveAndAbilityKeys(moveSet).some(key => presets.has(key));
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

  private async getPokemonForRole(
    format: SmogonFormat,
    role: BattleRoleDefinition,
    candidates: MetaStateCandidate[],
    limit: number,
  ): Promise<string[]> {
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
      case 'stall': {
        const matchResults = await Promise.all(
          candidates.map(async candidate => ({
            candidate,
            status: candidate.moveSet ? await this.hasRole(format, role.key, candidate.moveSet) : BattleRoleFitStatus.No,
          }))
        );
        return matchResults
          .filter(r => r.status !== BattleRoleFitStatus.No)
          .sort((left, right) => compareCandidatesByUsage(left.candidate, right.candidate))
          .slice(0, limit)
          .map(r => r.candidate.usage.name);
      }
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
      default: {
        const matchResults = await Promise.all(
          candidates.map(async candidate => ({
            candidate,
            status: candidate.moveSet ? await this.hasRole(format, role.key, candidate.moveSet) : BattleRoleFitStatus.No,
          }))
        );
        return matchResults
          .filter(r => r.status !== BattleRoleFitStatus.No)
          .sort((left, right) => compareCandidatesByUsage(left.candidate, right.candidate))
          .slice(0, limit)
          .map(r => r.candidate.usage.name);
      }
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

  private async getFormatStatFitStatus(
    format: SmogonFormat,
    pokemonName: string,
    statTarget: BaseStatTarget,
  ): Promise<BattleRoleFitStatus> {
    const targetPokemon = this.pokemonDb.getPokemon(pokemonName);
    if (!targetPokemon) {
      return BattleRoleFitStatus.Eventually;
    }

    const lowestTrackedThreshold = await this.formatStats.getMinimumStatForBucket(format, statTarget, FormatStatBucket.Highest50p);
    if (lowestTrackedThreshold === undefined) {
      return BattleRoleFitStatus.Eventually;
    }

    if (await this.formatStats.isInBucket(format, statTarget, targetPokemon.baseStats, FormatStatBucket.Highest25p)) {
      return BattleRoleFitStatus.Yes;
    }

    return await this.formatStats.isInBucket(format, statTarget, targetPokemon.baseStats, FormatStatBucket.Highest50p)
      ? BattleRoleFitStatus.Eventually
      : BattleRoleFitStatus.No;
  }

  private usesMove(moveSet: MoveSetUsage, moveName: string): boolean {
    const targetMove = BattlingService.normalize(moveName);
    return (moveSet.moves ?? []).some(move => BattlingService.normalize(move.name) === targetMove);
  }

  private ToRoleFitStatus(result: boolean): BattleRoleFitStatus {
    return result ? BattleRoleFitStatus.Yes : BattleRoleFitStatus.No;
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