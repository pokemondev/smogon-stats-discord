import fs = require('fs');
import path = require('path');
import { ChatInputCommandInteraction } from 'discord.js';
import { PokemonDb } from '../pokemon/pokemonDb';
import { FormatHelper } from '../smogon/formatHelper';

export type CountMap = Record<string, number>;
export type GuildCountMap = Record<string, CountMap>;

export interface CommandAnalyticsSnapshot {
  schemaVersion: number;
  totalProcessedCommands: number;
  commandCounts: CountMap;
  failedCommandCounts: CountMap;
  guildCommandCounts: GuildCountMap;
  pokemonCounts: CountMap;
  metaCounts: CountMap;
  generationCounts: CountMap;
  lastSavedAt?: string;
}

export interface AnalyticsServiceOptions {
  flushEvery: number;
  filePath?: string;
  now?: () => Date;
  log?: (message: string) => void;
  logError?: (message: string, error?: unknown) => void;
}

export class AnalyticsService {
  private static readonly SchemaVersion = 1;
  private static readonly DefaultFilePath = path.resolve(process.cwd(), 'data', 'command-stats.json');
  private static readonly SummaryLimit = 3;

  private readonly filePath: string;
  private readonly flushEvery: number;
  private readonly now: () => Date;
  private readonly log: (message: string) => void;
  private readonly logError: (message: string, error?: unknown) => void;
  private readonly pokemonDb: PokemonDb;

  private snapshot: CommandAnalyticsSnapshot;
  private processedSinceLastFlush = 0;
  private flushChain = Promise.resolve();

  constructor(pokemonDb: PokemonDb, options: AnalyticsServiceOptions) {
    this.pokemonDb = pokemonDb;
    this.flushEvery = options.flushEvery;
    this.filePath = options.filePath ?? AnalyticsService.DefaultFilePath;
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? (message => console.log(message));
    this.logError = options.logError ?? ((message, error) => console.error(message, error));
    this.snapshot = this.loadSnapshot();
  }

  public recordCommandAttempt(interaction: ChatInputCommandInteraction): void {
    const commandKey = this.getCommandKey(interaction);
    this.snapshot.totalProcessedCommands += 1;
    this.incrementCount(this.snapshot.commandCounts, commandKey);

    if (interaction.guildId) {
      const guildCounts = this.snapshot.guildCommandCounts[interaction.guildId] ?? {};
      this.snapshot.guildCommandCounts[interaction.guildId] = guildCounts;
      this.incrementCount(guildCounts, commandKey);
    }

    if (interaction.commandName === 'pokemon') {
      const pokemonName = this.getResolvedPokemonName(interaction);
      if (pokemonName) {
        this.incrementCount(this.snapshot.pokemonCounts, pokemonName);
      }
    }

    if (this.shouldTrackFormat(interaction.commandName)) {
      const format = this.getInteractionFormat(interaction);
      this.incrementCount(this.snapshot.metaCounts, format.meta);
      this.incrementCount(this.snapshot.generationCounts, format.generation);
    }

    this.processedSinceLastFlush += 1;
    if (this.processedSinceLastFlush < this.flushEvery) {
      return;
    }

    this.processedSinceLastFlush = 0;
    this.logSummary();
    this.enqueueFlush();
  }

  public recordCommandFailure(interaction: ChatInputCommandInteraction): void {
    this.incrementCount(this.snapshot.failedCommandCounts, this.getCommandKey(interaction));
  }

  public getSummary(guildId?: string): string {
    const sections = [
      `Total processed commands: ${this.snapshot.totalProcessedCommands}`,
      this.formatSection('Top commands overall', this.snapshot.commandCounts),
      this.formatSection('Top failed commands overall', this.snapshot.failedCommandCounts),
      guildId ? this.formatSection('Top commands for this server', this.snapshot.guildCommandCounts[guildId]) : undefined,
      this.formatSection('Top pokemon overall', this.snapshot.pokemonCounts),
      this.formatSection('Top metas', this.snapshot.metaCounts),
      this.formatSection('Top generations', this.snapshot.generationCounts),
    ];

    return sections.filter((section): section is string => !!section).join('\n\n');
  }

  public getSnapshot(): CommandAnalyticsSnapshot {
    return JSON.parse(JSON.stringify(this.snapshot)) as CommandAnalyticsSnapshot;
  }

  public flush(): Promise<void> {
    this.enqueueFlush();
    return this.flushChain;
  }

  private enqueueFlush(): void {
    this.flushChain = this.flushChain
      .then(() => this.persistSnapshot())
      .catch(error => {
        this.logError('[AnalyticsService] Failed to persist analytics snapshot.', error);
      });
  }

  private async persistSnapshot(): Promise<void> {
    const snapshotToPersist: CommandAnalyticsSnapshot = {
      ...this.snapshot,
      guildCommandCounts: this.cloneGuildCounts(this.snapshot.guildCommandCounts),
      commandCounts: { ...this.snapshot.commandCounts },
      failedCommandCounts: { ...this.snapshot.failedCommandCounts },
      pokemonCounts: { ...this.snapshot.pokemonCounts },
      metaCounts: { ...this.snapshot.metaCounts },
      generationCounts: { ...this.snapshot.generationCounts },
      lastSavedAt: this.now().toISOString(),
    };

    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.promises.writeFile(this.filePath, JSON.stringify(snapshotToPersist, null, 2));
    this.snapshot.lastSavedAt = snapshotToPersist.lastSavedAt;
  }

  private loadSnapshot(): CommandAnalyticsSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return this.createEmptySnapshot();
    }

    const rawData = fs.readFileSync(this.filePath).toString();
    const parsed = JSON.parse(rawData) as Partial<CommandAnalyticsSnapshot>;
    return {
      schemaVersion: AnalyticsService.SchemaVersion,
      totalProcessedCommands: parsed.totalProcessedCommands ?? 0,
      commandCounts: { ...(parsed.commandCounts ?? {}) },
      failedCommandCounts: { ...(parsed.failedCommandCounts ?? {}) },
      guildCommandCounts: this.cloneGuildCounts(parsed.guildCommandCounts ?? {}),
      pokemonCounts: { ...(parsed.pokemonCounts ?? {}) },
      metaCounts: { ...(parsed.metaCounts ?? {}) },
      generationCounts: { ...(parsed.generationCounts ?? {}) },
      lastSavedAt: parsed.lastSavedAt,
    };
  }

  private createEmptySnapshot(): CommandAnalyticsSnapshot {
    return {
      schemaVersion: AnalyticsService.SchemaVersion,
      totalProcessedCommands: 0,
      commandCounts: {},
      failedCommandCounts: {},
      guildCommandCounts: {},
      pokemonCounts: {},
      metaCounts: {},
      generationCounts: {},
    };
  }

  private cloneGuildCounts(guildCounts: GuildCountMap): GuildCountMap {
    return Object.fromEntries(
      Object.entries(guildCounts).map(([guildId, counts]) => [guildId, { ...counts }])
    );
  }

  private incrementCount(counts: CountMap, key: string): void {
    counts[key] = (counts[key] ?? 0) + 1;
  }

  private getCommandKey(interaction: ChatInputCommandInteraction): string {
    const subcommand = interaction.options.getSubcommand(false);
    return subcommand
      ? `${interaction.commandName}/${subcommand}`
      : interaction.commandName;
  }

  private getInteractionFormat(interaction: ChatInputCommandInteraction) {
    const args = [
      interaction.options.getString('generation') ?? undefined,
      interaction.options.getString('meta') ?? undefined,
    ].filter((value): value is string => !!value);

    return FormatHelper.getFormat(args);
  }

  private getResolvedPokemonName(interaction: ChatInputCommandInteraction): string | undefined {
    const rawPokemonName = interaction.options.getString('name');
    if (!rawPokemonName) {
      return undefined;
    }

    return this.pokemonDb.getPokemon(rawPokemonName.trim())?.name;
  }

  private shouldTrackFormat(commandName: string): boolean {
    return commandName === 'pokemon' || commandName === 'stats';
  }

  private logSummary(): void {
    const summary = [
      `[CommandAnalytics] Processed ${this.snapshot.totalProcessedCommands} command(s) so far.`,
      this.formatInlineSection('Top commands', this.snapshot.commandCounts),
      this.formatInlineSection('Top failed', this.snapshot.failedCommandCounts),
      this.formatInlineSection('Top pokemon', this.snapshot.pokemonCounts),
      this.formatInlineSection('Top metas', this.snapshot.metaCounts),
      this.formatInlineSection('Top generations', this.snapshot.generationCounts),
    ].join(' ');

    this.log(summary);
  }

  private formatInlineSection(title: string, counts: CountMap): string {
    const entries = this.getTopEntries(counts);
    const value = entries.length
      ? entries.map(([key, count]) => `${key}=${count}`).join(', ')
      : 'none';

    return `${title}: ${value}.`;
  }

  private formatSection(title: string, counts?: CountMap): string {
    const entries = this.getTopEntries(counts);
    const lines = entries.length
      ? entries.map(([key, count], index) => `${index + 1}. ${key}: ${count}`)
      : [ 'None yet.' ];

    return `${title}:\n${lines.join('\n')}`;
  }

  private getTopEntries(counts?: CountMap): Array<[string, number]> {
    if (!counts) {
      return [];
    }

    return Object.entries(counts)
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })
      .slice(0, AnalyticsService.SummaryLimit);
  }
}