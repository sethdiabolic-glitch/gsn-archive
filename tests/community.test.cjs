const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const url = "https://test.supabase.co";
const api = (client) =>
  load(
    "src/lib/community.ts",
    {
      "./gallery": load("src/lib/gallery.ts"),
      "./recovery-session": load("src/lib/recovery-session.ts"),
      "@supabase/supabase-js": { createClient: () => client },
    },
    { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: "test" },
  );
const art = { id: "art", status: "withdrawn", storage_path: "owner/image.png", image_url: "" };
function mock({
  exists = true,
  rpcError = null,
  cleanupError = null,
  files = [],
  removed = [{ name: "owner/image.png" }],
} = {}) {
  const calls = [];
  return {
    calls,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: exists ? { id: "art" } : null }) }),
      }),
    }),
    rpc: async () => {
      calls.push("record");
      return { error: rpcError };
    },
    storage: {
      from: (bucket) => ({
        remove: async () => {
          calls.push(bucket + ":file");
          return { data: removed, error: cleanupError };
        },
        list: async () => ({ data: files }),
      }),
    },
  };
}
test("permanent deletion requires prior withdrawal", async () => {
  const c = mock();
  await assert.rejects(api(c).deleteMyArt({ ...art, status: "approved" }), /Withdraw/);
  assert.deepEqual(c.calls, []);
});
test("record deletion failure leaves private image intact", async () => {
  const c = mock({ rpcError: { message: "denied" } });
  await assert.rejects(api(c).deleteMyArt(art), /denied/);
  assert.deepEqual(c.calls, ["record"]);
});
test("withdrawn record is deleted before private object cleanup", async () => {
  const c = mock();
  await api(c).deleteMyArt(art);
  assert.deepEqual(c.calls, ["record", "member-art:file"]);
});
test("partial deletion can retry cleanup after record is gone", async () => {
  const c = mock({ exists: false });
  await api(c).deleteMyArt(art);
  assert.deepEqual(c.calls, ["member-art:file"]);
});
test("cleanup failure and silently filtered deletes are actionable", async () => {
  await assert.rejects(
    api(mock({ cleanupError: { message: "offline" } })).deleteMyArt(art),
    /Retry permanent deletion/,
  );
  await assert.rejects(
    api(mock({ removed: [], files: [{ name: "image.png" }] })).deleteMyArt(art),
    /not permitted/,
  );
});
test("unknown legacy image locations never trigger deletion", async () => {
  const c = mock();
  await assert.rejects(
    api(c).deleteMyArt({
      ...art,
      storage_path: null,
      image_url: "https://other.example/image.png",
    }),
    /Unrecognised/,
  );
  assert.equal(c.calls.length, 0);
});
test("private submission validates media and cleans up failed insert", async () => {
  let cleaned = false,
    inserted;
  const c = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    storage: {
      from: (bucket) => {
        assert.equal(bucket, "member-art");
        return {
          upload: async () => ({}),
          remove: async () => {
            cleaned = true;
            return {};
          },
        };
      },
    },
    from: () => ({
      insert: async (row) => {
        inserted = row;
        return { error: { message: "insert failed" } };
      },
    }),
  };
  await assert.rejects(
    api(c).submitArt({
      title: "Art",
      artist_name: "Artist",
      description: "",
      rating: "sfw",
      file: { name: "image.png", type: "image/png", size: 100 },
    }),
    /insert failed/,
  );
  assert.equal(cleaned, true);
  assert.equal(inserted.image_url, "");
  assert.ok(inserted.storage_path.startsWith("owner/"));
  await assert.rejects(
    api(c).submitArt({ file: { type: "image/svg+xml", size: 100 } }),
    /Choose a PNG/,
  );
});
test("moderation uses the atomic reason-bearing RPC", async () => {
  let args;
  const c = {
    rpc: async (name, input) => {
      assert.equal(name, "moderate_member_art");
      args = input;
      return {};
    },
  };
  await api(c).setArtStatus("id", "removed", "Reason");
  assert.equal(args.p_reason, "Reason");
  assert.equal(args.p_status, "removed");
});
