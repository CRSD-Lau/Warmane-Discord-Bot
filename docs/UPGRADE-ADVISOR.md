# PizzaWarriors Upgrade Advisor — Concept Walkthrough

The upgrade advisor is intentionally a **preview scaffold**, not a live recommendation engine. It proves the Discord experience and gives officers a source-review workflow before anyone is told to chase an item.

## Try it safely

Restart the bot from this repository after pulling the scaffold. Guild-scoped commands normally refresh within seconds.

```text
/upgrade name:Lausudo spec:Retribution realm:Lordaeron
```

`/upgrade` reads the public Armory character to identify its class; the member selects their intended specialization from the pre-populated Discord selector. The command does **not** compare items, save data, or judge gear. It simply illustrates what the eventual post will contain for that class/spec profile.

## What the preview post looks like

```text
PizzaWarriors Upgrade Advisor · Concept Preview

Lausudo · Lordaeron · Retribution Paladin
Preview only — this is not a live gear recommendation.

PROFILE                         READINESS
Warrior · Fury                  Profile needs guild review
ICC / Ruby Sanctum

HOW A LIVE RESULT WILL WORK
1. Check stat caps and mandatory set bonuses before comparing raw item level.
2. Identify the weakest eligible equipped slot using the approved profile's rules.
3. Show only upgrades available in the selected raid tier, with source and confidence.

RESEARCH SOURCE
Fury Warrior guide by Klinda

No armory lookup or gear judgement was made in this preview.
```

## What a real post would look like after approval

This is an illustration, not an item recommendation or a promise about any particular character.

```text
PizzaWarriors Upgrade Advisor

Lausudo · Lordaeron · Fury Warrior
Profile: Fury ICC/RS v1.0 · Approved 2026-08-XX

PRIORITY 1 · CAP CHECK
Hit and expertise: on target

PRIORITY 2 · BEST AVAILABLE SLOT
Current: [equipped item]
Candidate: [approved raid-tier item]
Why: +effective value after caps; preserves required set bonus.
Confidence: High · Approved guild profile

NEXT PATH
ICC 25 → Heroic ICC → Ruby Sanctum

Source: PizzaWarriors Fury ICC/RS v1.0 · View profile
```

The eventual live command should never rank an item solely because its item level or GearScore is bigger. It must check cap rules, set-bonus breakpoints, weapon combinations, role, and raid tier first.

## Sources currently registered

All profiles in the code are `research` status. They are useful evidence, but cannot produce live upgrade results.

| Class / profile | Main forum source | Why it is present |
| --- | --- | --- |
| Death Knight, PvE | [2026 DK FAQ](https://forum.warmane.com/showthread.php?t=484293) | Warmane-specific mechanics and simulation caveats. |
| Paladin, Holy | [Holy Paladin in-depth guide](https://forum.warmane.com/showthread.php?t=463331) | Recent stat and gear reference. |
| Paladin, Protection | [Protection Paladin guide](https://forum.warmane.com/showthread.php?t=458156) | Tank baseline reference. |
| Paladin, Retribution | [Retribution PvE guide](https://forum.warmane.com/showthread.php?t=325565) | Candidate source awaiting current guild review. |
| Warrior, Fury | [Fury Warrior guide](https://forum.warmane.com/showthread.php?t=449174) | Gearing-oriented 2022 reference. |
| Priest, Holy | [Holy Priest guide](https://forum.warmane.com/showthread.php?t=448147) | Gear, stats, enchants, and lower-geared example. |
| Priest, Discipline | [Shieldspopping](https://forum.warmane.com/showthread.php?p=2764968&t=346233&viewfull=1) | Detailed supporting mechanics and gear reference. |
| Shaman, Enhancement | [Enhancement guide](https://forum.warmane.com/showthread.php?t=487029) | Current caps, gear, gems, enchants, and discussion. |
| Druid, Feral DPS | [Feral end-game guide](https://forum.warmane.com/showthread.php?p=3075334) | End-game itemisation context. |
| Hunter, Marksmanship | [MM guide v2](https://forum.warmane.com/showthread.php?t=199061) | Supporting Warmane Hunter reference; old, so not automatic. |
| Warlock, Affliction | [Affliction compendium](https://forum.warmane.com/showthread.php?t=380134) | Supporting theorycraft source. |
| Mage, Fire | [Fire Mage guide](https://forum.warmane.com/showthread.php?t=432029) | Candidate source awaiting mechanics review. |
| Rogue, Combat | [ICC Rogue guide](https://forum.warmane.com/showthread.php?p=3007869&t=407197&viewfull=1) | Encounter-oriented supporting source. |

## Officer approval checklist

Approve one profile at a time. A profile becomes eligible for implementation only when every box is checked.

- [ ] The guide is explicitly WotLK 3.3.5a PvE and relevant to Lordaeron/your intended content.
- [ ] A PizzaWarriors class lead has checked its claims against current Warmane behaviour.
- [ ] Required hit, expertise, defence, haste, armour-penetration, or other caps are written down with assumptions.
- [ ] Set-bonus breakpoints, weapon pairings, and trinket exceptions are captured.
- [ ] The guild's accessible raid tiers and loot rules are defined.
- [ ] At least five real armories are manually reviewed against the proposed result.
- [ ] The profile has a named reviewer, version, and review date.
- [ ] A second officer signs off on the final item path.

## If you like the concept: implementation path

1. Pick the first three guild-critical profiles—for example Fury Warrior, Holy Paladin, and Enhancement Shaman.
2. Convert each approved profile into a small, versioned data file containing caps, constraints, allowed content, and reviewed candidate items.
3. Add `/link` so members can choose a public character, realm, and spec.
4. Extend `/upgrade` so it evaluates only an approved profile and links the evidence.
5. Test against officer-provided armories before enabling recommendations for the guild.
6. Optionally add `/ready` later to combine linked character GearScore and approved readiness context with Raid-Helper event signups.

## Guardrails that stay on

- A missing, `research`, or retired profile produces no recommendation.
- Every recommendation identifies the profile version and review date.
- No hidden score decides an upgrade; the post states its cap, set, content, and source assumptions.
- The bot makes no claims about player skill, raid eligibility, or loot entitlement.
- Warmane mechanics changes require profile review before the profile is used again.
