const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { load } = require("./helpers.cjs");

test("Appendix opens an accessible definition, Escape closes it and restores focus; dossiers navigate", async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: "http://localhost",
  });
  global.window = dom.window;
  global.document = dom.window.document;
  for (const key of [
    "Node",
    "HTMLElement",
    "HTMLInputElement",
    "MutationObserver",
    "CustomEvent",
    "NodeFilter",
    "Event",
    "KeyboardEvent",
    "MouseEvent",
  ])
    global[key] = dom.window[key];
  global.getComputedStyle = dom.window.getComputedStyle;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { act } = React;
  const { createRoot } = require("react-dom/client");
  const references = load("src/ArchiveReferences.tsx", {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "@radix-ui/react-dialog": require("@radix-ui/react-dialog"),
    "html-react-parser": require("html-react-parser"),
    "lucide-react": require("lucide-react"),
    "./lib/entry-content": load("src/lib/entry-content.ts", {
      "sanitize-html": require("sanitize-html"),
    }),
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
  const visits = [];
  const root = createRoot(document.getElementById("root"));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
  });
  await act(async () =>
    root.render(
      React.createElement(
        references.ArchiveReferences,
        {
          entries: [
            { category: "characters", name: "Anis", summary: "*Goddessium*" },
            {
              category: "appendix",
              name: "Goddessium",
              summary: "<p><strong>Armour</strong> material.</p>",
            },
          ],
          aliases: [],
          navigate: (path) => visits.push(path),
        },
        React.createElement(references.ReferenceHtml, {
          html: "<p>*Anis* uses **Goddessium**.</p>",
        }),
      ),
    ),
  );
  const trigger = document.querySelector('[aria-haspopup="dialog"]');
  trigger.focus();
  await act(async () => trigger.click());
  assert.ok(document.querySelector('[role="dialog"]'));
  assert.equal(document.querySelector(".definition-title").textContent, "Goddessium");
  assert.equal(document.querySelector(".definition-body strong").textContent, "Armour");
  assert.equal(document.querySelector(".backlinks"), null);
  assert.ok(!document.querySelector('[role="dialog"]').textContent.includes("Referenced by"));
  assert.equal(visits.length, 0);
  await act(async () =>
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.activeElement, trigger);
  const link = document.querySelector("a.reference-entry");
  await act(async () =>
    link.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })),
  );
  assert.deepEqual(visits, ["/entry/characters/Anis"]);
});
