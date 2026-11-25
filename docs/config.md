# config.json

One codebase runs every bot (Sky, Aria, Shana); everything that differs between
them is in `config.json`. `config.json` is gitignored and never leaves the host. The
template is `config.example.json` and `scripts/check-config.js` validates a real
file against it.

```bash
node scripts/check-config.js config.json   # key paths only, never values
```

## Adding the keys to an existing host config

Never open the host config by hand: it holds the Discord token, the Hypixel key
and the bridge token. `scripts/migrate-config.js` copies it, adds the new keys,
keeps every existing value and prints key paths only.

```bash
node scripts/migrate-config.js \
  --in config.json --out config.json.new \
  --name Sky \
  --peer-url http://PEER_HOST:3001 \
  --peer-guild aria \
  --blacklist-path <host blacklist path> \
  --peer-rank-rank "VIP+" --peer-rank-guild-rank Elder
node scripts/check-config.js config.json.new
mv config.json.new config.json
```

`--force` replaces keys that are already present (the default is to keep them).

### Keys that are credentials or host addresses: `--secrets-file`

`minecraft.API.waifuItKey`, `minecraft.API.statsProxyUrl` and
`minecraft.API.statsProxyKey` must not be passed on the command line: argv ends
up in shell history and in `ps`. Put them in a small JSON file instead (create
it on the host, mode 600, delete it afterwards):

```json
{
  "minecraft.API.waifuItKey": "<waifu.it token>",
  "minecraft.API.statsProxyUrl": "http://STATS_PROXY_HOST:3000",
  "minecraft.API.statsProxyKey": "<stats proxy key>"
}
```

```bash
chmod 600 /root/secrets.json
node scripts/migrate-config.js --in config.json --out config.json.new \
  --name Sky --peer-url http://PEER_HOST:3001 --peer-guild aria \
  --secrets-file /root/secrets.json
rm /root/secrets.json
node scripts/check-config.js config.json.new
```

The script reads the file, never prints a value from it (only key paths), and
replaces a key that still holds the `config.example.json` placeholder
(`WAIFU_IT_API_KEY`, `http://STATS_PROXY_HOST:3000`, `STATS_PROXY_KEY`). A key
that already has a real value is left alone unless `--force` is given.
`--stats-proxy-url` exists for the URL if you prefer a flag; it is not a
secret, but it does carry the host address.

**Careful:** `src/Configuration.js` rewrites `config.json` on every boot and
copies missing keys from `config.example.json`. If a key is still missing when
the bot starts, it gets the example's placeholder (`http://PEER_HOST:3001`,
`BOT_NAME`), so migrate before deploying. `src/contracts/bridge.js` logs a loud
warning when it sees the placeholder peer host.

## bridge

| key | meaning |
|---|---|
| `bridge.name` | This bot's own name as players see it: `<name> Bridge is Online/Offline`, the ` - <name>` guild-rank suffix, the embed footer, `<player> has joined <name>.` |
| `bridge.peerUrl` | `http://host:port` of the **other** bot's express server, no path. Every peer request is `peerUrl + /api/...` |
| `bridge.peerGuild` | Guild name sent in the `guild` field of `POST /api/message`. Both bots send the same string today (`aria`) - it is a constant, not the peer's name |
| `bridge.mirrorOnSend` | `true`: mirror `MinecraftManager.onBroadcast` and `eventSend` to the peer and append the `{id}` suffix; `false`: those two paths stay local (only `minecraftCommand.send` mirrors) |
| `bridge.relayBangCommands` | `true`: `!commands` that arrive on `POST /api/message` from the peer are executed by this bot's Minecraft command handler |
| `bridge.peerRank.rank` | Rank shown for peer messages forwarded to Discord (`rank` field) |
| `bridge.peerRank.guildRank` | Guild rank shown for peer messages (`guildRank` field) |

`bridge.name`, `bridge.peerUrl`, `bridge.peerGuild` and `web.token` are required:
`src/contracts/bridge.js` throws at startup with the key path if one is missing
or empty.

## features

| key | meaning |
|---|---|
| `features.retryOnRateLimit` | `true`: the `minecraftCommand.send` listener retries a guild line when Hypixel answers `You are sending commands too fast!` or `You cannot say the same message twice!` (up to 5 attempts, 250 ms apart). `false`: no listener, the line is sent once |
| `features.imageCompression` | `true`: Discord images are compressed with `sharp` before the Imgur upload. `false`: the original file is uploaded and `sharp` is never loaded (`require("sharp")` is lazy, so a host without it still boots) |
| `features.peerDiscordRelay` | `true`: `POST /api/message` lines are forwarded into this bot's Discord channels. `false`: the message is only posted to Minecraft guild chat, no Discord embed (Aria's old tree passed too few fields for its handler, which returned early) |

## paths

| key | meaning |
|---|---|
| `paths.blacklist` | Path of the UUID blacklist file, absolute or relative to the bot's working directory. Read by `ChatHandler` (guild requirements) and the blacklist/kick commands; written by the blacklist and kick commands |
| `paths.guildData` | Where the online/list commands write the guild member dump (`guildData.json`) |
| `paths.helpImage` | Image attached to the Discord `!help` embeds; `""` attaches nothing |

## guild

Everything that ties a bot to its Hypixel guild. Read through
`src/contracts/guildConfig.js`; no command carries a guild name, rank name or
player name of its own.

| key | meaning |
|---|---|
| `guild.name` | The Hypixel guild name (`/g info`). Guild API lookups are made by this name and every "is this our guild" check compares against it, case-insensitively |
| `guild.alliedGuilds` | Extra guild names `!member` accepts (Sky: `TempestAria`) |
| `guild.commandKeyword` | Word that addresses this bot in `!override`, `!autoclaim`, `!autokick`, `!kickinactive` and `!invite` when several bots read one Discord server (`!override sky g list`) |
| `guild.peerCommandKeywords` | Keywords of the other bots in the same server; a command naming one of them is ignored |
| `guild.requireKeyword` | `true`: those commands do nothing without this bot's keyword (Sky, Aria). `false`: the keyword is optional (a bot alone in its server) |
| `guild.invite.guildId` / `peerGuildId` | Hypixel guild ids for `!invite <ign>` without a keyword: the bot whose guild has fewer members invites. Empty `peerGuildId` = always invite |
| `guild.invite.winsTie` | Which bot invites when both guilds have the same member count (Sky `true`, Aria `false`) |
| `guild.ranks.ladder` | Ranks from highest to lowest, `{ "name": "Legend", "level": 300 }` (SkyBlock level). The last rank is the default and its level is the guild requirement (`!autokick`, `!reqs`) |
| `guild.ranks.levelsFile` | Optional JSON file `{ "<lowercased rank>": level }` that overrides the ladder levels; read on every use, so editing it needs no restart. `""` = use the ladder levels |
| `guild.ranks.protected` | Staff ranks the claim and kick jobs never touch; also listed first by the online/list commands |
| `guild.ranks.overrides` | `{ "<uuid without dashes>": "<rank>" }` fixed `!claim` results |
| `guild.kickExempt` | IGNs (exact case) the inactivity and requirement kicks skip |
| `guild.protectedPlayers` | IGNs (any case) Discord `!kick` refuses |
| `guild.autoClaim.enabled` / `cron` | Daily rank sync (`/g setrank`) for every member, host local time |
| `guild.inactiveKick.enabled` / `cron` / `days` | Daily kick of members offline for more than `days` days |

`guild` is a nested section with lists, so `migrate-config.js` takes it as a
file instead of flags: write the section to a JSON file (it holds player names,
no secrets) and pass `--guild-file guild.json`. It is added when missing or
still named `GUILD_NAME`, and kept otherwise unless `--force` is given.
`--guild-data-path` and `--help-image` set the two new `paths` keys.

`check-config.js` warns while `guild.name` is the `GUILD_NAME` placeholder and
fails on an empty ladder or a ladder rank without a name. A bot that boots with
the placeholder finds no guild, so every guild command quietly does nothing.

### Values per bot

```jsonc
// Sky
"guild": {
  "name": "TempestSky", "alliedGuilds": ["TempestAria"],
  "commandKeyword": "sky", "peerCommandKeywords": ["aria"], "requireKeyword": true,
  "invite": { "guildId": "<TempestSky id>", "peerGuildId": "<TempestAria id>", "winsTie": true },
  "ranks": {
    "levelsFile": "<host level.json>",
    "ladder": [{ "name": "Legend" }, { "name": "Champion" }, { "name": "Knight" }, { "name": "Recruit" }],
    "protected": ["Guild Master", "Elder"],
    "overrides": { "<uuid>": "Champion" }
  },
  "kickExempt": ["<igns>"], "protectedPlayers": ["<owner ign>"],
  "autoClaim": { "enabled": true, "cron": "00 17 * * *" },
  "inactiveKick": { "enabled": false, "cron": "30 17 * * *", "days": 25 }
}
// Aria: name TempestAria, alliedGuilds [], keyword "aria", peers ["sky"],
//   invite ids swapped with winsTie false, autoClaim.enabled false (its old
//   job looked the guild up through a TempestSky member and never matched).
// Shana: name Bakacord, keyword "sky" (what its server types), peers [],
//   requireKeyword false, no invite ids, ladder Master 400 / Expert 300 /
//   Challenger 180 / Beginner 0, protected ["Guild Master", "Baka"],
//   autoClaim at "00 20 * * *".
```

## minecraft.API

| key | meaning |
|---|---|
| `minecraft.API.hypixelAPIkey` | Hypixel API key (pre-existing) |
| `minecraft.API.imgurAPIkey` | Imgur client id used by the image uploader (pre-existing) |
| `minecraft.API.waifuItKey` | waifu.it API token, sent as the `Authorization` header by `stab`, `bonk` and `fuckyou` in both command families. Both hosts use their own token |
| `minecraft.API.statsProxyUrl` | Base URL of the LAN stats proxy, `http://host:port` with **no trailing slash**. Every request is built as `${statsProxyUrl}/v1/profiles/<uuid>?key=...` (or `/v2/` for networth and claim) |
| `minecraft.API.statsProxyKey` | Key the stats proxy expects in the `?key=` query parameter |

All three are required and are reported without their values by
`scripts/check-config.js`. Add them with `--secrets-file` (see above), never as
a command-line argument.

## discord.commands.enabled

Which Discord command modules load.

| value | effect |
|---|---|
| `"*"` | every slash command in `src/discord/commands` and every legacy command in `src/discord/oldcommands` (Sky) |
| `["kick", "help"]` | only commands with those names, in both families |
| `["old:kick", "slash:help"]` | the same, restricted to one family. `old:` = legacy `!command` from `src/discord/oldcommands`, `slash:` = Discord slash command from `src/discord/commands` |

The prefixed form exists because the families share names: Aria runs the legacy
`kick` and has no slash `kick`, and a bare `"kick"` would enable both. Both the
slash-command registration (`DiscordManager.connect`, `discord/CommandHandler`)
and the legacy loader filter through `src/contracts/commandFilter.js`, so the
registered set and the loaded set always agree.

## Sky's values

```jsonc
"web": { "token": "<existing host token>" },
"bridge": {
  "name": "Sky",
  "peerUrl": "http://PEER_HOST_ARIA:3001",   // Aria's address
  "peerGuild": "aria",
  "mirrorOnSend": true,
  "relayBangCommands": true,
  "peerRank": { "rank": "VIP+", "guildRank": "Elder" }
},
"features": {
  "retryOnRateLimit": true,                  // see the note below
  "imageCompression": true,
  "peerDiscordRelay": true
},
"paths": { "blacklist": "<host blacklist path, inside the tempest directory>" },
"discord": { "commands": { "enabled": "*" } }
```

Note on `retryOnRateLimit`: Sky's current build has no retry listener, so
`false` is the bit-for-bit value. `true` adopts Aria's fix for the two Hypixel
error replies and is what the unification plan recommends; the owner decides.

## Aria's values

```jsonc
"web": { "token": "<existing host token>" },
"bridge": {
  "name": "Aria",
  "peerUrl": "http://PEER_HOST_SKY:3001",    // Sky's address
  "peerGuild": "aria",
  "mirrorOnSend": false,
  "relayBangCommands": false,
  "peerRank": { "rank": "VIP+", "guildRank": "BOT" }
},
"features": {
  "retryOnRateLimit": true,
  "imageCompression": false,
  "peerDiscordRelay": false
},
"paths": { "blacklist": "./data/blacklist.txt" },
"discord": {
  "commands": {
    "enabled": [
      "old:autoclaim", "old:autokick", "old:invite", "old:kick", "old:mute",
      "old:override", "old:relog", "old:setrank", "old:unmute"
    ]
  }
}
```

`paths.blacklist` for Aria: the host survey in the unification plan says Aria
has no `tempest` directory, while the old tree read its blacklist from there
(those code paths would fail with ENOENT). Point it at a path that exists on
the host. `bridge.peerRank.rank` only matters when `peerDiscordRelay` is
`true`; Aria keeps `VIP+` here so the value matches its old payload if the
relay is ever turned on.

## Known differences that are not config

- `ExpressManager.message()` answers `"Aria bridge is not online."` on both
  bots. It is a hardcoded string in an HTTP error body; changing it would change
  Sky's output, so it is untouched.
- `src/minecraft/commands/BlacklistCommand.js` writes a relative `blacklist.txt`
  on `blacklist remove` instead of `config.paths.blacklist` (pre-existing bug).
- `src/minecraft/commands/birdCommand.js`: the `bird` command used to be called
  `BirbCommand.js` here and `birdCommand.js` in the Aria tree; the file is
  renamed to `birdCommand.js` so both trees use the command name plus
  `Command`.
