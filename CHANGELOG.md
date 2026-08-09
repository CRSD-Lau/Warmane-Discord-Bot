# Changelog

All notable changes to PizzaWarriors Armory Bot are documented here.

## [2.0.0] - 2026-08-09

### Changed

- Reworked the original Warmane Discord Bot into the focused PizzaWarriors Armory experience.
- Replaced the legacy `/gs`, `/guild`, and `/profile` command surface with a single `/armory` command and an accessible equipment-card attachment.
- Migrated the runtime to strict TypeScript and Node.js 24.

## [1.0.0] - 2026-08-09

### Added

- `/armory` Discord slash command for Warmane character lookup.
- WotLK 3.3.5a GearScoreLite-compatible scoring.
- PizzaWarriors equipment-card attachment with Warmane item thumbnails and character model preview.
- PM2 recovery scripts, health endpoint, CI, dependency updates, and security documentation.

### Security

- Added HTTPS Warmane icon-host validation, escaped card text, ignored local credentials, and lookup throttling.
