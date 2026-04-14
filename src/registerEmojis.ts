import { once } from 'events';
import { ApplicationEmojiManager, Client, DiscordAPIError, Events, GatewayIntentBits } from 'discord.js';
import { AppDataSource } from './appDataSource';
import { ConfigHelper } from './config/configHelper';
import { PokemonEmoji } from './pokemon/pokemonEmoji';
import { ItemEmoji } from './pokemon/itemEmoji';

interface EmojiRegistrationEntry {
  emojiName: string;
  minispriteUrl: string;
}

type EmojiFailure = {
  entry: EmojiRegistrationEntry;
  error: unknown;
};

const botConfig = ConfigHelper.loadAndValidate({ requireClientId: true });
const dataSource = new AppDataSource(botConfig);

async function registerEmojis(): Promise<void> {
  const pokemonRoster = await PokemonEmoji.buildRoster(dataSource.smogonStats, dataSource.pokemonDb);
  const itemRoster = await ItemEmoji.buildRoster(dataSource.smogonStats);
  const allEntries: EmojiRegistrationEntry[] = [...pokemonRoster.entries, ...itemRoster.entries];

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
    const targetEmojiNames = new Set(allEntries.map(entry => entry.emojiName));

    const stalePokemonEmojiCount = existingEmojis.filter(
      emoji => !!emoji.name && emoji.name.startsWith(`${PokemonEmoji.Prefix}_`) && !targetEmojiNames.has(emoji.name)
    ).size;
    const staleItemEmojiCount = existingEmojis.filter(
      emoji => !!emoji.name && emoji.name.startsWith(`${ItemEmoji.Prefix}_`) && !targetEmojiNames.has(emoji.name)
    ).size;

    const entriesToCreate = allEntries.filter(entry => !existingNames.has(entry.emojiName));

    console.log(`Computed ${pokemonRoster.entries.length} unique Pokemon emoji(s) across ${pokemonRoster.sources.length} source format(s).`);
    console.log(`Computed ${itemRoster.entries.length} unique item emoji(s).`);
    console.log(`Found ${existingEmojis.size} existing application emoji(s). ${allEntries.length - entriesToCreate.length} matching emoji(s) already exist.`);
    if (stalePokemonEmojiCount > 0) {
      console.log(`Leaving ${stalePokemonEmojiCount} stale ${PokemonEmoji.Prefix}_ emoji(s) untouched.`);
    }
    if (staleItemEmojiCount > 0) {
      console.log(`Leaving ${staleItemEmojiCount} stale ${ItemEmoji.Prefix}_ emoji(s) untouched.`);
    }

    if (pokemonRoster.unresolvedNames.length > 0) {
      console.warn(`Proceeding with ${pokemonRoster.unresolvedNames.length} unresolved Pokemon name(s): ${pokemonRoster.unresolvedNames.join(', ')}`);
    }

    if (!entriesToCreate.length) {
      console.log('No missing emojis were found.');
      return;
    }

    const createdEntries: EmojiRegistrationEntry[] = [];
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

    const createdPokemon = createdEntries.filter(e => e.emojiName.startsWith(`${PokemonEmoji.Prefix}_`)).length;
    const createdItems = createdEntries.filter(e => e.emojiName.startsWith(`${ItemEmoji.Prefix}_`)).length;
    console.log(`Created ${createdEntries.length} emoji(s) (${createdPokemon} Pokemon, ${createdItems} item).`);
    console.log(`Skipped ${allEntries.length - entriesToCreate.length} already-existing emoji(s).`);
    if (failedEntries.length > 0) {
      console.error(`Failed to create ${failedEntries.length} emoji(s).`);
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
  entry: EmojiRegistrationEntry,
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