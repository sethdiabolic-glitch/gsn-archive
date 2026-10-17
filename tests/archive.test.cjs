const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const archive = (client) => load("src/lib/archive.ts", { "./community": { supabase: client } });

test("failed reads return explicitly labelled cached content", async () => {
  const fallback = { characters: [{ name: "Saved" }] };
  const api = archive({ from: () => ({ select: async () => ({ error: new Error("offline") }) }) });
  const result = await api.loadArchive(fallback);
  assert.equal(result.source, "cache");
  assert.equal(result.data, fallback);
});
test("empty remote archive is a successful load, not a fallback", async () => {
  const result = await archive({
    from: () => ({ select: async () => ({ data: [] }) }),
  }).loadArchive({ characters: ["stale"] });
  assert.equal(result.source, "remote");
  assert.equal(Object.keys(result.data).length, 0);
});
test("remote identity and name override stale JSON fields", async () => {
  const result = await archive({
    from: () => ({
      select: async () => ({
        data: [
          { id: "stable", category: "characters", name: "New", data: { name: "Old", id: "wrong" } },
        ],
      }),
    }),
  }).loadArchive({});
  assert.equal(result.data.characters[0].name, "New");
  assert.equal(result.data.characters[0].id, "stable");
});
test("unconfigured storage cannot silently publish", async () => {
  const api = archive(null);
  assert.equal((await api.loadArchive({})).source, "unconfigured");
  await assert.rejects(api.saveArchiveEntry("characters", "A", {}), /not connected/);
});
test("renames make a single RPC call and surface collisions", async () => {
  const calls = [];
  const api = archive({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { error: new Error("name is already in use") };
    },
  });
  await assert.rejects(api.saveArchiveEntry("characters", "New", {}, "Old"), /already in use/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "save_archive_entry");
  assert.equal(calls[0].args.p_original_name, "Old");
});
test("fixed settings still use their existing key", async () => {
  let table;
  await archive({
    from: (name) => {
      table = name;
      return { upsert: async () => ({}) };
    },
  }).saveArchiveEntry("settings", "terms", { content: "test" });
  assert.equal(table, "archive_entries");
});
