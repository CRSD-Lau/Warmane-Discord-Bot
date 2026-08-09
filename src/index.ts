import { createServer } from "node:http";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { WarmaneArmory } from "./armory.js";
import { ArmoryCardRenderer } from "./card.js";
import { config } from "./config.js";
import { calculateGearScore } from "./gearscore.js";
import { createUpgradePreview, findUpgradeProfile, formatUpgradeSources, upgradeSpecNames } from "./upgrade.js";

const command = new SlashCommandBuilder()
  .setName("armory")
  .setDescription("Look up a Warmane character's equipped gear and GearScore")
  .addStringOption((option) => option.setName("name").setDescription("Character name").setRequired(true).setMaxLength(12))
  .addStringOption((option) => option.setName("realm").setDescription("Warmane realm").addChoices(
    { name: "Lordaeron", value: "Lordaeron" },
    { name: "Icecrown", value: "Icecrown" },
    { name: "Blackrock", value: "Blackrock" },
  ));

const upgradeCommand = new SlashCommandBuilder()
  .setName("upgrade")
  .setDescription("Preview the research profile for a Warmane character")
  .addStringOption((option) => option.setName("name").setDescription("Character name").setRequired(true).setMaxLength(12))
  .addStringOption((option) => option.setName("spec").setDescription("Specialization to evaluate").setRequired(true).addChoices(
    ...upgradeSpecNames.map((specName) => ({ name: specName, value: specName })),
  ))
  .addStringOption((option) => option.setName("realm").setDescription("Warmane realm").addChoices(
    { name: "Lordaeron", value: "Lordaeron" },
    { name: "Icecrown", value: "Icecrown" },
    { name: "Blackrock", value: "Blackrock" },
  ));

const armory = new WarmaneArmory();
const cards = new ArmoryCardRenderer();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const lookupCooldowns = new Map<string, number>();
const LOOKUP_COOLDOWN_MS = 10_000;

function scoreBand(score: number): string {
  if (score > 5000) return "Legendary";
  if (score > 4000) return "Epic";
  if (score > 3000) return "Superior";
  if (score > 2000) return "Uncommon";
  return "Common";
}

async function registerCommand(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);
  await rest.put(route, { body: [command.toJSON(), upgradeCommand.toJSON()] });
}

client.once(Events.ClientReady, () => console.log(`PizzaWarriors Armory Bot is ready as ${client.user?.tag}.`));
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "upgrade") {
    const name = interaction.options.getString("name", true).trim();
    const realm = interaction.options.getString("realm") ?? config.defaultRealm;
    const specName = interaction.options.getString("spec", true);
    await interaction.deferReply();
    try {
      const character = await armory.getCharacter(name, realm);
      if (!character.className) {
        await interaction.editReply("I found the character, but Warmane did not expose a usable class for this profile.");
        return;
      }
      const profile = findUpgradeProfile(character.className, specName);
      if (!profile) {
        await interaction.editReply(`I found a **${character.className}**, but PizzaWarriors does not have a **${specName}** research profile for that class yet.`);
        return;
      }
      const preview = createUpgradePreview(name, realm, profile);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("PizzaWarriors Upgrade Advisor · Concept Preview")
        .setDescription(`**${preview.characterName} · ${preview.realm} · ${specName} ${character.className}**\n${preview.headline}`)
        .addFields(
          { name: "Profile", value: `${preview.profile.className} · ${preview.profile.specName}\n${preview.profile.content}`, inline: true },
          { name: "Readiness", value: preview.readiness, inline: true },
          { name: "How a live result will work", value: preview.steps.map((step, index) => `${index + 1}. ${step}`).join("\n") },
          { name: "Research source", value: formatUpgradeSources(preview.profile) },
        )
        .setFooter({ text: "Class came from Warmane Armory; the specialization was selected by the user. No gear judgement was made." });
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Upgrade preview lookup failed", error);
      await interaction.editReply("I couldn't read that character's profile right now. Check the character name and realm, then try again in a moment.");
    }
    return;
  }
  if (interaction.commandName !== "armory") return;
  const now = Date.now();
  const cooldownKey = `${interaction.guildId ?? "direct"}:${interaction.user.id}`;
  const retryAt = lookupCooldowns.get(cooldownKey) ?? 0;
  if (retryAt > now) {
    const seconds = Math.ceil((retryAt - now) / 1_000);
    await interaction.reply({ content: `Please wait ${seconds} second${seconds === 1 ? "" : "s"} before another armory lookup.`, flags: MessageFlags.Ephemeral });
    return;
  }
  lookupCooldowns.set(cooldownKey, now + LOOKUP_COOLDOWN_MS);
  if (lookupCooldowns.size > 1_000) {
    for (const [key, expiresAt] of lookupCooldowns) if (expiresAt <= now) lookupCooldowns.delete(key);
  }
  const name = interaction.options.getString("name", true).trim();
  const realm = interaction.options.getString("realm") ?? config.defaultRealm;
  await interaction.deferReply();
  try {
    const character = await armory.getCharacter(name, realm);
    const summary = calculateGearScore(character.items);
    if (!summary) throw new Error("Warmane returned equipment, but sufficient item data was unavailable to calculate GearScore.");
    const fileStem = name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const cardName = `${fileStem}-armory-card.png`;
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel("Open Armory").setStyle(ButtonStyle.Link).setURL(character.armoryUrl),
    );
    try {
      const card = await cards.render({ name, realm, items: character.items, summary, portrait: character.portrait });
      const embed = new EmbedBuilder().setColor(0xff8000).setImage(`attachment://${cardName}`);
      await interaction.editReply({ embeds: [embed], components: [buttons], files: [new AttachmentBuilder(card, { name: cardName })] });
    } catch (cardError) {
      // The raw armory data remains useful if a browser/image host is temporarily unavailable.
      console.error("Armory card render failed; using text fallback", cardError);
      const description = character.items.map((item) => {
        const itemScore = summary.itemScores.get(item.id);
        return `**${item.slot}** · ${item.name} — iLvl ${item.itemLevel}${itemScore ? ` · ${itemScore} GS` : ""}`;
      }).reduce<string[]>((lines, line) => lines.join("\n").length + line.length <= 3_850 ? [...lines, line] : lines, []).join("\n") || "No displayable equipment.";
      const fallback = new EmbedBuilder()
        .setColor(0xff8000)
        .setTitle(`${name} · ${realm}`)
        .setURL(character.armoryUrl)
        .setDescription(description)
        .addFields(
          { name: "GearScore", value: `**${summary.score.toLocaleString()}** · ${scoreBand(summary.score)}`, inline: true },
          { name: "Average iLvl", value: String(summary.averageItemLevel), inline: true },
          { name: "Items scored", value: `${summary.scoredItemCount}/19`, inline: true },
        )
        .setFooter({ text: "Equipment from Warmane Armory · WotLK 3.3.5a GearScoreLite" })
        .setTimestamp();
      const portraitName = `${fileStem}-armory.png`;
      const files = character.portrait ? [new AttachmentBuilder(character.portrait, { name: portraitName })] : [];
      if (character.portrait) fallback.setThumbnail(`attachment://${portraitName}`);
      await interaction.editReply({ embeds: [fallback], components: [buttons], files });
    }
  } catch (error) {
    console.error("Armory lookup failed", error);
    await interaction.editReply("I couldn't read that character's equipment right now. Check the character name and realm, then try again in a moment.");
  }
});

createServer((request, response) => {
  response.writeHead(request.url === "/healthz" ? 200 : 404, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: request.url === "/healthz" }));
}).listen(config.port);

await registerCommand();
await client.login(config.discordToken);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await armory.close();
    await cards.close();
    client.destroy();
    process.exit(0);
  });
}
