const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { JSDOM } = require("jsdom");
const { load } = require("./helpers.cjs");
const { HypotheticalSummary } = load("src/HypotheticalSummary.tsx", {
  "react/jsx-runtime": require("react/jsx-runtime"),
});

test("Hypothetical Summary starts closed and opens/closes with its summary control", () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      HypotheticalSummary,
      null,
      React.createElement("p", null, "Optional analysis."),
    ),
  );
  const dom = new JSDOM(markup);
  const details = dom.window.document.querySelector("details");
  const summary = details.querySelector("summary");
  assert.equal(details.open, false);
  assert.equal(summary.firstElementChild.textContent, "Hypothetical Summary");
  assert.equal(details.querySelector(".hypothesis p").textContent, "Optional analysis.");
  summary.click();
  assert.equal(details.open, true);
  summary.click();
  assert.equal(details.open, false);
  dom.window.close();
});
