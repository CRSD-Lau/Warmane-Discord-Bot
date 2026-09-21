import assert from "node:assert/strict";
import { chromium } from "playwright";
import { ArmoryCardRenderer } from "../src/card.js";

process.env.DISCORD_TOKEN = "fixture-token";
process.env.DISCORD_CLIENT_ID = "fixture-client";
const { readEquippedSlots } = await import("../src/armory.js");
const bundledBrowser = await chromium.launch({ headless: true });
try {
  assert.ok((await bundledBrowser.version()).length > 0, "bundled Chromium should launch");
} finally {
  await bundledBrowser.close();
}

const chromeBrowser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const context = await chromeBrowser.newContext();
  const page = await context.newPage();
  await page.setContent(`<section class="item-left"><div class="item-slot"><a rel="item=51143"><img src="http://cdn.warmane.com/item.png"></a></div></section>`);
  const equipped = await readEquippedSlots(page);
  assert.deepEqual(equipped, [{ id: 51143, slot: "Head", fallbackEquipLoc: "INVTYPE_HEAD", iconUrl: "https://cdn.warmane.com/item.png" }]);
  await context.close();

  const renderer = new ArmoryCardRenderer();
  try {
    const card = await renderer.render({ name: "Fixture", realm: "Lordaeron", items: [{ id: 51143, slot: "Head", name: "Fixture Helm", itemLevel: 277, quality: "epic", equipLoc: "INVTYPE_HEAD" }], summary: { score: 6200, averageItemLevel: 277, scoredItemCount: 1, itemScores: new Map([[51143, 6200]]) } });
    assert.ok(card.length > 8_000, "renderer should produce a non-empty PNG card");
    assert.equal(card.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  } finally {
    await renderer.close();
  }
} finally {
  await chromeBrowser.close();
}

console.log("Playwright bundled-browser and Chrome-channel scrape/card smoke passed.");
