const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { load } = require("./helpers.cjs");
const { Editor } = require("@tiptap/core");
const extensions = load(
  "src/lib/entry-editor.ts",
  Object.fromEntries(
    [
      "@tiptap/starter-kit",
      "@tiptap/extension-image",
      "@tiptap/extension-text-align",
      "@tiptap/extension-table",
    ].map((name) => [name, require(name)]),
  ),
);
const { cleanEntryHtml, legacyToHtml } = load("src/lib/entry-content.ts", {
  "sanitize-html": require("sanitize-html"),
});

test("real editor supports table operations and save/reopen preserves formatting", (t) => {
  const dom = new JSDOM("<!doctype html><body></body>");
  global.window = dom.window;
  global.document = dom.window.document;
  global.Element = dom.window.Element;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.ClipboardEvent = dom.window.ClipboardEvent || dom.window.Event;
  global.getComputedStyle = dom.window.getComputedStyle;
  const editor = new Editor({
    extensions: extensions.entryEditorExtensions(),
    content:
      '<h2>Feats</h2><p style="text-align: center"><strong>Summary</strong> <u>verified</u></p>',
  });
  t.after(() => {
    editor.destroy();
    dom.window.close();
  });
  editor.commands.focus = () => true;
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  assert.equal(editor.commands.insertTable({ rows: 3, cols: 2, withHeaderRow: true }), true);
  assert.equal(editor.commands.addRowAfter(), true);
  assert.equal(editor.commands.addColumnAfter(), true);
  let saved = cleanEntryHtml(editor.getHTML());
  let parsed = new dom.window.DOMParser().parseFromString(saved, "text/html");
  assert.equal(parsed.querySelectorAll("tr").length, 4);
  assert.equal(parsed.querySelector("tr").children.length, 3);
  assert.ok(parsed.querySelector("th"));
  editor.commands.setContent(legacyToHtml(saved));
  assert.equal(cleanEntryHtml(editor.getHTML()), saved);
  // Simulate rich HTML pasted from a word processor, not just inserted tables.
  editor.commands.setContent("<p>Before</p>");
  editor.view.pasteHTML(
    "<table><tbody><tr><th><p>Metric</p></th><th><p>Value</p></th></tr><tr><td><p>Speed</p></td><td><p>Mach 4</p></td></tr></tbody></table>",
  );
  saved = cleanEntryHtml(editor.getHTML());
  parsed = new dom.window.DOMParser().parseFromString(saved, "text/html");
  assert.equal(parsed.querySelectorAll("tr").length, 2);
  assert.ok(saved.includes("Mach 4"));
  editor.commands.setTextSelection(4);
  // Reopen a table-first document, then remove it using the real table commands.
  editor.commands.setContent(saved);
  let cellPosition;
  editor.state.doc.descendants((node, position) => {
    if (cellPosition === undefined && ["tableHeader", "tableCell"].includes(node.type.name))
      cellPosition = position + 2;
  });
  editor.commands.setTextSelection(cellPosition);
  assert.equal(editor.commands.deleteTable(), true);
  assert.ok(!editor.getHTML().includes("<table"));
});
