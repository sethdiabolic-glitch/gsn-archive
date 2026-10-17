const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const drafts = load("src/lib/drafts.ts");
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
const base = {
  name: "Anis",
  cls: "Nikke",
  summary: "Original",
  speed: "N/A",
  strength: "N/A",
  durability: "N/A",
};
test("drafts are isolated by account, category and stable entry identity", () => {
  assert.notEqual(
    drafts.draftKey("a", "characters", "id"),
    drafts.draftKey("b", "characters", "id"),
  );
  assert.notEqual(drafts.draftKey("a", "characters", "id"), drafts.draftKey("a", "appendix", "id"));
});
test("drafts recover field changes and retain a baseline for stale-content warnings", () => {
  const store = storage();
  const data = { ...base, summary: "<p>Unapplied document edit</p>" };
  drafts.writeDraft(store, "key", data, JSON.stringify(base));
  const recovered = drafts.readDraft(store, "key");
  assert.equal(recovered.data.summary, data.summary);
  assert.equal(recovered.base, JSON.stringify(base));
  assert.ok(recovered.updatedAt);
  store.removeItem("key");
  assert.equal(drafts.readDraft(store, "key"), null);
});
test("invalid drafts and snapshots identical to the published base are ignored", () => {
  const store = storage();
  store.setItem("key", "not JSON");
  assert.equal(drafts.readDraft(store, "key"), null);
  store.setItem(
    "key",
    JSON.stringify({ version: 1, base: "", updatedAt: "", data: { name: "incomplete" } }),
  );
  assert.equal(drafts.readDraft(store, "key"), null);
  drafts.writeDraft(store, "key", base, JSON.stringify(base));
  assert.equal(drafts.readDraft(store, "key"), null);
});
