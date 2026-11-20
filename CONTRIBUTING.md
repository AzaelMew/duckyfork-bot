# Contributing

Pull requests go to **AzaelMew/duckyfork-bot** only. The Aria repo is a snapshot
of the older tree and does not accept changes.

## Sending a change

1. Fork the repo, branch off `main`, open a pull request against `main`.
   Do not push to `main` and never force-push.
2. One change per PR. Keep it small: over ~400 changed lines or 12 files the
   owner reviews it by hand before anything else happens.
3. Say which bot the change affects (Sky, Aria or both) and how you tested it.
   If player- or Discord-visible output changes, quote the before/after text.
4. The PR must be green in the `pr-gate` workflow (`verify`, `secrets`, `risk`)
   before it is looked at.

## What never belongs in a PR

- `config.json`, `auth-cache/`, `data/`, `logs/`. They are gitignored and
  host-specific; the gate refuses a diff that touches them.
- Tokens, API keys, webhook URLs, Discord IDs of private channels. The
  `secrets` job scans the added lines and will fail the PR.
- LAN addresses (`192.168.0.x`) and host paths such as the `tempest` directory.
  Read them from config instead of hardcoding them.
- A new dependency, or a major bump of an existing one, without discussing it
  first. The gate flags both as high risk.

## Running the gate locally

```bash
cp config.example.json config.json     # gitignored, never commit it
npm ci --ignore-scripts --no-audit --no-fund
node scripts/check-config.js config.json
node scripts/smoke-load.js
node scripts/lint-ratchet.js origin/main
npx jest --forceExit --runInBand
```

`scripts/lint-ratchet.js` only fails on errors a PR adds: the repo has ~488
pre-existing ESLint errors, so `npm run lint` is not a gate.

## Things that bite in this bot

- Every `this.send()` in a command is mirrored to the peer bot's guild chat, so
  one command should send one line. Multi-line output needs a throttle.
- `skyhelper-networth` starts a timer when it is required; anything that loads
  the bot code has to `process.exit()` at the end or it hangs.
- Node 18 is what CI and both hosts run. Do not use newer syntax or APIs.
