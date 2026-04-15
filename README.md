# Smogon Stats Discord Bot

Smogon Stats is a Discord bot for Pokemon Showdown and Smogon competitive data. It serves usage rankings, leads data, moveset trends, counters, teammates, curated Smogon sets, and VGC data from local JSON snapshots.

The bot now runs on modern discord.js slash commands instead of prefix-based message commands.

## Features

- Slash-command first command surface.
- Fuzzy Pokemon name matching kept from the original bot.
- Competitive summary command with moves, items, abilities, spreads, counters, and type profile.
- Meta-wide rankings for usage, leads, speed tiers, attackers, defenders, and Mega Stone users.
- Smogon sets lookup by Pokemon, generation, and metagame.
- VGC team lookups by regulation with optional Pokemon member filters.
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
BOT_NAME=Smogon Stats
TOKEN=your_bot_token
CLIENT_ID=your_application_id
DEV_GUILD_ID=optional_guild_id_for_fast_testing
DEFAULT_GENERATION=gen9
DEFAULT_META=vgc2026regf
COMMAND_STATS_FLUSH_EVERY=25
```

`BOT_NAME`, `DEFAULT_GENERATION`, and `DEFAULT_META` are required. The bot validates them on startup and during command registration, and it fails fast if they are missing, ambiguous, or incompatible. `COMMAND_STATS_FLUSH_EVERY` is optional and controls how often command analytics are saved to `data/command-stats.json` and summarized in the console.

3. Register slash commands:

```bash
npm run register:commands
```

If `DEV_GUILD_ID` is set, commands are registered to that guild for instant updates. Otherwise, commands are registered globally.

4. Register application emojis:

```bash
npm run register:emojis
```

This uses the same `TOKEN` and `CLIENT_ID` values as command registration. The workflow uploads missing emojis in two categories:

- **Pokemon emojis** (`pkm_` prefix) — sourced from Smogon XY mini sprites at `https://www.smogon.com/dex/media/sprites/xyicons/`. These appear next to Pokemon names in command outputs.
- **Item emojis** (`item_` prefix) — sourced from Smogon forum mini sprites at `https://www.smogon.com/forums/media/minisprites/`. These appear next to item names in usage outputs such as `/pokemon info items`.

Both categories are uploaded in sequential batches of 8 concurrent uploads. Existing matching emojis are kept, stale emojis within each prefix group are left untouched, and Discord's 256 KiB emoji upload limit still applies.

5. Start the bot:

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
Application-owned emojis also do not require `USE_EXTERNAL_EMOJIS` to render.

### Minimum bot permissions

- `ViewChannel`
- `SendMessages`
- `EmbedLinks`

Optional only if you want thread replies:

- `SendMessagesInThreads`

Users also need permission to use application commands in the target channel.

## Command Surface

Defaults:

- `meta` and `generation` default to the configured `DEFAULT_META` and `DEFAULT_GENERATION`
- if only `generation` is provided, the bot uses that generation's default VGC format
- slash-command meta choices show VGC formats first, and the configured default choice is marked with `(Default)`

### `/pokemon`

Pokemon-targeted data commands.

Subcommands:

- `summary` — full competitive overview
- `info` — detailed usage data by category
- `search` — filter format usage results by one or two moves and an optional ability
- `sets` — curated Smogon sets

Arguments:

- `summary`: `name` required, `meta` optional, `generation` optional
- `info`: `name` required, `category` required, `meta` optional, `generation` optional
- `search`: `move1` optional, `move2` optional, `ability` optional, `meta` optional, `generation` optional
- `sets`: `name` required, `meta` optional, `generation` optional

`info` categories:

- `moves`
- `abilities`
- `items`
- `spreads`
- `checks`
- `teammates`

Examples:

```text
/pokemon summary name:dragonite
/pokemon info name:gholdengo category:items meta:OU
/pokemon search move1:protect ability:cursed-body meta:OU
/pokemon sets name:landorus-therian meta:OU generation:"Gen 8"
```

`search` notes:

- at least one of `move1`, `move2`, or `ability` must be provided
- move inputs use the same fuzzy move matching as the movedex lookup
- ability input is resolved fuzzily from known Pokemon possible abilities
- all provided filters use AND semantics
- results are ranked by overall format usage and capped at 15 entries

### `/stats`

Metagame-wide rankings. Meta subcommands use:

- `meta` optional
- `generation` optional
- `mode` optional for `speed-tier` only: `faster` (default) or `slower`
- `mode` optional for `attackers` and `defenders`: `both` (default), `physical`, or `special`

Subcommands:

- `usage` — most used Pokemon
- `leads` — most common leads
- `speed-tier` — highest or lowest base Speed among the top 100 used Pokemon in the format
- `attackers` — highest base Attack, Sp. Atk, or the stronger of both among the top 100 used Pokemon in the format
- `defenders` — highest base Defense, Sp. Def, or the stronger of both among the top 100 used Pokemon in the format
- `megas` — most common Mega Stone users

Notes:

- `usage` shows application Pokemon emojis beside names when the matching `pkm_` emoji exists
- `speed-tier` filters the pool to the top 100 most used Pokemon in the selected format before sorting by base Speed
- `attackers` and `defenders` also filter the pool to the top 100 most used Pokemon in the selected format before sorting by the requested base stat mode
- `attackers` and `defenders` use `both` mode by default, selecting the stronger relevant base stat for each Pokemon and showing which stat was used
- `speed-tier` output is capped at the top 15 displayed entries, matching the other `/stats` ranking views

Examples:

```text
/stats usage
/stats speed-tier
/stats speed-tier meta:OU generation:"Gen 8" mode:slower
/stats attackers meta:OU mode:special
/stats defenders generation:"Gen 8" mode:physical
/stats leads meta:UU
/stats megas meta:OU generation:"Gen 6"
```

### `/vgc`

VGC metagame related commands.

Subcommands:

- `teams` — featured teams for a VGC regulation
- `team-details` — full team paste in Smogon notation for a VGC team id

Arguments:

- `teams`: `regulation` optional, `pokemon1` optional, `pokemon2` optional
- `team-details`: `team-id` required

Notes:

- `regulation` uses VGC season choices such as `VGC 2026 Reg. I`
- if only `pokemon2` is provided, it is treated as `pokemon1`
- team list output is capped at the top 6 matching teams
- `team-details` resolves the regulation automatically from the team id
- team details use the most used Pokemon on that team for the embed color and sprite when usage data is available

Examples:

```text
/vgc teams
/vgc teams regulation:"VGC 2026 Reg. I"
/vgc teams pokemon1:charizard
/vgc teams regulation:"VGC 2026 Reg. I" pokemon1:zamazenta pokemon2:calyrex-shadow
/vgc team-details team-id:I1280
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
- `stats` — dev-oriented analytics summary of command usage and failures

Examples:

```text
/util ping
/util server
/util stats
```

`/util` is intentionally not included in the public `/help` output.

## Notes

- Discord always shows slash option names in the UI, so the command syntax includes labels such as `name:`, `generation:`, and `meta:`.
- The internal Smogon `format` is treated as `generation + meta`.
- Fuzzy name matching is still the primary fallback even without autocomplete.

## Testing

Run the existing test suite with:

```bash
npm test
```

