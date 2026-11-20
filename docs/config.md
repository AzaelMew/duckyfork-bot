# config.json

One codebase runs both bots; everything that differs between Sky and Aria is in
`config.json`. `config.json` is gitignored and never leaves the host. The
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

Other absolute host paths (`level.json`, `guildData.json`, the HelpCommand
image in the host's `tempest` directory) are still literals in the code and are
not configurable yet.

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
- `src/minecraft/commands/BirbCommand.js` (Sky) and
  `src/minecraft/commands/birdCommand.js` (Aria) are the same `bird` command
  under two file names. Only `BirbCommand.js` is in this tree; adding the other
  would register a duplicate.
