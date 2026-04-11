import { readdirSync } from 'fs';
import { FileHelper } from '../common/fileHelper';
import { PokemonDb } from '../pokemon/pokemonDb';
import { FormatCatalog } from '../smogon/formatCatalog';
import { SmogonFormat } from '../models/smogonUsage';
import { VgcTeam, VgcTeamMember } from '../models/vgc';

type VgcTeamsDb = Map<string, VgcTeam[]>;
type PokemonTeamsMap = Map<string, VgcTeam[]>;
type PokemonTeamsDb = Map<string, PokemonTeamsMap>;
const NullRankFallback = Number.MAX_SAFE_INTEGER;

export class VgcTeams {
  private readonly teamsDb: VgcTeamsDb = new Map();
  private readonly pokemonTeamsDb: PokemonTeamsDb = new Map();
  private readonly teamMemberKeys = new Map<VgcTeam, Set<string>>();

  constructor(private readonly pokemonDb: PokemonDb) {
    this.loadFileData();
  }

  public getTeams(format: SmogonFormat): VgcTeam[] {
    if (!FormatCatalog.isVgcMeta(format.meta)) {
      return [];
    }

    return this.teamsDb.get(format.meta) ?? [];
  }

  public getTeamsByPokemon(format: SmogonFormat, pokemon1: string, pokemon2?: string): VgcTeam[] {
    if (!FormatCatalog.isVgcMeta(format.meta)) {
      return [];
    }

    const pokemonTeamsMap = this.pokemonTeamsDb.get(format.meta);
    if (!pokemonTeamsMap) {
      return [];
    }

    const primaryPokemonKey = this.getPokemonKey(pokemon1);
    const primaryTeams = pokemonTeamsMap.get(primaryPokemonKey) ?? [];
    if (!pokemon2) {
      return primaryTeams;
    }

    const secondaryPokemonKey = this.getPokemonKey(pokemon2);
    return primaryTeams.filter(team => this.teamMemberKeys.get(team)?.has(secondaryPokemonKey));
  }

  private loadFileData(): void {
    const teamFiles = readdirSync('data/vgc-teams')
      .filter(filename => /^vgcteams-.+\.json$/i.test(filename))
      .sort();

    teamFiles.forEach(filename => {
      const meta = this.getMetaFromFilename(filename);
      const loadedTeams = FileHelper.loadFileData<VgcTeam[]>(`vgc-teams/${filename}`);
      const teams = loadedTeams
        .filter(team => team.members.length === 6)
        .map(team => this.normalizeTeam(team));
      teams.sort((left, right) => this.compareTeams(left, right));
      const pokemonTeamsMap: PokemonTeamsMap = new Map();

      teams.forEach(team => this.indexTeam(pokemonTeamsMap, team));

      this.teamsDb.set(meta, teams);
      this.pokemonTeamsDb.set(meta, pokemonTeamsMap);
      if (teams.length !== loadedTeams.length) {
        console.warn(`Dropped ${loadedTeams.length - teams.length} incomplete VGC teams while loading ${filename}`);
      }
      console.log(`Loaded ${teams.length} VGC teams for ${meta} from ${filename}`);
    });
  }

  private indexTeam(pokemonTeamsMap: PokemonTeamsMap, team: VgcTeam): void {
    const memberKeys = new Set<string>();

    team.members.forEach(member => {
      const pokemonKey = this.getPokemonKey(member.name);
      if (memberKeys.has(pokemonKey)) {
        return;
      }

      memberKeys.add(pokemonKey);
      const teams = pokemonTeamsMap.get(pokemonKey);
      if (teams) {
        teams.push(team);
        return;
      }

      pokemonTeamsMap.set(pokemonKey, [team]);
    });

    this.teamMemberKeys.set(team, memberKeys);
  }

  private normalizeTeam(team: VgcTeam): VgcTeam {
    return {
      ...team,
      members: team.members.map(member => this.normalizeMember(member)),
    };
  }

  private normalizeMember(member: VgcTeamMember): VgcTeamMember {
    const pokemon = this.pokemonDb.getPokemon(member.name.trim());

    return {
      ...member,
      name: pokemon ? pokemon.name : member.name.trim(),
    };
  }

  private getMetaFromFilename(filename: string): string {
    const match = /^vgcteams-(.+)\.json$/i.exec(filename);
    if (!match) {
      throw new Error(`Unsupported VGC teams filename '${filename}'.`);
    }

    const suffix = match[1].toLowerCase();
    if (FormatCatalog.isKnownVgcAlias(suffix)) {
      return FormatCatalog.resolveVgcSeason(suffix).meta;
    }

    const regulationWithPrefix = /^vgc(reg[a-z0-9]+)$/i.exec(suffix);
    if (regulationWithPrefix) {
      return FormatCatalog.resolveVgcSeason('vgc', undefined, undefined, regulationWithPrefix[1]).meta;
    }

    const regulationOnly = /^(reg[a-z0-9]+)$/i.exec(suffix);
    if (regulationOnly) {
      return FormatCatalog.resolveVgcSeason('vgc', undefined, undefined, regulationOnly[1]).meta;
    }

    throw new Error(`Could not resolve a VGC regulation from '${filename}'.`);
  }

  private getPokemonKey(pokemonName: string): string {
    const pokemon = this.pokemonDb.getPokemon(pokemonName.trim());
    return (pokemon ? pokemon.name : pokemonName).trim().toLowerCase();
  }

  private compareTeams(left: VgcTeam, right: VgcTeam): number {
    const dateDifference = this.getSortableDateValue(right.date) - this.getSortableDateValue(left.date);
    if (dateDifference !== 0) {
      return dateDifference;
    }

    const rankDifference = (left.rank ?? NullRankFallback) - (right.rank ?? NullRankFallback);
    if (rankDifference !== 0) {
      return rankDifference;
    }

    return left.teamId.localeCompare(right.teamId);
  }

  private getSortableDateValue(rawDate: string): number {
    const parsedDate = Date.parse(rawDate);
    return Number.isNaN(parsedDate)
      ? 0
      : parsedDate;
  }
}