export interface UsageData {
    name: string;
    percentage: number;
}

export interface MoveSetUsage {
    name: string;
    abilities: UsageData[];
    items: UsageData[];
    spreads: UsageData[];
    moves: UsageData[];
    teamMates: UsageData[];
    checksAndCounters: any[];
}

export interface PokemonUsage {
    rank: number;
    name: string;
    usagePercentage: number;
    usageRaw: number;
}

