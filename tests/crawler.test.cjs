const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const publicArchive = load("src/lib/public-archive.ts");
const content = load("src/lib/entry-content.ts", { "sanitize-html": require("sanitize-html") });
const crawler = (globals) =>
  load(
    "src/lib/crawler.server.ts",
    { "./entry-content": content, "./public-archive": publicArchive },
    { VITE_SUPABASE_URL: "https://fixture.invalid", VITE_SUPABASE_ANON_KEY: "public-test" },
    globals,
  );
const rows = [
  {
    id: "entry",
    category: "characters",
    name: "Anis & Rapi / test?",
    data: {
      name: "old",
      summary: "<p>Public evidence</p>",
      hypothetical: "<p>Public hypothetical</p>",
    },
    updated_at: "2026-10-17T10:00:00Z",
  },
  {
    category: "settings",
    name: "terms",
    data: { content: "Public terms", private_token: "DO-NOT-SERIALIZE" },
  },
  { category: "settings", name: "secret", data: { content: "PRIVATE" } },
  { category: "private", name: "Private item", data: { summary: "PRIVATE" } },
];
test("server snapshot seeds every category but includes only public entries and allowed public settings fields", () => {
  const snapshot = publicArchive.archiveFromRows(rows);
  assert.equal(snapshot.characters[0].name, rows[0].name);
  assert.equal(snapshot.characters[0].id, "entry");
  assert.equal(snapshot.raptures.length, 0);
  assert.equal(snapshot.settings.length, 1);
  assert.ok(!JSON.stringify(snapshot).includes("DO-NOT-SERIALIZE"));
  assert.ok(!JSON.stringify(snapshot).includes("PRIVATE"));
});
test("sitemap includes encoded individual dossiers, dates, valid sectors, and no settings or editor URLs", () => {
  const xml = crawler().sitemapXml(rows);
  assert.ok(xml.includes("/entry/characters/Anis%20%26%20Rapi%20%2F%20test%3F"));
  assert.ok(xml.includes("<lastmod>2026-10-17T10:00:00.000Z</lastmod>"));
  assert.ok(xml.includes("/infra</loc>"));
  for (const absent of ["/structures</loc>", "/editor", "/settings", "PRIVATE", "Private item"])
    assert.ok(!xml.includes(absent));
  assert.equal(publicArchive.xmlText("&<>\"'"), "&amp;&lt;&gt;&quot;&apos;");
});
test("llms feed links public dossiers and never includes settings or private categories", () => {
  const text = crawler().llmsText(rows);
  assert.ok(text.includes("Public evidence"));
  assert.ok(text.includes("/entry/characters/Anis%20%26%20Rapi"));
  for (const absent of ["PRIVATE", "Public terms", "DO-NOT-SERIALIZE", "Private item"])
    assert.ok(!text.includes(absent));
});
test("anonymous reads paginate even when server row caps are lower than requested", async () => {
  const calls = [];
  const api = crawler({
    fetch: async (url, init) => {
      calls.push({ url, init });
      const offset = new URL(url).searchParams.get("offset");
      return new Response(
        JSON.stringify([offset === "0" ? rows[0] : { ...rows[0], name: "Second" }]),
        { headers: { "content-range": offset === "0" ? "0-0/2" : "1-1/2" } },
      );
    },
  });
  const entries = await api.fetchEntries();
  assert.equal(entries.length, 2);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.includes("offset=1"));
  assert.equal(calls[0].init.headers.apikey, "public-test");
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.ok(calls[0].init.signal);
});
test("failed reads are not mistaken for an empty successful archive", async () => {
  const api = crawler({ fetch: async () => new Response("down", { status: 503 }) });
  await assert.rejects(api.fetchEntries(), /503/);
  const empty = crawler({ fetch: async () => new Response("[]") });
  assert.equal((await empty.fetchEntries()).length, 0);
});
test("dossier metadata uses actual summary/image and temporary or missing pages are not indexed", () => {
  const { pageMeta } = load("src/lib/page-meta.ts", {
    "./public-archive": publicArchive,
    "./entry-content": content,
  });
  const snapshot = publicArchive.archiveFromRows([
    {
      category: "characters",
      name: "Anis",
      data: { summary: "<p>Real dossier evidence.</p>", image: "https://example.com/anis.png" },
    },
  ]);
  const meta = pageMeta("/entry/characters/Anis", snapshot).meta;
  assert.equal(meta.find((item) => item.name === "description").content, "Real dossier evidence.");
  assert.equal(
    meta.find((item) => item.property === "og:image").content,
    "https://example.com/anis.png",
  );
  assert.ok(!meta.some((item) => item.name === "robots"));
  assert.ok(pageMeta("/characters", null).meta.some((item) => item.name === "robots"));
  assert.ok(
    pageMeta("/entry/characters/Missing", snapshot).meta.some((item) => item.name === "robots"),
  );
});
