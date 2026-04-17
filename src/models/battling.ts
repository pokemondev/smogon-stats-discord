export type PresetBattleRoleKey =
  | 'SpeedControl'
  | 'WeatherSetters'
  | 'HazardsControl'
  | 'Pivot'
  | 'SetUpper'
  | 'Priority'
  | 'Stall';

export type ComputedBattleRoleKey =
  | 'StrongAttackers'
  | 'Fast'
  | 'StrongDefenders'
  | 'Supporters'
  | 'TrickRoom'
  | 'Tailwind';

export type BattleRoleKey = PresetBattleRoleKey | ComputedBattleRoleKey;

export enum BattleRoleFitStatus {
  Yes = 'Yes',
  No = 'No',
  Eventually = 'Eventually',
}

export type BattleRoleRankingType =
  | 'preset'
  | 'strong-attackers'
  | 'fast'
  | 'strong-defenders'
  | 'supporters'
  | 'trick-room'
  | 'tailwind';

export interface BattleRoleDefinition {
  key: BattleRoleKey;
  displayName: string;
  rankingType: BattleRoleRankingType;
}

export interface BattleRoleCategoryEntry {
  key: BattleRoleKey;
  displayName: string;
}

export interface BattleRoleCategory {
  title: string;
  roles: BattleRoleCategoryEntry[];
}

export interface MetaStateRoleEntry {
  roleName: string;
  pokemonNames: string[];
}