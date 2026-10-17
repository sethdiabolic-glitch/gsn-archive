const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const { pageMeta } = load("src/lib/page-meta.ts");
test("section and dossier metadata are unique and canonical", () => {
  assert.notEqual(pageMeta("/compare").meta[0].title, pageMeta("/characters").meta[0].title);
  const dossier = pageMeta("/entry/characters/Red%20Hood");
  assert.equal(dossier.meta[0].title, "Red Hood — GSN Arena");
  assert.equal(
    dossier.links[0].href,
    "https://gsn-archive.lovable.app/entry/characters/Red%20Hood",
  );
  assert.ok(!JSON.stringify(dossier).includes("@Lovable"));
});
test("private editor pages are not indexed and malformed paths do not crash metadata", () => {
  assert.ok(
    pageMeta("/editor").meta.some(
      (item) => item.name === "robots" && item.content.includes("noindex"),
    ),
  );
  assert.doesNotThrow(() => pageMeta("/entry/characters/%invalid"));
});
