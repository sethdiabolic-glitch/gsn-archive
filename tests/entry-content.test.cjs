const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const content = load("src/lib/entry-content.ts", { "sanitize-html": require("sanitize-html") });

test("table-first summaries remain HTML, including headers and merged cells", () => {
  const html =
    '<table style="min-width: 280px"><colgroup><col style="width: 140px"><col style="width: 140px"></colgroup><tbody><tr><th colspan="2" colwidth="140,140"><p>Feats</p></th></tr><tr><td><p>Speed</p></td><td><p>Mach 4</p></td></tr></tbody></table>';
  const saved = content.cleanEntryHtml(html);
  assert.equal(content.isEntryHtml(saved), true);
  assert.ok(saved.includes("<table"));
  assert.ok(saved.includes('colspan="2"'));
  assert.ok(saved.includes('colwidth="140,140"'));
  assert.ok(!content.legacyToHtml(saved).includes("&lt;table"));
  assert.equal(content.cleanEntryHtml(saved), saved);
});

test("document formatting, alignment and image wrap survive sanitizing", () => {
  const html =
    '<h2 style="text-align:center">Summary</h2><p><u>Underlined</u> <s>old</s> <a href="https://example.com">source</a></p><ol start="4"><li><p>Four</p></li></ol><hr><pre><code>math &lt; 5</code></pre><img src="https://example.com/art.png" data-float="right">';
  const saved = content.cleanEntryHtml(html);
  for (const token of [
    "text-align:center",
    "<u>",
    "<s>",
    "<a ",
    "noopener noreferrer",
    'start="4"',
    "<hr",
    "<pre>",
    'data-float="right"',
  ])
    assert.ok(saved.includes(token), token);
});

test("table and image content cannot carry scripts or arbitrary CSS", () => {
  const saved = content.cleanEntryHtml(
    '<table onclick="evil()" style="position:fixed;width:100%"><tr><td colspan="oops" colwidth="url(javascript:bad)"><script>alert(1)</script><p style="text-align:right;background:url(evil)">Safe</p></td></tr></table><img src="javascript:alert(1)" onerror="evil()"><a href="javascript:alert(1)">bad link</a>',
  );
  for (const token of [
    "onclick",
    "onerror",
    "<script",
    "javascript:",
    "position:",
    "background:",
    'colspan="oops"',
    "colwidth=",
  ])
    assert.ok(!saved.includes(token), token);
  assert.ok(saved.includes("Safe"));
});

test("plain-text summaries escape markup and keep paragraphs and line breaks", () => {
  assert.equal(
    content.legacyToHtml("A < B\nline 2\n\nNext & final"),
    "<p>A &lt; B<br>line 2</p><p>Next &amp; final</p>",
  );
});
