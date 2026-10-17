const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const refs = load("src/lib/entry-references.ts");
const entries = [
  { id: "a", category: "characters", name: "Anis", summary: "A Nikke." },
  { id: "g", category: "appendix", name: "Goddessium", summary: "<p>Armour material.</p>" },
  { id: "other", category: "weapons", name: "Goddessium", summary: "Not the definition." },
];
const resolve = refs.referenceIndex(entries, [
  { category: "characters", name: "Old Anis", entry_id: "a" },
]);
test("single and double asterisks resolve case-insensitively and keep punctuation", () => {
  const parts = refs.referenceParts("See *anis*, **Anis** and * Goddessium *.", resolve);
  assert.equal(parts.filter((part) => part.entry).length, 3);
  assert.equal(parts[0].text, "See ");
  assert.equal(parts.at(-1).text, ".");
  assert.equal(parts.find((part) => part.text === "Goddessium").entry.category, "appendix");
});
test("Appendix takes precedence over an ordinary dossier of the same name", () => {
  assert.equal(resolve("GODDESSIUM").id, "g");
});
test("unmatched and malformed markers stay untouched", () => {
  for (const value of [
    "*Unknown*",
    "**Unknown**",
    "*Anis",
    "***Anis***",
    "*Anis\nAnis*",
    "3 * 4",
  ]) {
    assert.equal(
      refs
        .referenceParts(value, resolve)
        .map((part) => part.text)
        .join(""),
      value,
    );
    assert.ok(!refs.referenceParts(value, resolve).some((part) => part.entry));
  }
});
test("historical names resolve to the current URL and URLs encode special characters", () => {
  assert.equal(resolve("old anis").name, "Anis");
  assert.equal(
    refs.referenceHref({ category: "characters", name: "Rapi / Red Hood?" }),
    "/entry/characters/Rapi%20%2F%20Red%20Hood%3F",
  );
});
test("ambiguous non-Appendix names do not silently choose the wrong dossier", () => {
  const ambiguous = refs.referenceIndex([
    ...entries,
    { category: "theories", name: "Anis", summary: "A theory" },
  ]);
  assert.equal(ambiguous("Anis"), undefined);
});
