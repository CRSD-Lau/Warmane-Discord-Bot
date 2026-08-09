import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import type { GearItem, GearScoreSummary } from "./gearscore.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_FILE = join(ROOT, "assets", "pizzawarriors-armory-discord-icon-1024.png");
const LEGENDARY = "#ff8000";

type CardInput = {
  name: string;
  realm: string;
  items: GearItem[];
  summary: GearScoreSummary;
  portrait?: Buffer;
};

const armorSlots = ["Head", "Neck", "Shoulder", "Back", "Chest", "Shirt", "Wrist", "Hands", "Waist", "Legs", "Feet"] as const;
const accessorySlots = ["Ring 1", "Ring 2", "Trinket 1", "Trinket 2"] as const;
const weaponSlots = ["Main Hand", "Off Hand", "Ranged"] as const;

const qualityColors: Record<string, string> = {
  poor: "#9d9d9d", common: "#f0f0f0", uncommon: "#1eff00", rare: "#0070dd", epic: "#a335ee", legendary: LEGENDARY, artifact: "#e6cc80", heirloom: "#00ccff",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function dataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function safeIconUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const isWarmaneHost = url.hostname === "warmane.com" || url.hostname.endsWith(".warmane.com");
    return url.protocol === "https:" && isWarmaneHost ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function scoreBand(score: number): string {
  if (score > 5_000) return "Legendary";
  if (score > 4_000) return "Epic";
  if (score > 3_000) return "Superior";
  if (score > 2_000) return "Uncommon";
  return "Common";
}

function rows(items: GearItem[], scores: Map<number, number>, slots: readonly string[]): string {
  const wanted = new Map(items.map((item) => [item.slot, item]));
  return slots.flatMap((slot) => {
    const item = wanted.get(slot);
    if (!item) return [];
    const score = scores.get(item.id);
    const iconUrl = safeIconUrl(item.iconUrl);
    const icon = iconUrl
      ? `<img class="item-icon" src="${escapeHtml(iconUrl)}" alt="">`
      : `<span class="item-icon missing">?</span>`;
    const quality = qualityColors[item.quality.toLowerCase()] ?? qualityColors.epic;
    return `<div class="row">
      <span class="icon-frame" style="--quality:${quality}">${icon}</span>
      <span class="slot">${escapeHtml(item.slot)}</span>
      <span class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
      <span class="level">i${item.itemLevel}</span>
      <span class="item-score">${score?.toLocaleString() ?? "—"} GS</span>
    </div>`;
  }).join("");
}

function section(label: string, items: GearItem[], scores: Map<number, number>, slots: readonly string[]): string {
  return `<section><h2>${label}</h2>${rows(items, scores, slots)}</section>`;
}

export class ArmoryCardRenderer {
  private browser?: Browser;
  private logo?: Promise<string>;

  async close(): Promise<void> { await this.browser?.close(); }

  private async getBrowser(): Promise<Browser> {
    // Avoid Playwright's console-subsystem headless-shell on Windows.
    this.browser ??= await chromium.launch({ headless: true, channel: "chrome" });
    return this.browser;
  }

  private async getLogo(): Promise<string> {
    this.logo ??= readFile(LOGO_FILE).then((buffer) => dataUrl(buffer, "image/png"));
    return this.logo;
  }

  async render(input: CardInput): Promise<Buffer> {
    const [browser, logo] = await Promise.all([this.getBrowser(), this.getLogo()]);
    // Discord downscales attachment previews. Render at 2x so the character
    // thumbnail, item icons, and type remain crisp in the message preview.
    const context = await browser.newContext({ viewport: { width: 920, height: 1_400 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const portrait = input.portrait ? dataUrl(input.portrait, "image/png") : undefined;
    // A tall one-column card is height-capped and aggressively shrunk by Discord.
    // Two balanced columns make the attachment much wider and readable in-chat.
    const equipment = `<div class="equipment-grid"><div>${section("Armor", input.items, input.summary.itemScores, armorSlots.slice(0, 6))}${section("Accessories", input.items, input.summary.itemScores, accessorySlots)}</div><div>${section("Armor", input.items, input.summary.itemScores, armorSlots.slice(6))}${section("Weapons", input.items, input.summary.itemScores, weaponSlots)}</div></div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      * { box-sizing: border-box; } body { margin: 0; padding: 24px; background: #0b0e13; color: #f2f4f8; font-family: "Segoe UI", Arial, sans-serif; }
      .card { width: 872px; overflow: hidden; border: 1px solid #323946; border-left: 6px solid ${LEGENDARY}; border-radius: 14px; background: #151a22; box-shadow: 0 18px 50px rgba(0,0,0,.35); padding: 28px; }
      .brand { display: flex; align-items: center; gap: 12px; color: #f4f6fa; font-size: 20px; font-weight: 700; letter-spacing: -.2px; }
      .brand img { width: 38px; height: 38px; object-fit: cover; border-radius: 50%; border: 1px solid rgba(255,128,0,.65); }
      .identity { display: flex; justify-content: space-between; align-items: start; gap: 24px; margin: 24px 0 22px; }
      .name { color: #45a5ff; font-weight: 800; font-size: 34px; letter-spacing: -.8px; line-height: 1.08; }
      .realm { color: #95a0b4; font-weight: 600; font-size: 16px; margin-top: 7px; }
      .portrait { width: 164px; height: 204px; border: 1px solid #363e4d; border-radius: 12px; object-fit: contain; background: #0c0f14; }
      .stats { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #303744; border-bottom: 1px solid #303744; padding: 18px 0; margin-bottom: 22px; }
      .stat { padding: 0 18px; border-left: 1px solid #303744; } .stat:first-child { padding-left: 0; border-left: 0; }
      .label { display: block; color: #a7b0c0; font-size: 13px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; }
      .value { display: block; margin-top: 7px; font-size: 31px; line-height: 1; font-weight: 800; letter-spacing: -.7px; } .gear .value, .gear .sub, .item-score { color: ${LEGENDARY}; } .level-stat .value, .level { color: #55aaff; }
      .sub { display: block; margin-top: 6px; color: #c5ccd7; font-size: 15px; font-weight: 600; }
      .equipment-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; } section + section { margin-top: 22px; } h2 { margin: 0 0 9px; color: #bfc8d6; font-size: 14px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; }
      .row { display: grid; grid-template-columns: 34px 64px minmax(0, 1fr) 48px 60px; align-items: center; min-height: 43px; gap: 7px; border-top: 1px solid #2a303b; padding: 4px 6px; background: rgba(8,12,18,.15); }
      .row:first-of-type { border-radius: 10px 10px 0 0; } .row:last-child { border-radius: 0 0 10px 10px; border-bottom: 1px solid #2a303b; }
      .icon-frame { width: 29px; height: 29px; display: block; overflow: hidden; border: 1px solid var(--quality); border-radius: 5px; background: #080a0e; } .item-icon { width: 100%; height: 100%; object-fit: cover; display: block; } .missing { color: #8d98a9; text-align: center; line-height: 27px; font-weight: 800; }
      .slot { color: #aeb8c8; font-size: 12px; font-weight: 600; } .item-name { overflow: hidden; color: #f1f3f7; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
      .level, .item-score { justify-self: end; font-size: 12px; font-weight: 800; white-space: nowrap; } .level { background: #202937; border-radius: 5px; padding: 4px 5px; }
      .footer { margin-top: 26px; padding-top: 15px; border-top: 1px solid #303744; color: #8994a6; font-size: 12px; } .footer strong { color: #d9dfe9; }
    </style></head><body><main class="card">
      <header class="brand"><img src="${logo}" alt="PizzaWarriors"><span>PizzaWarriors Armory</span></header>
      <div class="identity"><div><div class="name">${escapeHtml(input.name)}</div><div class="realm">${escapeHtml(input.realm)} · Equipped Loadout</div></div>${portrait ? `<img class="portrait" src="${portrait}" alt="${escapeHtml(input.name)}">` : ""}</div>
      <div class="stats"><div class="stat gear"><span class="label">GearScore</span><span class="value">${input.summary.score.toLocaleString()}</span><span class="sub">${scoreBand(input.summary.score)}</span></div><div class="stat level-stat"><span class="label">Average iLvl</span><span class="value">${input.summary.averageItemLevel}</span><span class="sub">Equipped average</span></div><div class="stat"><span class="label">Items scored</span><span class="value">${input.summary.scoredItemCount}/19</span><span class="sub">GearScoreLite</span></div></div>
      ${equipment}<div class="footer"><strong>PizzaWarriors Armory</strong> · Warmane Armory · WotLK 3.3.5a GearScoreLite</div>
    </main></body></html>`;
    try {
      await page.setContent(html, { waitUntil: "load" });
      await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, { timeout: 8_000 }).catch(() => undefined);
      return await page.locator(".card").screenshot({ type: "png" });
    } finally {
      await context.close();
    }
  }
}
