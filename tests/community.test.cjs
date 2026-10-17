const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const url = "https://test.supabase.co";
const art = {
  id: "art",
  image_url: `${url}/storage/v1/object/public/community-art/owner/image.png`,
};
const api = (client) =>
  load(
    "src/lib/community.ts",
    {
      "./gallery": load("src/lib/gallery.ts"),
      "@supabase/supabase-js": { createClient: () => client },
    },
    { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: "test-key" },
  );
function client(removeResult, files = [], deleteResult = { data: [{ id: "art" }] }) {
  const calls = [];
  return {
    calls,
    storage: {
      from: () => ({
        remove: async () => {
          calls.push("file");
          return removeResult;
        },
        list: async () => ({ data: files }),
      }),
    },
    from: () => ({
      delete: () => {
        calls.push("record");
        return { eq: () => ({ select: async () => deleteResult }) };
      },
    }),
  };
}
test("storage failure keeps the artwork record", async () => {
  const mock = client({ error: new Error("denied") });
  await assert.rejects(api(mock).deleteMyArt(art), /denied/);
  assert.deepEqual(mock.calls, ["file"]);
});
test("silently filtered storage deletion is not success", async () => {
  const mock = client({ data: [] }, [{ name: "image.png" }]);
  await assert.rejects(api(mock).deleteMyArt(art), /not permitted/);
  assert.deepEqual(mock.calls, ["file"]);
});
test("file is removed before record", async () => {
  const mock = client({ data: [{ name: "owner/image.png" }] });
  await api(mock).deleteMyArt(art);
  assert.deepEqual(mock.calls, ["file", "record"]);
});
test("already missing image allows retrying record deletion", async () => {
  const mock = client({ data: [] });
  await api(mock).deleteMyArt(art);
  assert.deepEqual(mock.calls, ["file", "record"]);
});
test("database failure gives an actionable partial failure message", async () => {
  const mock = client({ data: [{}] }, [], { error: new Error("offline") });
  await assert.rejects(api(mock).deleteMyArt(art), /Retry the takedown/);
});
test("unexpected image hosts never trigger deletion", async () => {
  const mock = client({ data: [] });
  await assert.rejects(
    api(mock).deleteMyArt({ ...art, image_url: "https://other.example/image.png" }),
    /Unrecognised/,
  );
  assert.equal(mock.calls.length, 0);
});
test("failed submission cleans up its uploaded file", async () => {
  let cleaned = false;
  const mock = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    storage: {
      from: () => ({
        upload: async () => ({}),
        getPublicUrl: () => ({ data: { publicUrl: art.image_url } }),
        remove: async () => {
          cleaned = true;
          return {};
        },
      }),
    },
    from: () => ({ insert: async () => ({ error: new Error("insert failed") }) }),
  };
  await assert.rejects(
    api(mock).submitArt({
      title: "Art",
      artist_name: "Artist",
      description: "",
      rating: "sfw",
      file: { name: "image.png" },
    }),
    /insert failed/,
  );
  assert.equal(cleaned, true);
});
