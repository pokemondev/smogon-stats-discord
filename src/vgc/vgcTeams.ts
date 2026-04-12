import { readdirSync } from 'fs';
import { FileHelper } from '../common/fileHelper';
import { PokemonDb } from '../pokemon/pokemonDb';
import { PokemonSet } from '../models/smogonSets';
import { FormatCatalog } from '../smogon/formatCatalog';
import { FormatHelper } from '../smogon/formatHelper';
import { SmogonFormat } from '../models/smogonUsage';
import { VgcResolvedTeam, VgcTeam } from '../models/vgc';

type VgcTeamsDb = Map<string, VgcTeam[]>;           // meta to teams map
type PokemonTeamsMap = Map<string, VgcTeam[]>;      // pokemon to teams map
type PokemonTeamsDb = Map<string, PokemonTeamsMap>; // meta to pokemon teams map
type TeamIdDb = Map<string, VgcResolvedTeam>;

const NullRankFallback = Number.MAX_SAFE_INTEGER;

export class VgcTeams {
  private readonly teamsDb: VgcTeamsDb = new Map();
  private readonly pokemonTeamsDb: PokemonTeamsDb = new Map();
  private readonly teamMemberKeys = new Map<VgcTeam, Set<string>>();
  private readonly teamIdDb: TeamIdDb = new Map();

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

  public getTeamById(teamId: string): VgcResolvedTeam | undefined {
    const teamIdKey = this.getTeamIdKey(teamId);
    if (!teamIdKey) {
      return undefined;
    }

    return this.teamIdDb.get(teamIdKey);
  }

  private loadFileData(): void {
    const teamFiles = readdirSync('data/vgc-teams')
      .filter(filename => /^vgcteams-.+\.json$/i.test(filename))
      .sort();

    teamFiles.forEach(filename => {
      const meta = this.getMetaFromFilename(filename);
      const format = FormatCatalog.resolveVgcSeason(meta);
      const loadedTeams = FileHelper.loadFileData<VgcTeam[]>(`vgc-teams/${filename}`);
      const teams = loadedTeams
        .filter(team => team.members.length === 6)
        .map(team => this.normalizeTeam(team));
      teams.sort((left, right) => this.compareTeams(left, right));
      const pokemonTeamsMap: PokemonTeamsMap = new Map();

        teams.forEach(team => this.indexTeam(pokemonTeamsMap, team, { generation: format.gen, meta }));

      this.teamsDb.set(meta, teams);
      this.pokemonTeamsDb.set(meta, pokemonTeamsMap);
      if (teams.length !== loadedTeams.length) {
        console.warn(`Dropped ${loadedTeams.length - teams.length} incomplete VGC teams while loading ${filename}`);
      }
      console.log(`Loaded ${teams.length} VGC teams for ${meta} from ${filename}`);
    });
  }

  private indexTeam(pokemonTeamsMap: PokemonTeamsMap, team: VgcTeam, format: SmogonFormat): void {
    this.indexTeamId(team, format);

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

  private indexTeamId(team: VgcTeam, format: SmogonFormat): void {
    const teamIdKey = this.getTeamIdKey(team.teamId);
    if (!teamIdKey) {
      return;
    }

    const currentTeam = this.teamIdDb.get(teamIdKey);
    if (currentTeam && this.isDefaultRegulation(currentTeam.format)) {
      return;
    }

    this.teamIdDb.set(teamIdKey, { format, team });
  }

  private normalizeTeam(team: VgcTeam): VgcTeam {
    return {
      ...team,
      members: team.members.map(member => this.normalizeMember(member)),
    };
  }

  private normalizeMember(member: PokemonSet): PokemonSet {
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

  private getTeamIdKey(teamId?: string): string {
    return teamId ? teamId.trim().toLowerCase() : '';
  }

  private isDefaultRegulation(format: SmogonFormat): boolean {
    const configuredDefault = FormatHelper.getDefault();
    const defaultVgcFormat = FormatCatalog.isVgcMeta(configuredDefault.meta)
      ? configuredDefault
      : FormatCatalog.getGenerationDefaultVgcFormat(configuredDefault.generation);

    return format.meta === defaultVgcFormat.meta;
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