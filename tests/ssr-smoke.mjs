import { createServer } from "vite";
import assert from "node:assert/strict";

process.env.VITE_SUPABASE_URL = "https://crawler-fixture.invalid";
process.env.VITE_SUPABASE_ANON_KEY = "public-fixture-key";
const nativeFetch = globalThis.fetch;
let unavailable = false;
const entry = {
  name: "Crawler Test",
  cls: "Nikke",
  tag: "TEST",
  summary:
    "<h2>Unique SSR evidence</h2><p>This complete dossier is readable without JavaScript.</p>",
  hypothetical: "<p>Unique hypothetical evidence remains in HTML.</p>",
  speed: "Mach 4",
  strength: "10 TW",
  durability: "50 G",
  tier: "A",
};
const rows = [
  {
    id: "test",
    category: "characters",
    name: entry.name,
    data: entry,
    updated_at: "2026-10-17T10:00:00Z",
  },
  { category: "settings", name: "private_test", data: { secret: "DO-NOT-PUBLISH-THIS" } },
];
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url || String(input);
  if (url.includes("/rest/v1/archive_entries"))
    return unavailable
      ? new Response("down", { status: 503 })
      : new Response(JSON.stringify(rows), {
          headers: { "content-type": "application/json", "content-range": "0-1/2" },
        });
  return nativeFetch(input, init);
};
const server = await createServer({
  root: process.cwd(),
  server: { host: "0.0.0.0", port: 0, strictPort: true },
});
try {
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const page = await nativeFetch(`${origin}/entry/characters/Crawler%20Test`);
  const html = await page.text();

  assert.equal(page.status, 200);
  assert.ok(html.includes("Unique SSR evidence"));
  assert.ok(html.includes("Unique hypothetical evidence remains in HTML."));
  assert.ok(html.includes("Hypothetical Summary"));
  assert.ok(!html.includes("DO-NOT-PUBLISH-THIS"));
  assert.ok(!html.includes("Loading <!-- -->archive"));
  const category = await (await nativeFetch(`${origin}/characters`)).text();
  assert.ok(category.includes('href="/entry/characters/Crawler%20Test"'));
  const sitemap = await (await nativeFetch(`${origin}/sitemap.xml`)).text();
  assert.ok(sitemap.includes("/entry/characters/Crawler%20Test"));
  assert.ok(!sitemap.includes("private_test"));
  const text = await (await nativeFetch(`${origin}/llms.txt`)).text();
  assert.ok(text.includes("Crawler%20Test"));
  assert.ok(!text.includes("DO-NOT-PUBLISH-THIS"));
  unavailable = true;
  const outage = await nativeFetch(`${origin}/characters`);
  const outageHtml = await outage.text();
  assert.equal(outage.status, 503);
  assert.ok(outageHtml.includes("noindex"));
  assert.equal((await nativeFetch(`${origin}/sitemap.xml`)).status, 503);
  const imageUrl = `${origin}/image?src=${encodeURIComponent("https://example.com/photo.png")}&title=Image%20test`;
  const viewer = await nativeFetch(imageUrl);
  const viewerHtml = await viewer.text();
  assert.equal(viewer.status, 200); // Viewer works independently of the database.
  assert.ok(viewerHtml.includes("Copy link"));
  assert.ok(viewerHtml.includes("noindex"));
  assert.ok(viewerHtml.includes("<img"));
  const matureViewer = await (await nativeFetch(imageUrl + "&mature=1")).text();
  assert.ok(matureViewer.includes("View mature image"));
  assert.ok(!matureViewer.includes("<img"));
  console.log(
    "Raw HTTP checks passed: full dossier + collapsed hypothesis in initial HTML, native category links, individual-entry sitemap, no private settings in SSR/feeds, and 503/noindex on outage.",
  );
} finally {
  await server.close();
  globalThis.fetch = nativeFetch;
}
