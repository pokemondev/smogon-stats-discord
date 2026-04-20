export enum FormatStatBucket {
  Highest10p = 'Highest10p',
  Highest25p = 'Highest25p',
  Highest50p = 'Highest50p',
  Highest75p = 'Highest75p',
}

export const FormatStatBuckets = [
  FormatStatBucket.Highest10p,
  FormatStatBucket.Highest25p,
  FormatStatBucket.Highest50p,
  FormatStatBucket.Highest75p,
] as const;

export enum BaseStatTarget {
  Hp = 'hp',
  Atk = 'atk',
  Def = 'def',
  SpA = 'spA',
  SpD = 'spD',
  Spe = 'spe',
  Attacker = 'attacker',
  Defender = 'defender',
}

export const BaseStatTargets = [
  BaseStatTarget.Hp,
  BaseStatTarget.Atk,
  BaseStatTarget.Def,
  BaseStatTarget.SpA,
  BaseStatTarget.SpD,
  BaseStatTarget.Spe,
  BaseStatTarget.Attacker,
  BaseStatTarget.Defender,
] as const;

export type FormatStatThresholdMap = Partial<Record<FormatStatBucket, number>>;

export type FormatStatTargetThresholds = Record<BaseStatTarget, FormatStatThresholdMap>;

export interface CachedFormatStatData {
  sampleSize: number;
  thresholdsByTarget: FormatStatTargetThresholds;
}