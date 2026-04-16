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

export const RoleDefinitions: BattleRoleDefinition[] = [
  { key: 'StrongAttackers', displayName: 'Strong Attackers', rankingType: 'strong-attackers' },
  { key: 'SetUpper', displayName: 'Set-uppers', rankingType: 'preset' },
  { key: 'Priority', displayName: 'Priorities', rankingType: 'preset' },
  { key: 'Fast', displayName: 'Fast', rankingType: 'fast' },
  { key: 'Pivot', displayName: 'Pivot', rankingType: 'preset' },
  { key: 'Supporters', displayName: 'Supporters', rankingType: 'supporters' },
  { key: 'WeatherSetters', displayName: 'Weather setters', rankingType: 'preset' },
  { key: 'StrongDefenders', displayName: 'Strong Defenders', rankingType: 'strong-defenders' },
  { key: 'SpeedControl', displayName: 'Speed Control', rankingType: 'preset' },
  { key: 'TrickRoom', displayName: 'Trick Room', rankingType: 'trick-room' },
  { key: 'Tailwind', displayName: 'Tailwind', rankingType: 'tailwind' },
  { key: 'HazardsControl', displayName: 'Hazards Control', rankingType: 'preset' },
  { key: 'Stall', displayName: 'Stall', rankingType: 'preset' },
];

export const SmogonMetaRoleOrder: BattleRoleKey[] = [
  'StrongAttackers',
  'SetUpper',
  'Priority',
  'Fast',
  'Pivot',
  'SpeedControl',
  'HazardsControl',
  'StrongDefenders',
  'Stall',
  'WeatherSetters',
];

export const VgcMetaRoleOrder: BattleRoleKey[] = [
  'StrongAttackers',
  'SetUpper',
  'Priority',
  'Supporters',
  'WeatherSetters',
  'StrongDefenders',
  'SpeedControl',
  'TrickRoom',
  'Tailwind',
];

export enum Direction {
  Ascending = 'ascending',
  Descending = 'descending',
}

export interface MetaStateRoleEntry {
  roleName: string;
  pokemonNames: string[];
}