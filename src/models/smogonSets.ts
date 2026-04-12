import { SmogonFormat } from "./smogonUsage";

export interface PokemonSet {
  name: string
  ability: string
  item: string
  moves: string[]
  level?: number
  nature?: string
  evs?: StatsValues
  ivs?: StatsValues
  format?: SmogonFormat
  teraType?: string
}

export interface StatsValues {
  hp?: number
  at?: number
  df?: number
  sa?: number
  sd?: number
  sp?: number
}