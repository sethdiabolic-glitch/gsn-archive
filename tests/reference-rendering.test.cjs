const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./helpers.cjs");
const content = load("src/lib/entry-content.ts", { "sanitize-html": require("sanitize-html") });
const references = load("src/ArchiveReferences.tsx", {
  react: React,
  "react/jsx-runtime": require("react/jsx-runtime"),
  "@radix-ui/react-dialog": require("@radix-ui/react-dialog"),
  "html-react-parser": require("html-react-parser"),
  "lucide-react": require("lucide-react"),
  "./lib/entry-content": content,
  "./ImageViewerLink": load("src/ImageViewerLink.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "./lib/image-viewer": load("src/lib/image-viewer.ts"),
  }),
  "./lib/reference-tools": load("src/lib/reference-tools.ts", {
    "html-react-parser": require("html-react-parser"),
    "./entry-content": load("src/lib/entry-content.ts", {
      "sanitize-html": require("sanitize-html"),
    }),
    "./entry-references": load("src/lib/entry-references.ts"),
  }),
  "./lib/entry-references": load("src/lib/entry-references.ts"),
});
const { RichDocument } = load("src/RichDocument.tsx", {
  "react/jsx-runtime": require("react/jsx-runtime"),
  "./ArchiveReferences": references,
  "./lib/entry-content": content,
});
function render(value) {
  return renderToStaticMarkup(
    React.createElement(
      references.ArchiveReferences,
      {
        entries: [
          { category: "characters", name: "Anis", summary: "A Nikke" },
          { category: "appendix", name: "Goddessium", summary: "Armour" },
        ],
        aliases: [],
        navigate: () => {},
      },
      React.createElement(RichDocument, { value }),
    ),
  );
}
test("rich summaries link text in headings, formatted text, lists and table cells", () => {
  const html = render(
    "<h2>*Anis*</h2><p><strong>**Anis**</strong> uses *Goddessium*.</p><table><tr><td><p>*Anis*</p></td></tr></table><ul><li><p>*Anis*</p></li></ul>",
  );
  assert.equal((html.match(/href="\/entry\/characters\/Anis"/g) || []).length, 4);
  assert.ok(html.includes('aria-haspopup="dialog"'));
  assert.ok(html.includes("<strong><a"));
  assert.ok(html.includes("<table>"));
});
test("code, existing links, and image attributes are not turned into nested links", () => {
  const html = render(
    '<p><code>*Anis*</code><a href="https://example.com">*Anis*</a></p><pre><code>*Anis*</code></pre><img src="https://example.com/*Anis*.png" alt="*Anis*">',
  );
  assert.ok(!html.includes('href="/entry/characters/Anis"'));
  assert.ok(html.includes('alt="*Anis*"'));
});
test("plain text works too, and unknown references remain literal", () => {
  const html = render("Meet *Anis* and *Unknown*.");
  assert.ok(html.includes('href="/entry/characters/Anis"'));
  assert.ok(html.includes("*Unknown*"));
});
