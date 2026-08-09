/**
 * Define the source and presentation contracts for the future guild upgrade feature.
 *
 * The registry deliberately stores source provenance before it stores an item list:
 * an item can only become a live recommendation after guild reviewers approve the
 * underlying profile and its stat-cap rules.
 */
export type UpgradeProfileStatus = "research" | "approved" | "retired";

export type UpgradeSource = {
  title: string;
  url: string;
  publishedYear: number;
  note: string;
};

export type UpgradeProfile = {
  id: string;
  className: string;
  specName: string;
  status: UpgradeProfileStatus;
  content: "ICC / Ruby Sanctum";
  sources: readonly UpgradeSource[];
  reviewNote: string;
};

/** Candidate Warmane forum profiles collected for PizzaWarriors review. */
export const upgradeProfiles: readonly UpgradeProfile[] = [
  {
    id: "death-knight-pve",
    className: "Death Knight",
    specName: "PvE (all specs)",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "Use the FAQ to identify Warmane-specific differences before translating caps or simulator results into rules.",
    sources: [{ title: "PVE DK FAQ and guidelines for Warmane 2026", url: "https://forum.warmane.com/showthread.php?t=484293", publishedYear: 2026, note: "Current Warmane-specific orientation and simulator caveats." }],
  },
  {
    id: "paladin-holy-pve",
    className: "Paladin",
    specName: "Holy",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "Review the recommended caps and gear paths against PizzaWarriors raid composition before approval.",
    sources: [{ title: "The PvE Holy Paladin in-Depth Guide for patch 3.3.5a", url: "https://forum.warmane.com/showthread.php?t=463331", publishedYear: 2023, note: "Recent 3.3.5a guide covering gearing and stat priorities." }],
  },
  {
    id: "paladin-protection-pve",
    className: "Paladin",
    specName: "Protection",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "Validate encounter-specific effective-health choices separately from general tank gearing.",
    sources: [{ title: "PVE Protection Paladin Guide", url: "https://forum.warmane.com/showthread.php?t=458156", publishedYear: 2023, note: "Recent PvE tank guide and baseline defence discussion." }],
  },
  {
    id: "paladin-retribution-pve",
    className: "Paladin",
    specName: "Retribution",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "Translate the guide's cap, set bonus, and weapon rules into tested profile data before approval.",
    sources: [{ title: "Retribution PvE 3.3.5a", url: "https://forum.warmane.com/showthread.php?t=325565", publishedYear: 2016, note: "Warmane Retribution PvE reference awaiting current guild review." }],
  },
  {
    id: "warrior-fury-pve",
    className: "Warrior",
    specName: "Fury",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "Turn stat caps, armour-penetration timing, and weapon combinations into explicit test cases before approval.",
    sources: [{ title: "Fury Warrior guide by Klinda", url: "https://forum.warmane.com/showthread.php?t=449174", publishedYear: 2022, note: "Modern Warmane Fury reference with gearing coverage." }],
  },
  {
    id: "priest-holy-pve",
    className: "Priest",
    specName: "Holy",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "Compare the guide's haste and mana recommendations with the guild's actual healing assignments.",
    sources: [{ title: "2022 Holy Priest PVE Guide v3.3.5a", url: "https://forum.warmane.com/showthread.php?t=448147", publishedYear: 2022, note: "Stat priorities, BiS discussion, enchants, and a lower-geared example." }],
  },
  {
    id: "priest-discipline-pve",
    className: "Priest",
    specName: "Discipline",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "The guide is comprehensive but older; approve only after a current guild healer checks every gearing rule.",
    sources: [{ title: "Shieldspopping - A PvE Discipline guide", url: "https://forum.warmane.com/showthread.php?p=2764968&t=346233&viewfull=1", publishedYear: 2016, note: "Detailed Discipline mechanics, gear, stat, gem, and enchant reference." }],
  },
  {
    id: "shaman-enhancement-pve",
    className: "Shaman",
    specName: "Enhancement",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "The thread is actively updated, but contested trinket and build choices need two reviewer sign-off.",
    sources: [{ title: "Enhancement Shaman PVE DPS Guide WotLK 3.3.5a", url: "https://forum.warmane.com/showthread.php?t=487029", publishedYear: 2026, note: "Current caps, gear, enchants, gems, and raid-buff discussion." }],
  },
  {
    id: "druid-feral-pve",
    className: "Druid",
    specName: "Feral DPS",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "This is an end-game itemisation reference; retain a separate source for levelling and early-progression paths.",
    sources: [{ title: "Feral Druid PvE DPS Guide 3.3.5a - End Game", url: "https://forum.warmane.com/showthread.php?p=3075334", publishedYear: 2020, note: "End-game rotation and itemisation discussion." }],
  },
  {
    id: "hunter-marksmanship-pve",
    className: "Hunter",
    specName: "Marksmanship",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "The source is useful but old; treat it as supporting evidence, not a direct item list.",
    sources: [{ title: "Donorbashed's MM PvE Guide Version Two", url: "https://forum.warmane.com/showthread.php?t=199061", publishedYear: 2013, note: "Warmane MM PvE reference and class comparison." }],
  },
  {
    id: "warlock-affliction-pve",
    className: "Warlock",
    specName: "Affliction",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "Use for theorycraft context only until a guild reviewer records a current approved profile.",
    sources: [{ title: "Affliction Warlock Compendium 3.3.5", url: "https://forum.warmane.com/showthread.php?t=380134", publishedYear: 2018, note: "Comprehensive Affliction PvE reference." }],
  },
  {
    id: "mage-fire-pve",
    className: "Mage",
    specName: "Fire",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "Confirm every current mechanic and cap before publishing any Mage recommendation.",
    sources: [{ title: "WoTLK Fire Mage PvE Guide", url: "https://forum.warmane.com/showthread.php?t=432029", publishedYear: 2021, note: "Fire Mage PvE candidate source." }],
  },
  {
    id: "rogue-combat-pve",
    className: "Rogue",
    specName: "Combat",
    status: "research",
    content: "ICC / Ruby Sanctum",
    reviewNote: "This guide is more useful for ICC encounter play than a full upgrade table; pair it with a reviewed item plan.",
    sources: [{ title: "Rogue PvE Guide - How not to be basic in ICC", url: "https://forum.warmane.com/showthread.php?p=3007869&t=407197&viewfull=1", publishedYear: 2019, note: "ICC-oriented Rogue PvE and encounter guidance." }],
  },
];

export type UpgradePreview = {
  characterName: string;
  realm: string;
  profile: UpgradeProfile;
  headline: string;
  readiness: string;
  steps: readonly string[];
};

/** Create a non-recommendation preview that demonstrates the future Discord presentation. */
export function createUpgradePreview(characterName: string, realm: string, profile: UpgradeProfile): UpgradePreview {
  return {
    characterName,
    realm,
    profile,
    headline: "Preview only — this is not a live gear recommendation.",
    readiness: profile.status === "approved" ? "Profile approved" : "Profile needs guild review",
    steps: [
      "Check stat caps and mandatory set bonuses before comparing raw item level.",
      "Identify the weakest eligible equipped slot using the approved profile's rules.",
      "Show only upgrades available in the selected raid tier, with source and confidence.",
    ],
  };
}

/** Find profiles by class name, allowing the Discord preview to show provenance without loading armory data. */
export function findUpgradeProfiles(className?: string): readonly UpgradeProfile[] {
  if (!className) return upgradeProfiles;
  return upgradeProfiles.filter((profile) => profile.className.toLowerCase() === className.toLowerCase());
}

/** List every specialization that currently has a research profile for the Discord selector. */
export const upgradeSpecNames = [...new Set(upgradeProfiles.map((profile) => profile.specName))];

/** Find the closest research profile for the class and user-selected specialization. */
export function findUpgradeProfile(className: string, specName: string): UpgradeProfile | undefined {
  const sameClass = findUpgradeProfiles(className);
  return sameClass.find((profile) => profile.specName.toLowerCase() === specName.toLowerCase())
    ?? sameClass.find((profile) => profile.specName.includes("(all specs)"));
}

/** Format a compact source line that is safe to use inside a Discord embed field. */
export function formatUpgradeSources(profile: UpgradeProfile): string {
  return profile.sources.map((source) => `[${source.title}](${source.url})`).join("\n");
}
