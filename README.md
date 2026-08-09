# PizzaWarriors Armory Bot

**A lean Discord armory card for Warmane characters.**

Look up a character with one slash command and receive a mobile-readable equipment card with real Warmane item icons, a live character render, average item level, and WotLK 3.3.5a GearScoreLite-compatible scoring.

<p align="center">
  <img src="assets/pizzawarriors-armory-card-preview.png" alt="PizzaWarriors Armory equipment card for Lausudo on Lordaeron" width="760">
</p>

## What it does

- Posts `/armory name:<character> [realm]` results directly in Discord.
- Reads equipped slots and item icons from the Warmane Armory.
- Calculates WotLK 3.3.5a GearScoreLite, including Titan's Grip/two-hand handling.
- Generates a branded PizzaWarriors equipment card with legendary orange GearScore and blue iLvl hierarchy.
- Includes an **Open Armory** link and a resilient text-embed fallback.
- Runs without a database, web dashboard, message-content intent, or guild-roster sync.

## Command

```text
/armory name:Lausudo realm:Lordaeron
```

Supported realms are **Lordaeron**, **Icecrown**, and **Blackrock**. The configured default is Lordaeron. Anyone who can use the slash command may look up a public character; guild membership is intentionally not required.

## Requirements

- Node.js **24** or later
- Google Chrome (used in headless mode to render the card without opening terminal windows)
- A Discord application with a bot token and application ID

The bot needs only the `bot` and `applications.commands` invite scopes and the Discord **Guilds** gateway intent. It does not read channel messages.

## Quick start

```powershell
git clone <your-repository-url>
Set-Location Warmane-Discord-Bot
npm ci
Copy-Item .env.example .env
notepad .env
npm run dev
```

Set `DISCORD_GUILD_ID` while testing so Discord registers the slash command in your server immediately. Without it, global command propagation can take time.

Required variables:

```dotenv
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-id
```

See [`.env.example`](.env.example) for the complete configuration reference. Never commit `.env`, a Discord token, or `WARMANE_COOKIE`.

## Production operation

The project includes a PM2 ecosystem file and quiet Windows recovery scripts.

```powershell
pm2 start ecosystem.config.cjs
pm2 save
pm2 status pizza-warriors-armory
Invoke-RestMethod http://127.0.0.1:3000/healthz
```

- `GET /healthz` returns `{ "ok": true }` for health probes.
- Item metadata is cached locally for 30 days in `.cache/items.json` to reduce upstream requests.
- Lookups are throttled per Discord user and server to protect Warmane and the local renderer.
- If Warmane presents a Cloudflare challenge, `WARMANE_COOKIE` can be set from a browser session you control. Treat it as a password.

## Architecture

```text
Discord slash command
        │
        ▼
Warmane Armory ──► item metadata + equipped icons
        │
        ▼
WotLK GearScoreLite scorer ──► PizzaWarriors card renderer ──► Discord attachment
```

The bot uses the Warmane armory grid for the equipped position and icon, then enriches each item with type, level, and quality. The scoring rules are adapted from Pizza Logs' tested GearScoreLite implementation.

## Development and validation

```powershell
npm run typecheck
npm test
npm audit --omit=dev
```

CI runs the same checks on Node 24. Review [the release checklist](docs/RELEASE-CHECKLIST.md) before deploying.

## Security and privacy

- Secrets, runtime cache, and logs are excluded from Git.
- Rendered item-icon URLs are limited to HTTPS Warmane hosts.
- Character and item text is escaped before card rendering.
- No Discord message content, guild roster, or player history is stored.

Read the [security policy](SECURITY.md) and the current [security review](docs/SECURITY-REVIEW.md) before hosting or contributing.

## Contributing

Contributions should stay focused on fast, dependable armory lookup and a clean Discord presentation. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE). PizzaWarriors names and artwork remain their respective owners' marks.
