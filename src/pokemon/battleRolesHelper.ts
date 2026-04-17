import { BattleRoleCategory, BattleRoleDefinition, BattleRoleKey, PresetBattleRoleKey } from '../models/battling';

export class BattleRolesHelper {
  private static readonly roleDefinitions: BattleRoleDefinition[] = [
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

  private static readonly smogonMetaRoleOrder: BattleRoleKey[] = [
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

  private static readonly vgcMetaRoleOrder: BattleRoleKey[] = [
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

  private static readonly allBattleRoleCategories: BattleRoleCategory[] = [
    {
      title: 'Offensive',
      roles: [
        { key: 'StrongAttackers', displayName: 'Strong Attacker' },
        { key: 'SetUpper', displayName: 'Set-uppers' },
        { key: 'Priority', displayName: 'Priority' },
        { key: 'Fast', displayName: 'Fast' },
      ],
    },
    {
      title: 'Utility/Support',
      roles: [
        { key: 'Supporters', displayName: 'Supporter' },
        { key: 'Pivot', displayName: 'Pivot' },
        { key: 'WeatherSetters', displayName: 'Weather setter' },
        { key: 'HazardsControl', displayName: 'Hazards Control' },
      ],
    },
    {
      title: 'Speed/Modes',
      roles: [
        { key: 'SpeedControl', displayName: 'Speed Control' },
        { key: 'TrickRoom', displayName: 'Trick Room' },
        { key: 'Tailwind', displayName: 'Tailwind' },
      ],
    },
    {
      title: 'Defensive',
      roles: [
        { key: 'StrongDefenders', displayName: 'Strong Defender' },
        { key: 'Stall', displayName: 'Stall' },
      ],
    },
  ];

  public static getRoleDefinitions(): BattleRoleDefinition[] {
    return BattleRolesHelper.roleDefinitions;
  }

  public static getRoleDefinition(key: BattleRoleKey): BattleRoleDefinition | undefined {
    return BattleRolesHelper.roleDefinitions.find(role => role.key === key);
  }

  public static getMetaRoleOrder(isVgc: boolean): BattleRoleKey[] {
    return isVgc
      ? BattleRolesHelper.vgcMetaRoleOrder
      : BattleRolesHelper.smogonMetaRoleOrder;
  }

  public static getBattleRoleCategories(isVgc: boolean): BattleRoleCategory[] {
    const allowedRoles = new Set(BattleRolesHelper.getMetaRoleOrder(isVgc));
    return BattleRolesHelper.allBattleRoleCategories
      .map(category => ({
        ...category,
        roles: category.roles.filter(role => allowedRoles.has(role.key)),
      }))
      .filter(category => category.roles.length > 0);
  }

  public static getPresetRoleKeys(): PresetBattleRoleKey[] {
    return BattleRolesHelper.roleDefinitions
      .filter((role): role is BattleRoleDefinition & { key: PresetBattleRoleKey } => role.rankingType === 'preset')
      .map(role => role.key);
  }
}