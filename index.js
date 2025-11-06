// index.js — Warmane (Lordaeron) Discord bot
//
// Commands:
//   /gs <name>      → GearScore (classic 3.3.5a feel)
//                     • Slots come from the Armory character grid (so weights are always right)
//                     • iLvl/quality come from Cavern of Time / Wowhead (robust fallbacks)
//   /guild          → Full guild roster (pulls all Armory pages, preserves Armory order), button pagination
//   /profile <name> → Armory profile screenshot (with padding + rounded border + soft shadow)
//
// Notes (for future-me):
// - I use Playwright so Cloudflare doesn’t break scraping.
// - I compute GS using the classic community formula + tiny calibration so it matches the usual addon totals.
// - I keep item metadata cached on disk so we don’t hammer external sites for every request.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

/* ───────────────────────────── Config ───────────────────────────── */

const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID  = process.env.GUILD_ID;

const REALM         = (process.env.WARMANE_REALM || 'Lordaeron').trim();
const DEFAULT_GUILD = (process.env.WARMANE_GUILD || '').trim();

const HEADLESS  = String(process.env.HEADLESS || 'true').toLowerCase() === 'true';
const RAW_COOKIE = (process.env.WARMANE_COOKIE || '').trim(); // helps w/ CF if you paste a browser cookie
const CDP_URLS   = (process.env.CDP_URLS || process.env.CDP_URL || '')
  .split(',').map(s => s.trim()).filter(Boolean); // optional: connectOverCDP to an existing Chrome

const TZ = process.env.TZ || 'America/Moncton';

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Missing DISCORD_TOKEN / CLIENT_ID / GUILD_ID in .env');
  process.exit(1);
}

/* ─────────────────────────── Keepalive ─────────────────────────── */

const app = express();
app.get('/', (_req, res) => res.send('Warmane bot is alive.'));
app.listen(process.env.PORT || 3000);

/* ──────────────────────────── Cache ───────────────────────────── */

const CACHE_FILE = path.join(process.cwd(), 'warmane-cache.json');
let cache = { items: {} };
try { if (fs.existsSync(CACHE_FILE)) cache = { ...cache, ...JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) }; } catch {}
const saveCache = () => { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2)); } catch {} };

/* ───────────────────────── URLs / helpers ─────────────────────── */

const encodeWarmane = s => encodeURIComponent(s).replace(/%20/g, '+');

const charUrl = (name) =>
  `https://armory.warmane.com/character/${encodeWarmane(name.charAt(0).toUpperCase()+name.slice(1))}/${encodeWarmane(REALM)}/summary`;

const guildUrl = (guildName, seg='summary') =>
  `https://armory.warmane.com/guild/${encodeWarmane(guildName)}/${encodeWarmane(REALM)}/${seg}`;

/* ───────────────────────── Playwright ─────────────────────────── */

async function usingBrowser(run) {
  const pw = require('playwright');

  // If I have a CDP endpoint, try attaching first (fast path on dev boxes).
  for (const url of CDP_URLS) {
    try {
      const browser = await pw.chromium.connectOverCDP(url);
      const ctx  = browser.contexts()[0] || await browser.newContext({ timezoneId: TZ, locale: 'en-US' });
      const page = await ctx.newPage();
      try { return await run(page); }
      finally { try { await page.close(); } catch {} }
    } catch {}
  }

  // Otherwise launch a persistent Chromium (survives CF better).
  const context = await pw.chromium.launchPersistentContext(path.join(process.cwd(), 'pw-profile'), {
    headless: HEADLESS,
    viewport: { width: 1440, height: 1120 },
    locale: 'en-US',
    timezoneId: TZ,
    ignoreHTTPSErrors: true,
    bypassCSP: true,
  });

  try {
    // Basic stealth
    await context.addInitScript(() => {
      try { Object.defineProperty(navigator, 'webdriver', { get: () => false }); } catch {}
      try { window.chrome = window.chrome || { runtime: {} }; } catch {}
    });

    // Optional cookie injection to chill CF
    if (RAW_COOKIE) {
      const toCookies = (domain) => RAW_COOKIE.split(';').map(s=>s.trim()).filter(Boolean).map(kv=>{
        const i = kv.indexOf('=');
        if (i<=0) return null;
        return { name: kv.slice(0,i), value: kv.slice(i+1), domain, path:'/', secure:true, httpOnly:false };
      }).filter(Boolean);
      await context.addCookies([
        ...toCookies('.warmane.com'),
        ...toCookies('warmane.com'),
        ...toCookies('www.warmane.com'),
        ...toCookies('armory.warmane.com'),
      ]);
    }

    context.setDefaultTimeout(30000);
    const page = await context.newPage();
    const out  = await run(page);
    try { await page.close(); } catch {}
    return out;
  } finally {
    await context.close();
  }
}

async function gotoEx(page, url, waits=['domcontentloaded','load','networkidle'], attempts=3, timeout=30000) {
  for (let i=0;i<attempts;i++){
    for (const w of waits) {
      try { await page.goto(url, { waitUntil: w, timeout }); return; } catch {}
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`gotoEx failed for ${url}`);
}

async function warmUp(page){
  try { await gotoEx(page,'https://warmane.com/', ['domcontentloaded','load'], 2, 20000); } catch {}
  try { await gotoEx(page,'https://armory.warmane.com/', ['domcontentloaded','load'], 2, 20000); } catch {}
  const start = Date.now();
  while (Date.now()-start < 15000) {
    const t = ((await page.locator('body').innerText().catch(()=>''))||'').toLowerCase();
    if (!/just a moment|checking your browser|cloudflare|verifying you are human/.test(t)) break;
    await page.waitForTimeout(600);
  }
}

/* ─────────────────────── GS math (3.3.5a) ─────────────────────── */

// Classic community formula with slot weights; a small multiplier lines up totals with popular GS addons.
const GS = {
  SLOT_MOD: {
    INVTYPE_HEAD:1.00, INVTYPE_NECK:0.5625, INVTYPE_SHOULDER:0.75, INVTYPE_CHEST:1.00, INVTYPE_ROBE:1.00,
    INVTYPE_WAIST:0.75, INVTYPE_LEGS:1.00, INVTYPE_FEET:0.75, INVTYPE_WRIST:0.5625, INVTYPE_HAND:0.75,
    INVTYPE_FINGER:0.5625, INVTYPE_TRINKET:0.5625, INVTYPE_CLOAK:0.5625,
    INVTYPE_RANGED:0.3164, INVTYPE_RANGEDRIGHT:0.3164, INVTYPE_THROWN:0.3164, INVTYPE_RELIC:0.3164,
    INVTYPE_SHIELD:1.00, INVTYPE_HOLDABLE:1.00,
    INVTYPE_WEAPON:1.00, INVTYPE_WEAPONMAINHAND:1.00, INVTYPE_WEAPONOFFHAND:1.00, INVTYPE_2HWEAPON:2.00,
    INVTYPE_TABARD:0.00, INVTYPE_BODY:0.00,
  },
  ERA_MULT: 1.09,                                // calibration so totals match what players expect
  baseFromIlvl(ilvl){ return ((Number(ilvl) - 91.45) / 0.65) * 1.8618; },
};

function computeItemGS(item){
  const ilvl = Number(item?.ilvl || 0);
  if (!ilvl) return 0;
  const sm = GS.SLOT_MOD[String(item?.invtype||'').toUpperCase()] ?? 1.0;
  const raw = GS.baseFromIlvl(ilvl) * sm * GS.ERA_MULT;
  return raw > 0 ? Math.trunc(raw) : 0;
}
function computeCharacterGS(items){ return items.reduce((s,it)=>s+computeItemGS(it),0); }

/* ───────────────────── Slot normalization utils ─────────────────── */

function normalizeInvType(slot){
  if (!slot) return undefined;
  const raw = String(slot).trim();
  const U = raw.toUpperCase();
  if (U.startsWith('INVTYPE_')) return U;

  // Wowhead numeric codes from jsonEquip
  const mapNum = {
    1:'INVTYPE_HEAD',2:'INVTYPE_NECK',3:'INVTYPE_SHOULDER',4:'INVTYPE_BODY',5:'INVTYPE_CHEST',
    6:'INVTYPE_WAIST',7:'INVTYPE_LEGS',8:'INVTYPE_FEET',9:'INVTYPE_WRIST',10:'INVTYPE_HAND',
    11:'INVTYPE_FINGER',12:'INVTYPE_TRINKET',13:'INVTYPE_WEAPON',14:'INVTYPE_SHIELD',
    15:'INVTYPE_RANGED',16:'INVTYPE_CLOAK',17:'INVTYPE_WEAPONMAINHAND',18:'INVTYPE_WEAPONOFFHAND',
    21:'INVTYPE_2HWEAPON',22:'INVTYPE_WEAPON',23:'INVTYPE_RANGEDRIGHT',26:'INVTYPE_THROWN',28:'INVTYPE_RELIC'
  };
  if (/^\d+$/.test(raw) && mapNum[raw]) return mapNum[raw];

  // Free-text (Cavern/Wowhead HTML)
  const pairs = [
    ['Main Hand','INVTYPE_WEAPONMAINHAND'],['Off Hand','INVTYPE_WEAPONOFFHAND'],
    ['Two-Hand','INVTYPE_2HWEAPON'],['Held In Off-hand','INVTYPE_HOLDABLE'],
    ['Shield','INVTYPE_SHIELD'],['Ranged','INVTYPE_RANGED'],['Relic','INVTYPE_RELIC'],
    ['Head','INVTYPE_HEAD'],['Neck','INVTYPE_NECK'],['Shoulder','INVTYPE_SHOULDER'],
    ['Back','INVTYPE_CLOAK'],['Chest','INVTYPE_CHEST'],['Wrist','INVTYPE_WRIST'],
    ['Hands','INVTYPE_HAND'],['Waist','INVTYPE_WAIST'],['Legs','INVTYPE_LEGS'],
    ['Feet','INVTYPE_FEET'],['Finger','INVTYPE_FINGER'],['Trinket','INVTYPE_TRINKET'],
    ['Tabard','INVTYPE_TABARD'],['Shirt','INVTYPE_BODY'],
  ];
  for (const [k,v] of pairs) if (raw.includes(k)) return v;

  return undefined;
}

function inferSlotFromName(name=''){
  const n = name.toLowerCase();
  if (/libram|idol|totem|sigil/.test(n)) return 'INVTYPE_RELIC';
  if (/ring|band|seal/.test(n)) return 'INVTYPE_FINGER';
  if (/cloak|cape|drape|shroud/.test(n)) return 'INVTYPE_CLOAK';
  if (/amulet|choker|pendant|neck/.test(n)) return 'INVTYPE_NECK';
  if (/tabard/.test(n)) return 'INVTYPE_TABARD';
  if (/shirt|doublet/.test(n)) return 'INVTYPE_BODY';
  if (/two\-hand|greatsword|polearm|staff|maul/.test(n)) return 'INVTYPE_2HWEAPON';
  if (/main hand/.test(n)) return 'INVTYPE_WEAPONMAINHAND';
  if (/off[- ]hand/.test(n)) return 'INVTYPE_WEAPONOFFHAND';
  return undefined;
}

/* ───────────────────────── Item metadata ───────────────────────── */

const HTTP_HEADERS = {
  'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8',
  'accept-language':'en-US,en;q=0.9',
  'cache-control':'no-cache','pragma':'no-cache',
};

const parse = {
  titleName: (html) => (html.match(/<title>([^<]+)\s+-\s+Item/i)||[])[1],
  ilvl:      (html) => { const m=html.match(/Item Level\s*(\d{1,3})/i); return m?Number(m[1]):0; },
  quality:   (html) => { const m=html.match(/class="q(\d)"/i); return m?Number(m[1]):undefined; },
  slot:      (html) => { const m=html.match(/<th>\s*Slot\s*<\/th>\s*<td>([^<]+)<\/td>/i); return m?normalizeInvType(m[1]):undefined; },
};

async function fetchItemData(itemId){
  const key=String(itemId);
  const cached = cache.items[key];
  if (cached && Date.now()-(cached.fetchedAt||0) < 14*24*60*60*1000) return cached;

  let name, ilvl=0, quality, invtype;

  // 1) Cavern of Time HTML
  try {
    const { data: html } = await axios.get(`https://wotlk.cavernoftime.com/item=${itemId}`, { timeout:12000, headers:HTTP_HEADERS });
    name = name ?? parse.titleName(html);
    ilvl = ilvl || parse.ilvl(html);
    quality = quality ?? parse.quality(html);
    const s = parse.slot(html); if (!invtype && s) invtype = s;
  } catch {}

  // 2) Wowhead tooltip JSON
  try {
    const { data } = await axios.get(`https://wotlk.wowhead.com/tooltip/item/${itemId}?dataEnv=1`, {
      timeout:12000, headers:{...HTTP_HEADERS, accept:'application/json,text/*,*/*'}
    });
    name = name ?? data.name;
    ilvl = ilvl || Number(data.itemLevel||0);
    if (data.quality!=null) quality = data.quality;
    const s = normalizeInvType(data.inventorySlot || data.slot || data.slotBak || data.invtype || data.json?.slot);
    if (!invtype && s) invtype = s;
  } catch {}

  // 3) Wowhead XML (jsonEquip)
  if (!invtype || !ilvl || !name) {
    try {
      const { data } = await axios.get(`https://wotlk.wowhead.com/item=${itemId}&xml`, { timeout:15000, headers:HTTP_HEADERS });
      const text = String(data);
      const mJE = text.match(/<jsonEquip><!\[CDATA\[(\{.*?\})\]\]><\/jsonEquip>/s);
      if (mJE){
        const je = JSON.parse(mJE[1]);
        ilvl = ilvl || Number(je.ilvl || je.itemlevel || je.level || 0);
        if (je.quality!=null) quality = je.quality;
        const s = normalizeInvType(je.slotbak || je.slot || je.inventorySlot);
        if (!invtype && s) invtype = s;
      }
      if (!name) {
        const m = text.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
        if (m) name = m[1];
      }
      if (!invtype){
        const m = text.match(/<inventorySlot>(.*?)<\/inventorySlot>/);
        if (m) invtype = normalizeInvType(m[1]);
      }
    } catch {}
  }

  // 4) Wowhead HTML (last resort)
  if (!invtype || !ilvl || !name) {
    try {
      const { data: html } = await axios.get(`https://wotlk.wowhead.com/item=${itemId}`, { timeout:12000, headers:HTTP_HEADERS });
      name = name ?? parse.titleName(html);
      ilvl = ilvl || parse.ilvl(html);
      quality = quality ?? parse.quality(html);
      const s = parse.slot(html); if (!invtype && s) invtype = s;
    } catch {}
  }

  if (!invtype && name) invtype = inferSlotFromName(name);

  const res = { id:Number(itemId), name: name || `Item ${itemId}`, ilvl:Number(ilvl||0), quality:Number(quality ?? 4), invtype, fetchedAt:Date.now() };
  cache.items[key]=res; saveCache(); return res;
}

/* ───────────────────── Character equipment ───────────────────── */

// Map the Armory grid (left/right/bottom) to real slots and read item IDs there.
// This guarantees slot weights are correct for GS.
const ARMORY_SLOT_MAP = {
  left:   ['INVTYPE_HEAD','INVTYPE_NECK','INVTYPE_SHOULDER','INVTYPE_CLOAK','INVTYPE_CHEST','INVTYPE_BODY','INVTYPE_TABARD','INVTYPE_WRIST'],
  right:  ['INVTYPE_HAND','INVTYPE_WAIST','INVTYPE_LEGS','INVTYPE_FEET','INVTYPE_FINGER','INVTYPE_FINGER','INVTYPE_TRINKET','INVTYPE_TRINKET'],
  bottom: ['INVTYPE_WEAPONMAINHAND','INVTYPE_WEAPONOFFHAND','INVTYPE_RANGED'],
};

async function scrapeEquippedItems(page, charName){
  await warmUp(page);
  await gotoEx(page, charUrl(charName), ['domcontentloaded','load','networkidle'], 3, 30000);

  try { await page.waitForSelector('#character-profile, .item-left .item-slot', { timeout: 15000 }); } catch {}
  try { for (let i=0;i<5;i++){ await page.mouse.wheel(0, 800); await page.waitForTimeout(200); } } catch {}

  async function readSection(sectionSelector, mapping){
    return await page.evaluate(({sectionSelector, mapping})=>{
      const root = document.querySelector(sectionSelector);
      if (!root) return [];
      const slots = Array.from(root.querySelectorAll('.item-slot'));
      const out = [];
      for (let i=0;i<slots.length;i++){
        const a = slots[i].querySelector('a[rel*="item="], a[href*="item="]'); if (!a) continue;
        const rel=a.getAttribute('rel')||''; const href=a.getAttribute('href')||'';
        const mRel = rel.match(/(?:^|;)item=(\d{2,7})/);
        const mHref = href.match(/(?:\?|\/)item=(\d{2,7})/);
        const id = mRel ? Number(mRel[1]) : (mHref ? Number(mHref[1]) : null);
        if (!id) continue;
        out.push({ id, invtype: mapping[i] || null });
      }
      return out;
    }, { sectionSelector, mapping });
  }

  const equipped = [];
  equipped.push(...await readSection('.item-left', ARMORY_SLOT_MAP.left));
  equipped.push(...await readSection('.item-right', ARMORY_SLOT_MAP.right));
  equipped.push(...await readSection('.item-bottom', ARMORY_SLOT_MAP.bottom));

  // Worst case: return unique IDs without slots (the fetcher may still deduce slot)
  if (!equipped.length) {
    const ids = await page.$$eval('a[rel*="item="], a[href*="item="]', as=>{
      const set = new Set();
      for (const a of as){
        const rel=a.getAttribute('rel')||''; const href=a.getAttribute('href')||'';
        const m = rel.match(/(?:^|;)item=(\d{2,7})/) || href.match(/(?:\?|\/)item=(\d{2,7})/);
        if (m) set.add(Number(m[1]));
      }
      return Array.from(set);
    });
    return ids.map(id=>({ id, invtype:null }));
  }

  return equipped;
}

/* ───────────────────── Guild roster crawling ──────────────────── */

async function extractMembersFromFrame(frame){
  // Try tables (header-aware)
  const tableRows = await frame.$$eval('table', tables=>{
    const list=[];
    for (const table of tables){
      const heads = Array.from(table.querySelectorAll('th')).map(th=>(th.textContent||'').trim().toLowerCase());
      if (!heads.length) continue;
      const rankIdx = heads.findIndex(h=>/(^|\s)rank(s)?($|\s)/.test(h) || h.includes('guild rank'));
      const nameIdx = heads.findIndex(h=>h.includes('name') || h.includes('character'));
      if (nameIdx === -1) continue;

      for (const tr of table.querySelectorAll('tbody tr, tr')){
        const tds = Array.from(tr.querySelectorAll('td')); if (!tds.length) continue;
        const a = tds[nameIdx]?.querySelector('a[href*="/character/"]') || tr.querySelector('a[href*="/character/"]');
        const name = (a?.textContent || tds[nameIdx]?.textContent || '').trim();
        let rank = ''; if (rankIdx !== -1 && tds[rankIdx]) rank = (tds[rankIdx].textContent || '').trim();
        if (name) list.push({ name, rank });
      }
    }
    return list;
  }).catch(()=>[]);

  // Fallback: card-style elements
  const cards = await frame.$$eval('.member, .roster-item, .character, .member-card', els=>{
    const list=[];
    for (const el of els){
      const a = el.querySelector('a[href*="/character/"]');
      const name = a ? (a.textContent||'').trim() : '';
      let rank = ''; const rEl = el.querySelector('.rank, .member-rank, [data-rank]');
      if (rEl) rank = (rEl.getAttribute('data-rank') || rEl.textContent || '').trim();
      if (name) list.push({ name, rank });
    }
    return list;
  }).catch(()=>[]);

  return [...tableRows, ...cards];
}

function extractMembersFromHtml(html){
  const out=[];
  const linkRx = /<a[^>]+href="\/character\/[^"]+"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = linkRx.exec(html)) !== null) {
    const name = (m[1] || '').trim(); if (!name) continue;
    const slice = html.slice(Math.max(0, m.index-400), Math.min(html.length, m.index+800));
    const rankRx = /(?:>|\b)(?:Rank|Guild\s*Rank)\s*[:\s]*<\/?\w*>\s*([^<\n]+)|<td[^>]*>\s*([^<\n]+)\s*<\/td>\s*<\/tr>/i;
    const r = rankRx.exec(slice);
    const rank = ((r && (r[1] || r[2])) || '').toString().trim();
    out.push({ name, rank });
  }
  return out;
}

async function scrapeGuildMembersAllPages(page, guildName){
  await warmUp(page);

  const bases = ['roster','members','summary'];
  const maxPages = 10;
  const out=[]; const seen = new Set();

  const tryOneUrl = async (url) => {
    try { await gotoEx(page, url, ['domcontentloaded','load','networkidle'], 2, 28000); } catch {}
    let added = 0;

    for (const frame of page.frames()){
      let list=[]; try { list = await extractMembersFromFrame(frame); } catch {}
      for (const r of list){
        const nm = (r.name||'').trim(); if (!nm || seen.has(nm)) continue;
        seen.add(nm); out.push({ name:nm, rank:(r.rank||'').replace(/\s+/g,' ').trim() }); added++;
      }
    }

    if (added===0){
      try {
        const html = await page.content();
        const list = extractMembersFromHtml(html);
        for (const r of list){
          const nm = (r.name||'').trim(); if (!nm || seen.has(nm)) continue;
          seen.add(nm); out.push({ name:nm, rank:(r.rank||'').replace(/\s+/g,' ').trim() }); added++;
        }
      } catch {}
    }

    return added;
  };

  for (const base of bases){
    const baseUrl = guildUrl(guildName, base);
    const first = await tryOneUrl(baseUrl);
    if (!first) continue;

    for (let n=2;n<=maxPages;n++){
      const variants = [`${baseUrl}?page=${n}`, `${baseUrl.replace(/\/$/,'')}/page/${n}`, `${baseUrl.replace(/\/$/,'')}/${n}`];
      let added=0;
      for (const u of variants){ const a = await tryOneUrl(u); added += a; if (a>0) break; }
      if (added===0) break;
    }
    break;
  }

  return out;
}

/* ─────────────────────── Discord commands ─────────────────────── */

const commands = [
  new SlashCommandBuilder()
    .setName('gs')
    .setDescription('Compute GearScore for a Lordaeron character')
    .addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('guild')
    .setDescription('List the guild roster (uses WARMANE_GUILD in .env) with pagination'),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Screenshot the Warmane Armory profile for a character')
    .addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),
].map(c => c.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', () => console.log(`✅ Logged in as ${client.user?.tag}`));

/* ──────────────────────── /guild UI bits ─────────────────────── */

const PER_PAGE = 25;
const PAGINATION_WINDOW_MS = 2 * 60 * 1000;

function guildEmbed(gname, members, pageIndex){
  const totalPages = Math.max(1, Math.ceil(members.length/PER_PAGE));
  const slice = members.slice(pageIndex*PER_PAGE, pageIndex*PER_PAGE + PER_PAGE);
  const lines = slice.map(m => `• ${m.name} — ${m.rank || 'rank?'}`).join('\n') || 'No members parsed.';
  return new EmbedBuilder()
    .setTitle(`${gname} — ${REALM}`)
    .setURL(guildUrl(gname, 'summary'))
    .setDescription(lines)
    .addFields(
      { name:'Members', value:String(members.length), inline:true },
      { name:'Page',    value:`${pageIndex+1}/${totalPages}`, inline:true },
    )
    .setFooter({ text:'Roster parsed from Warmane Armory' })
    .setTimestamp(new Date());
}
function guildControls(disabledPrev, disabledNext, session){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`guild_prev:${session}`).setLabel('Prev').setStyle(ButtonStyle.Secondary).setDisabled(disabledPrev),
    new ButtonBuilder().setCustomId(`guild_next:${session}`).setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(disabledNext),
    new ButtonBuilder().setCustomId(`guild_close:${session}`).setLabel('Close').setStyle(ButtonStyle.Danger),
  );
}

/* ───────────────────────── Interactions ───────────────────────── */

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try { await interaction.deferReply(); } catch {}

  try {
    /* ---------- /gs ---------- */
    if (interaction.commandName === 'gs') {
      const name = interaction.options.getString('name', true).trim();

      const result = await usingBrowser(async (page) => {
        const equipped = await scrapeEquippedItems(page, name); // [{ id, invtype }]
        if (!equipped.length) return { items:[], ids:[] };

        const items = [];
        for (const e of equipped) {
          const meta = await fetchItemData(e.id).catch(()=>null);
          if (!meta) continue;
          if (e.invtype) meta.invtype = e.invtype; // trust the Armory grid for slot
          items.push(meta);
        }
        return { items, ids: equipped.map(x=>x.id) };
      });

      if (!result.items.length) {
        await interaction.editReply(`Couldn't read equipped items for **${name}**.\nArmory: ${charUrl(name)}`);
        return;
      }

      // Friendly labels + in-game slot order
      const SLOT_LABELS = {
        INVTYPE_HEAD:'Head', INVTYPE_NECK:'Neck', INVTYPE_SHOULDER:'Shoulder', INVTYPE_CLOAK:'Back',
        INVTYPE_CHEST:'Chest', INVTYPE_BODY:'Shirt', INVTYPE_TABARD:'Tabard', INVTYPE_WRIST:'Wrist',
        INVTYPE_HAND:'Hands', INVTYPE_WAIST:'Waist', INVTYPE_LEGS:'Legs', INVTYPE_FEET:'Feet',
        INVTYPE_FINGER:'Ring', INVTYPE_TRINKET:'Trinket',
        INVTYPE_WEAPONMAINHAND:'Main-Hand', INVTYPE_WEAPONOFFHAND:'Off-Hand', INVTYPE_2HWEAPON:'Two-Hand',
        INVTYPE_RANGED:'Relic', INVTYPE_RANGEDRIGHT:'Relic', INVTYPE_THROWN:'Thrown',
        INVTYPE_RELIC:'Relic', INVTYPE_SHIELD:'Shield', INVTYPE_HOLDABLE:'Off-Hand',
      };
      const SLOT_ORDER = [
        'INVTYPE_HEAD','INVTYPE_NECK','INVTYPE_SHOULDER','INVTYPE_CLOAK','INVTYPE_CHEST',
        'INVTYPE_BODY','INVTYPE_TABARD','INVTYPE_WRIST','INVTYPE_HAND','INVTYPE_WAIST',
        'INVTYPE_LEGS','INVTYPE_FEET','INVTYPE_FINGER','INVTYPE_TRINKET',
        'INVTYPE_WEAPONMAINHAND','INVTYPE_WEAPONOFFHAND','INVTYPE_2HWEAPON',
        'INVTYPE_RANGED','INVTYPE_RELIC',
      ];

      const breakdown = result.items
        .sort((a,b)=>SLOT_ORDER.indexOf(a.invtype||'') - SLOT_ORDER.indexOf(b.invtype||''))
        .map(it=>{
          const slot = SLOT_LABELS[it.invtype] || 'Slot?';
          const nm = (it.name||'').replace(/’/g,"'");
          return `**${slot}:** ${nm} — ilvl ${it.ilvl} — **GS ${computeItemGS(it)}**`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`${name} — ${REALM}`)
        .setURL(charUrl(name))
        .setDescription(breakdown)
        .addFields(
          { name:'Total GearScore', value:String(computeCharacterGS(result.items)), inline:true },
          { name:'Items parsed',    value:String(result.items.length), inline:true },
          { name:'Item IDs',        value:result.ids.join(', ').slice(0,1024) || '—', inline:false },
        )
        .setFooter({ text:'Slots from Armory; iLvl/quality from Cavern/Wowhead; GS = classic 3.3.5a' })
        .setTimestamp(new Date());

      await interaction.editReply({ embeds:[embed] });
      return;
    }

    /* ---------- /guild ---------- */
    if (interaction.commandName === 'guild') {
      const gname = DEFAULT_GUILD;
      if (!gname) { await interaction.editReply('Set `WARMANE_GUILD` in `.env` to use `/guild`.'); return; }

      const members = await usingBrowser(page => scrapeGuildMembersAllPages(page, gname));
      if (!members.length) {
        await interaction.editReply(`Guild page request failed or empty.\nGuild: ${gname}\nLink: ${guildUrl(gname,'summary')}`);
        return;
      }

      const totalPages = Math.max(1, Math.ceil(members.length/PER_PAGE));
      let pageIndex = 0;

      const session = `${interaction.id}`;
      const msg = await interaction.editReply({
        embeds: [guildEmbed(gname, members, pageIndex)],
        components: [guildControls(pageIndex===0, pageIndex>=totalPages-1, session)],
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button, time: PAGINATION_WINDOW_MS,
      });

      collector.on('collect', async (btn) => {
        if (btn.user.id !== interaction.user.id) {
          await btn.reply({ content:'Only the command invoker can use these buttons.', ephemeral:true });
          return;
        }
        const [key, ses] = btn.customId.split(':'); if (ses !== session) return;

        if (key === 'guild_prev') pageIndex = Math.max(0, pageIndex-1);
        if (key === 'guild_next') pageIndex = Math.min(totalPages-1, pageIndex+1);
        if (key === 'guild_close'){ collector.stop('closed'); await btn.update({ components:[] }); return; }

        await btn.update({
          embeds: [guildEmbed(gname, members, pageIndex)],
          components: [guildControls(pageIndex===0, pageIndex>=totalPages-1, session)],
        });
      });

      collector.on('end', async (_c, reason) => {
        if (reason === 'closed') return;
        try { await interaction.editReply({ components:[guildControls(true,true,session)] }); } catch {}
      });

      return;
    }

    /* ---------- /profile ---------- */
    if (interaction.commandName === 'profile') {
      const name = interaction.options.getString('name', true).trim();

      const png = await usingBrowser(async (page) => {
        await warmUp(page);
        await gotoEx(page, charUrl(name), ['domcontentloaded','load','networkidle'], 3, 30000);

        // Add tasteful padding + rounded corners + soft outline so the crop looks nice in Discord
        await page.addStyleTag({ content: `
          body { background: #0a0b0e !important; }
          #character-sheet, #character-profile {
            background: #0e1016 !important;
            border-radius: 16px !important;
            padding: 16px !important;
            box-shadow: 0 14px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08) !important;
          }
        `});

        await page.setViewportSize({ width: 1440, height: 1120 });
        const sel = (await page.$('#character-sheet')) ? '#character-sheet' : '#character-profile';
        await page.waitForSelector(sel, { timeout:15000 });
        return await page.locator(sel).screenshot({ type:'png' });
      });

      await interaction.editReply({
        content: `${name} — ${REALM}\n${charUrl(name)}`,
        files: [{ attachment: png, name: `${name}-armory.png` }],
      });
      return;
    }

    await interaction.editReply('Unknown command.');
  } catch (err) {
    console.error(err);
    try { await interaction.editReply(`Error: ${err.message || err}`); } catch {}
  }
});

/* ───────────────────────────── Boot ───────────────────────────── */

(async () => {
  const rest = new REST({ version:'10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✓ Slash commands registered');
  await client.login(TOKEN);
})();

process.on('unhandledRejection', (r)=>console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e)=>console.error('[uncaughtException]', e));
