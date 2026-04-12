import { PokemonSet } from './smogonSets';
import { SmogonFormat } from './smogonUsage';

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
  members: PokemonSet[];
}

export interface VgcResolvedTeam {
  format: SmogonFormat;
  team: VgcTeam;
}