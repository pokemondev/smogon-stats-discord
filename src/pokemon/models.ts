export interface BaseStats {
    hp: number;
    atk: number;
    def: number;
    spA: number;
    spD: number;
    spe: number;
    tot: number;
}

export interface Pokemon {
    name: string;
    type1: PokemonType;
    type2: PokemonType;
    baseStats: BaseStats;
    tier: string;
    possiblesAbilities: string[];
    evolutions: string[];
    generation: string;
    weight: number;
    height: number;
    usage?: any;
}

export enum PokemonType {
    Bug      = "Bug",
    Dark     = "Dark",
    Dragon   = "Dragon",
    Electric = "Electric", 
    Fairy    = "Fairy",
    Fighting = "Fighting",
    Fire     = "Fire",
    Flying   = "Flying",
    Ghost    = "Ghost",
    Grass    = "Grass",
    Ground   = "Ground",
    Ice      = "Ice",
    Normal   = "Normal",
    Poison   = "Poison",
    Psychic  = "Psychic",
    Rock     = "Rock",
    Steel    = "Steel",
    Water    = "Water"
}
