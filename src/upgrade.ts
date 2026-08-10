/**
 * Shared presentation contracts for sheet-driven upgrade cards.
 *
 * The live command reads target items from the PizzaWarriors Best-in-Slot
 * spreadsheet. The small legacy index remains only for preview-test coverage.
 */
export type UpgradeProfileStatus = "research" | "approved" | "retired";

export type UpgradeSource = { title: string; url: string; publishedYear: number; note: string };
export type UpgradeTarget = { id?: number; slot: string; name: string; icon: string; aliases?: string[] };
export type UpgradeProfile = {
  id: string;
  className: string;
  specName: string;
  status: UpgradeProfileStatus;
  content: "ICC / Ruby Sanctum";
  sources: readonly UpgradeSource[];
  reviewNote: string;
  targets?: readonly UpgradeTarget[];
};

const legacyProfiles: readonly UpgradeProfile[] = [
  { id: "warrior-fury-pve", className: "Warrior", specName: "Fury", status: "research", content: "ICC / Ruby Sanctum", reviewNote: "Superseded by the Best-in-Slot sheet.", sources: [{ title: "Fury Warrior guide by Klinda", url: "https://forum.warmane.com/showthread.php?t=449174", publishedYear: 2022, note: "Historical source." }] },
  { id: "paladin-retribution-pve", className: "Paladin", specName: "Retribution", status: "research", content: "ICC / Ruby Sanctum", reviewNote: "Superseded by the Best-in-Slot sheet.", sources: [{ title: "Retribution PvE 3.3.5a", url: "https://forum.warmane.com/showthread.php?t=325565", publishedYear: 2016, note: "Historical source." }] },
  { id: "death-knight-frost-pve", className: "Death Knight", specName: "Frost", status: "research", content: "ICC / Ruby Sanctum", reviewNote: "Superseded by the Best-in-Slot sheet.", sources: [{ title: "PVE DK FAQ and guidelines for Warmane 2026", url: "https://forum.warmane.com/showthread.php?t=484293", publishedYear: 2026, note: "Historical source." }] },
];

export type UpgradePreview = { characterName: string; realm: string; profile: UpgradeProfile; headline: string; readiness: string; steps: readonly string[] };

export function createUpgradePreview(characterName: string, realm: string, profile: UpgradeProfile): UpgradePreview {
  return { characterName, realm, profile, headline: "Preview only — this is not a live gear recommendation.", readiness: profile.status === "approved" ? "Profile approved" : "Profile needs guild review", steps: ["Check stat caps and mandatory set bonuses before comparing raw item level.", "Identify the weakest eligible equipped slot using the approved profile's rules.", "Show only upgrades available in the selected raid tier, with source and confidence."] };
}

export function findUpgradeProfiles(className?: string): readonly UpgradeProfile[] {
  return className ? legacyProfiles.filter((profile) => profile.className.toLowerCase() === className.toLowerCase()) : legacyProfiles;
}

export function findUpgradeProfile(className: string, specName: string): UpgradeProfile | undefined {
  return findUpgradeProfiles(className).find((profile) => profile.specName.toLowerCase() === specName.toLowerCase());
}

export function formatUpgradeSources(profile: UpgradeProfile): string {
  return profile.sources.map((source) => `[${source.title}](${source.url})`).join("\n");
}
