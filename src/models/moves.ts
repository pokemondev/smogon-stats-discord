import { PokemonType } from './pokemon';

export enum MoveCategory {
  Physical = "Physical",
  Special = "Special",
  Status = "Status"
}

export interface MoveInfo {
  name: string;
  description: string;
  type: PokemonType;
  power: number;
  pp: number;
  category: MoveCategory;
  accuracy: number;
  priority: number;
  flags: string[];
}
