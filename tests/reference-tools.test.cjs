const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const refs = load("src/lib/entry-references.ts");
const tools = load("src/lib/reference-tools.ts", {
  "html-react-parser": require("html-react-parser"),
  "./entry-references": refs,
  "./entry-content": load("src/lib/entry-content.ts", {
    "sanitize-html": require("sanitize-html"),
  }),
});
const entries = [
  { id: "a", category: "characters", name: "Anis", summary: "*Goddessium*" },
  { id: "g", category: "appendix", name: "Goddessium", summary: "Armour" },
  {
    id: "r",
    category: "characters",
    name: "Rapi",
    summary: "<p>**Anis** and *Old material*</p>",
    notes: [{ text: "*Anis*" }],
  },
];
const aliases = [{ category: "appendix", name: "Old material", entry_id: "g" }];
test("reference audit uses only renderable text and flags missing, ambiguous and self links", () => {
  assert.equal(
    tools
      .referenceNames(
        '<p>*Anis*</p><pre>*Unknown*</pre><a href="https://example.com">*Unknown*</a><img alt="*Unknown*">',
      )
      .join(),
    "Anis",
  );
  const issues = tools.referenceWarnings(["*Anis* **Missing**"], entries, aliases, entries[0]);
  assert.equal(issues.length, 2);
  assert.ok(issues.find((issue) => issue.name === "Anis").message.includes("back"));
  assert.ok(issues.find((issue) => issue.name === "Missing").message.includes("No matching"));
});
test("backlinks include summary, hypothesis, notes and aliases, deduplicated per entry", () => {
  assert.equal(
    tools
      .referencedBy(entries[0], entries, aliases)
      .map((entry) => entry.name)
      .join(),
    "Rapi",
  );
  assert.equal(
    tools
      .referencedBy(entries[1], entries, aliases)
      .map((entry) => entry.name)
      .join(),
    "Anis,Rapi",
  );
});
