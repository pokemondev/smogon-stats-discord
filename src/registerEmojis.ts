import { once } from 'events';
import { ApplicationEmojiManager, Client, DiscordAPIError, Events, GatewayIntentBits } from 'discord.js';
import { AppDataSource } from './appDataSource';
import { ConfigHelper } from './config/configHelper';
import { PokemonEmoji, PokemonEmojiRosterEntry } from './pokemon/pokemonEmoji';

type EmojiFailure = {
  entry: PokemonEmojiRosterEntry;
  error: unknown;
};

const botConfig = ConfigHelper.loadAndValidate({ requireClientId: true });
const dataSource = new AppDataSource(botConfig);

async function registerEmojis(): Promise<void> {
  const roster = await PokemonEmoji.buildRoster(dataSource.smogonStats, dataSource.pokemonDb);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    const ready = once(client, Events.ClientReady);
    await client.login(botConfig.client.token);
    await ready;

    if (!client.application) {
      throw new Error('Discord application metadata was not available after login.');
    }

    const existingEmojis = await client.application.emojis.fetch();
    const existingNames = new Set(
      existingEmojis
        .map(emoji => emoji.name)
        .filter((name): name is string => !!name)
    );
    const targetEmojiNames = new Set(roster.entries.map(entry => entry.emojiName));
    const stalePokemonEmojiCount = existingEmojis.filter(
      emoji => !!emoji.name && emoji.name.startsWith(`${PokemonEmoji.Prefix}_`) && !targetEmojiNames.has(emoji.name)
    ).size;

    const entriesToCreate = roster.entries.filter(entry => !existingNames.has(entry.emojiName));

    console.log(`Computed ${roster.entries.length} unique Pokemon emoji(s) across ${roster.sources.length} source format(s).`);
    console.log(`Found ${existingEmojis.size} existing application emoji(s). ${roster.entries.length - entriesToCreate.length} matching Pokemon emoji(s) already exist.`);
    if (stalePokemonEmojiCount > 0) {
      console.log(`Leaving ${stalePokemonEmojiCount} stale ${PokemonEmoji.Prefix}_ emoji(s) untouched.`);
    }

    if (roster.unresolvedNames.length > 0) {
      console.warn(`Proceeding with ${roster.unresolvedNames.length} unresolved Pokemon name(s): ${roster.unresolvedNames.join(', ')}`);
    }

    if (!entriesToCreate.length) {
      console.log('No missing Pokemon emojis were found.');
      return;
    }

    const createdEntries: PokemonEmojiRosterEntry[] = [];
    const failedEntries: EmojiFailure[] = [];
    const batches = PokemonEmoji.chunkIntoBatches(entriesToCreate, PokemonEmoji.ImportBatchSize);

    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`Uploading batch ${batchIndex + 1}/${batches.length} with ${batch.length} emoji(s).`);
      const results = await Promise.allSettled(
        batch.map(entry => createApplicationEmojiWithRetry(client.application!.emojis, entry))
      );

      results.forEach((result, resultIndex) => {
        const entry = batch[resultIndex];
        if (result.status === 'fulfilled') {
          createdEntries.push(entry);
          return;
        }

        failedEntries.push({ entry, error: result.reason });
      });
    }

    console.log(`Created ${createdEntries.length} Pokemon emoji(s).`);
    console.log(`Skipped ${roster.entries.length - entriesToCreate.length} already-existing Pokemon emoji(s).`);
    if (failedEntries.length > 0) {
      console.error(`Failed to create ${failedEntries.length} Pokemon emoji(s).`);
      failedEntries.forEach(({ entry, error }) => {
        console.error(`- ${entry.emojiName} (${entry.minispriteUrl})`, error);
      });
      process.exitCode = 1;
    }
  }
  finally {
    client.destroy();
  }
}

async function createApplicationEmojiWithRetry(
  emojiManager: ApplicationEmojiManager,
  entry: PokemonEmojiRosterEntry,
  attempt = 1
): Promise<void> {
  try {
    await emojiManager.create({
      attachment: entry.minispriteUrl,
      name: entry.emojiName,
    });
  }
  catch (error) {
    if (!isRateLimited(error) || attempt >= 3) {
      throw error;
    }

    const retryDelayInMilliseconds = getRetryDelayInMilliseconds(error, attempt);
    console.warn(`Rate limited while creating ${entry.emojiName}. Retrying in ${retryDelayInMilliseconds}ms (attempt ${attempt + 1}/3).`);
    await delay(retryDelayInMilliseconds);
    await createApplicationEmojiWithRetry(emojiManager, entry, attempt + 1);
  }
}

function isRateLimited(error: unknown): boolean {
  if (error instanceof DiscordAPIError) {
    return error.status === 429;
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeStatus = error as { status?: unknown; code?: unknown };
  return maybeStatus.status === 429 || maybeStatus.code === 429;
}

function getRetryDelayInMilliseconds(error: unknown, attempt: number): number {
  if (error instanceof DiscordAPIError) {
    const retryAfter = (error as DiscordAPIError & { retryAfter?: number }).retryAfter;
    if (typeof retryAfter === 'number' && retryAfter > 0) {
      return Math.ceil(retryAfter * 1000);
    }
  }

  if (error && typeof error === 'object') {
    const rawError = error as { retryAfter?: unknown; rawError?: { retry_after?: unknown } };
    if (typeof rawError.retryAfter === 'number' && rawError.retryAfter > 0) {
      return Math.ceil(rawError.retryAfter * 1000);
    }

    if (typeof rawError.rawError?.retry_after === 'number' && rawError.rawError.retry_after > 0) {
      return Math.ceil(rawError.rawError.retry_after * 1000);
    }
  }

  return attempt * 1000;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

registerEmojis().catch(error => {
  console.error('Failed to register application emojis.', error);
  process.exitCode = 1;
});