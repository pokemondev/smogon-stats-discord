# Smogon Stats Discord Bot

Smogon Stats is a Discord bot for Pokemon Showdown and Smogon competitive data. It serves usage rankings, leads data, moveset trends, counters, teammates, and curated Smogon sets from local JSON snapshots.

The bot now runs on modern discord.js slash commands instead of prefix-based message commands.

## Features

- Slash-command first command surface.
- Fuzzy Pokemon name matching kept from the original bot.
- Competitive summary command with moves, items, abilities, spreads, counters, and type profile.
- Meta-wide rankings for usage, leads, and Mega Stone users.
- Smogon sets lookup by Pokemon, generation, and metagame.
- Static local data files for predictable responses and simple hosting.

## Requirements

- Node.js 20 or newer.
- A Discord application with a bot token.
- Your application ID for command registration.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```env
TOKEN=your_bot_token
CLIENT_ID=your_application_id
DEV_GUILD_ID=optional_guild_id_for_fast_testing
DEFAULT_GENERATION=gen9
DEFAULT_META=vgc2026regf
```

`DEFAULT_GENERATION` and `DEFAULT_META` are required. The bot validates them on startup and during command registration, and it fails fast if they are missing, ambiguous, or incompatible.

3. Register slash commands:

```bash
npm run register:commands
```

If `DEV_GUILD_ID` is set, commands are registered to that guild for instant updates. Otherwise, commands are registered globally.

4. Start the bot:

```bash
npm start
```

For local development with watch mode:

```bash
npm run dev
```

## Discord App Setup

### OAuth scopes

- `bot`
- `applications.commands`

### Gateway intents

- `Guilds`

This bot does not require `Message Content` or any privileged intent for the implemented slash-command flow.

### Minimum bot permissions

- `ViewChannel`
- `SendMessages`
- `EmbedLinks`

Optional only if you want thread replies:

- `SendMessagesInThreads`

Users also need permission to use application commands in the target channel.

## Command Surface

Defaults:

- `generation` and `meta` default to the configured `DEFAULT_GENERATION` and `DEFAULT_META`
- if only `generation` is provided, the bot uses that generation's default VGC format
- slash-command meta choices show VGC formats first, and the configured default choice is marked with `(Default)`

### `/pokemon`

Pokemon-targeted data commands. All Pokemon subcommands use the same arguments:

- `name` required
- `generation` optional
- `meta` optional

Subcommands:

- `summary` — full competitive overview
- `moves` — most used moves
- `abilities` — most used abilities
- `items` — most used items
- `spreads` — most used spreads and natures
- `checks` — common checks and counters
- `teammates` — common teammates
- `sets` — curated Smogon sets

Examples:

```text
/pokemon summary name:dragonite
/pokemon moves name:gholdengo meta:OU
/pokemon sets name:landorus-therian generation:"Gen 8" meta:OU
```

### `/meta`

Metagame-wide rankings. Meta subcommands use:

- `generation` optional
- `meta` optional

Subcommands:

- `usage` — most used Pokemon
- `leads` — most common leads
- `megas` — most common Mega Stone users

Examples:

```text
/meta usage
/meta leads meta:UU
/meta megas generation:"Gen 6" meta:OU
```

### `/help`

Ephemeral command help. Optional argument:

- `command`

Examples:

```text
/help
/help command:pokemon
```

### `/util`

Utility subcommands:

- `ping` — returns bot latency
- `server` — guild-only server name and member count

Examples:

```text
/util ping
/util server
```

## Notes

- Discord always shows slash option names in the UI, so the command syntax includes labels such as `name:`, `generation:`, and `meta:`.
- The internal Smogon `format` is treated as `generation + meta`.
- Fuzzy name matching is still the primary fallback even without autocomplete.

## Testing

Run the existing test suite with:

```bash
npm test
```

