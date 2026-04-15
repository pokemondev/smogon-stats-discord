export interface UsageData {
    name: string;
    percentage: number;
}

export interface ChecksAndCountersUsageData extends UsageData {
    name: string;
    kOed: number;
    switchedOut: number;
}

export interface MoveSetUsage {
    name: string;
    abilities: UsageData[];
    items: UsageData[];
    spreads: UsageData[];
    moves: UsageData[];
    teraTypes: UsageData[];
    teamMates: UsageData[];
    checksAndCounters: ChecksAndCountersUsageData[];
    usage?: number;
}

export interface PokemonMoveSetSearch {
    move1?: string;
    move2?: string;
    ability?: string;
}

export interface PokemonUsage {
    rank: number;
    name: string;
    usagePercentage: number;
    usageRaw: number;
}

export interface SmogonFormat {
    generation: string;
    meta: string;
}