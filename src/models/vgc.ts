import { SmogonFormat } from './smogonUsage';

export interface VgcTeamMemberStatSpread {
  hp?: number;
  at?: number;
  df?: number;
  sa?: number;
  sd?: number;
  sp?: number;
}

export interface VgcTeamMember {
  name: string;
  item: string;
  ability: string;
  teraType: string;
  moves: string[];
  level?: number;
  nature?: string;
  evs?: VgcTeamMemberStatSpread;
  ivs?: VgcTeamMemberStatSpread;
}

export interface VgcTeam {
  teamId: string;
  description: string;
  owner: string;
  teamLink: string;
  hasEvs: boolean;
  sourceType: string;
  rentalCode: string;
  date: string;
  event: string;
  rank: number | null;
  members: VgcTeamMember[];
}

export interface VgcResolvedTeam {
  format: SmogonFormat;
  team: VgcTeam;
}