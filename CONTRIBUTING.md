# Contributing

Pull requests go **only** to `AzaelMew/duckyfork-bot`. That repository runs the
Sky bot and, after the merge, the Aria bot too; `duckyfork-bot-aria` is being
retired, so a fix that lands there is a fix that will be lost.

## Before you open a PR

1. Branch off `main`, keep the change small and focused.
2. Node 18 is what the bots and CI run. Do not use newer syntax or APIs.
3. **Never** edit `config.json`, tokens, `auth-cache/`, `data/` or `logs/`, and
   never commit them. Bot credentials live on the hosts only; the repository
   holds `config.example.json` with placeholders.
4. **Never** add a dependency, or bump one a major version, without saying why
   in the PR. Express, discord.js, @discordjs/rest, skyhelper-networth and
   mineflayer are the risky five: their majors are ignored by Dependabot and
   need a person.
5. No force-pushes, no rewriting history, no pushing to `main`.

## Running the gate locally

```bash
npm ci
cp config.example.json config.json     # placeholder values, never commit it
node scripts/check-config.js config.json
node scripts/smoke-load.js             # loads every command module
npx jest --forceExit --runInBand
node scripts/lint-ratchet.js origin/main
node scripts/pr-risk.js origin/main
```

`lint-ratchet` only looks at files your branch changed and only fails when the
error count for a file went up: the repo has plenty of old ESLint errors, do not
fix those in an unrelated PR.

## What CI checks

Every PR runs `.github/workflows/pr-gate.yml`:

- `verify`: config schema, `node --check` syntax, every command module loads,
  ESLint ratchet, jest.
- `secrets`: gitleaks on the commits the PR adds, plus a grep for hardcoded
  `Authorization:` values, LAN IPs, `/tempest/` paths and committed config or
  logs.
- `risk`: classifies the PR as `low` or `high` (high-risk files, dependency
  majors, changed exports, diff size, new outbound hosts, extra chat sends).
  `high` does not fail the run, it means the owner reviews before merge.

## Writing bot commands

- One `this.send(...)` per command where possible: every send is mirrored into
  the other guild, so two sends means two lines in both guilds.
- Multi-line output must be throttled, otherwise the bot floods guild chat.
- Never interpolate an upstream `error.message` into a chat message: it leaks
  internals to players.
- New network endpoints are a risk: say which host and why in the PR.

## Commit messages

Short summary line, then what changed and how it was tested. Mention which bot
you tested against (Sky, Aria, or neither).
