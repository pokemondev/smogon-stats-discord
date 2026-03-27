# AGENTS.md

This file is the minimal working guide for running and editing this repository.

## Project Summary

Smogon Stats Discord Bot is a TypeScript Discord bot that serves Pokemon Showdown and Smogon data from local JSON snapshots.

Important current decisions:

- The bot is slash-command only.
- The public command model uses `name`, `meta`, and `generation`.
- Internal code treats a format as `generation + meta`.
- Fuzzy Pokemon matching is intentionally kept as the primary lookup behavior.
- Autocomplete is not implemented.
- Interaction-only flows are used, so the bot only needs the `Guilds` intent.
- Ephemeral interaction replies should use `flags: MessageFlags.Ephemeral`, not `ephemeral: true`.

## Main Libraries

- `discord.js` 14.25.1: slash commands, interactions, embeds, REST registration
- `dotenv`: environment variable loading
- `fuzzy-matching`: tolerant Pokemon name lookup
- `cache-manager`: in-memory cache for local data access
- `typescript`: build and type-check

## Requirements

- Node.js 20+
- A Discord application and bot token
- Discord application ID for slash command registration

## Environment Variables

Create a `.env` file with:

```env
BOT_NAME=Smogon Stats
TOKEN=your_bot_token
CLIENT_ID=your_application_id
DEV_GUILD_ID=optional_guild_id_for_fast_testing
```

Notes:

- `DEV_GUILD_ID` is the preferred way to iterate on slash command changes quickly.
- Without `DEV_GUILD_ID`, command registration is global and propagation is slower.

## Run And Build

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Register slash commands:

```bash
npm run register:commands
```

Start the bot:

```bash
npm start
```

Watch mode for development:

```bash
npm run dev
```

## Discord App Setup

OAuth scopes:

- `bot`
- `applications.commands`

Gateway intents:

- `Guilds`

Minimum bot permissions:

- `ViewChannel`
- `SendMessages`
- `EmbedLinks`

Optional if thread replies are needed:

- `SendMessagesInThreads`

## Command Surface

Top-level slash commands:

- `/pokemon`
- `/stats`
- `/util`
- `/help`

Where they are wired:

- `src/app.ts`: interaction handling and runtime boot
- `src/commands/commandIndex.ts`: command assembly and registration payload source
- `src/registerCommands.ts`: Discord REST command registration

Shared slash-command helpers live in `src/commands/command.ts`.

That file contains:

- shared `generation` and `meta` slash option choices
- shared reply helpers
- shared Pokemon resolution helpers
- shared format parsing entrypoint for command handlers

If you change command names, subcommands, option names, or option choices, run `npm run register:commands` after building.

## Data Folder

All bot responses are backed by local data under `data/`.

Top-level layout:

- `data/pokemon-db.json`: Pokemon lookup database used for names, typing, stats, and related display metadata
- `data/type-table.json`: type matchup table used for weakness and resistance calculations
- `data/smogon-sets/`: curated Smogon set snapshots split by generation
- `data/smogon-stats/`: usage-stat snapshots split by generation and metagame

`data/smogon-sets/` structure:

- `gen6-sets.json`
- `gen7-sets.json`
- `gen8-sets.json`
- `gen9-sets.json`

`data/smogon-stats/` structure:

- `gen6/`
- `gen7/`
- `gen8/`
- `gen9/`

Inside each generation folder, each metagame has its own folder, for example:

- `ou/`
- `uu/`
- `ru/`
- `nu/`
- `ubers/`
- VGC folders such as `vgc2020/` or regulation-based names like `vgc2026regi/`

Each metagame folder typically contains JSON snapshots such as:

- `usage-...json`
- `leads-...json`
- `moveset-...json`

The code expects these snapshots to exist locally. This bot does not fetch live Smogon data at runtime.

## Important Source Files

- `src/app.ts`: bot bootstrap, login, interaction dispatch, error replies
- `src/appDataSource.ts`: shared service container
- `src/commands/command.ts`: shared slash option definitions and command base helpers
- `src/commands/commandIndex.ts`: command list used both at runtime and during registration
- `src/smogon/formatHelper.ts`: source of truth for supported generations, metas, VGC aliases, and format parsing
- `src/smogon/smogonStats.ts`: local stats loading and caching
- `src/smogon/smogonSets.ts`: local Smogon set loading
- `src/pokemon/pokemonDb.ts`: Pokemon lookup and fuzzy name resolution

## Adding A New Format

Adding a new format means adding a new supported `generation + meta` combination.

### 1. Add the data files

For usage-style data, add files under:

```text
data/smogon-stats/genX/<meta>/
```

Expected file types are usually:

- usage snapshot
- leads snapshot
- moveset snapshot

If curated sets should exist for that generation, update the matching file in:

```text
data/smogon-sets/genX-sets.json
```

### 2. Teach the parser about the format

Update `src/smogon/formatHelper.ts`.

This is the main source of truth for supported formats.

Common places to update:

- `Generations`
- `VgcSeasons` for VGC year or regulation formats
- `MetaValues`
- `MetaAliases`
- aliases and default season logic if the new format should be selected by shorthand input

Use `VgcSeasons` when the meta is a VGC season like `vgc2021` or `vgc2026regi`.
Use `MetaValues` and `MetaAliases` when the meta should be recognized and accepted by the slash-command and parser layers.

### 3. Expose it in slash commands if users should select it

Update `src/commands/command.ts`.

Relevant lists:

- `generationChoices`
- `metaChoices`

This controls the visible slash-command option labels and ordering.

If the new format should appear in Discord command menus, it must be added here.

### 4. Keep help and docs aligned

If the new format changes the supported surface in a meaningful way, update:

- `README.md`
- command help examples in `src/commands/helpCommand.ts` or command topic definitions

### 5. Validate and publish

Run:

```bash
npm test
npm run register:commands
```

The second command is required if slash command option choices changed.

## Editing Guidance

- Prefer updating shared helpers in `src/commands/command.ts` instead of duplicating logic across commands.
- If you change slash-command structure or options, always re-register commands.
- Keep the slash surface simple. Current UX intentionally favors a small number of top-level commands.
- Preserve fuzzy Pokemon lookup behavior unless there is a strong reason to change it.
- This repo currently uses local JSON snapshots as the source of truth, so data changes often matter as much as code changes.
