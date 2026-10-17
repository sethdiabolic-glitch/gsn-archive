const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const { visibleFeats, hasFeatData, setFeatIncluded } = load("src/lib/entry-feats.ts");
const entry = { speed: "Mach 4", strength: "N/A", durability: "50 G" };

test("existing entries keep their original three measurements", () => {
  assert.equal(visibleFeats(entry).length, 3);
  assert.equal(visibleFeats(entry)[1].label, "Power / Strength");
});
test("hiding and restoring a feat preserves its value and custom label", () => {
  const custom = { ...entry, featLabels: { speed: "Reaction time" } };
  const hidden = { ...custom, hiddenFeats: setFeatIncluded(custom, "speed", false) };
  assert.equal(visibleFeats(hidden).length, 2);
  assert.equal(hidden.speed, "Mach 4");
  const restored = { ...hidden, hiddenFeats: setFeatIncluded(hidden, "speed", true) };
  assert.equal(visibleFeats(restored)[0].label, "Reaction time");
  assert.equal(visibleFeats(restored)[0].value, "Mach 4");
});
test("all feats may be hidden, and empty measurements do not leave empty cards", () => {
  assert.equal(
    visibleFeats({ ...entry, hiddenFeats: ["speed", "strength", "durability"] }).length,
    0,
  );
  assert.equal(visibleFeats({ speed: "", strength: "  ", durability: "" }).length, 0);
});
test("card feat indicator respects visibility and all measurement types", () => {
  assert.equal(hasFeatData({ speed: "N/A", strength: "10 TW", durability: "" }), true);
  assert.equal(hasFeatData({ ...entry, hiddenFeats: ["speed", "durability"] }), false);
});
test("blank display labels fall back to a useful default", () => {
  assert.equal(visibleFeats({ ...entry, featLabels: { speed: " " } })[0].label, "Speed");
});
