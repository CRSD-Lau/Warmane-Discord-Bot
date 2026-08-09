import assert from "node:assert/strict";
import { createUpgradePreview, findUpgradeProfiles, formatUpgradeSources } from "../src/upgrade.js";

const fury = findUpgradeProfiles("Warrior").find((profile) => profile.specName === "Fury");
assert.ok(fury, "Fury Warrior research profile should be present");
assert.equal(fury.status, "research", "research profiles must never be presented as approved recommendations");

const preview = createUpgradePreview("Lausudo", "Lordaeron", fury);
assert.equal(preview.characterName, "Lausudo");
assert.match(preview.headline, /not a live gear recommendation/i);
assert.equal(preview.steps.length, 3);
assert.match(formatUpgradeSources(fury), /forum\.warmane\.com/);
assert.equal(findUpgradeProfiles("No Such Class").length, 0);

console.log("Upgrade preview scaffold tests passed.");
