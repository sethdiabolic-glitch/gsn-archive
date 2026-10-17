const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const helpers = load("src/lib/member.ts", { "./community": { supabase: null } });
test("profile naming is case-insensitive, reserves authority names, and defaults to GSN logo", () => {
  assert.equal(helpers.DEFAULT_AVATAR, "/gsn-logo.png");
  assert.equal(helpers.avatarUrl(null), "/gsn-logo.png");
  for (const name of [
    "Admin",
    "moderator",
    "GSN",
    "a",
    "x".repeat(25),
    "space name",
    "email@example.com",
  ])
    assert.ok(helpers.usernameError(name));
  assert.equal(helpers.usernameError("Artist_One"), "");
});
test("notice links reject script URLs and embedded credentials", () => {
  assert.equal(helpers.safeNoticeLink("javascript:alert(1)"), null);
  assert.equal(helpers.safeNoticeLink("https://user:password@example.com"), null);
  assert.equal(helpers.safeNoticeLink("//example.com"), null);
  assert.equal(helpers.safeNoticeLink("https://example.com/notice"), "https://example.com/notice");
});
test("artwork viewer links share stable IDs instead of expiring signed URLs", () => {
  const lib = load("src/lib/image-viewer.ts");
  const { ImageViewerLink } = load("src/ImageViewerLink.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "./lib/image-viewer": lib,
  });
  const id = "00000000-0000-4000-8000-000000000011";
  const html = renderToStaticMarkup(
    React.createElement(
      ImageViewerLink,
      {
        src: "https://example.com/signed?token=secret",
        artworkId: id,
        title: "Art",
        back: "/profile",
      },
      "View",
    ),
  );
  assert.ok(html.includes("art=" + id));
  assert.ok(!html.includes("secret"));
  assert.equal(lib.imageSearch({ art: id }).art, id);
  assert.equal(lib.imageSearch({ art: "invalid" }).art, undefined);
});
test("private account and comment routes remain noindex", () => {
  const { pageMeta } = load("src/lib/page-meta.ts", {
    "./public-archive": load("src/lib/public-archive.ts"),
    "./entry-content": load("src/lib/entry-content.ts", {
      "sanitize-html": require("sanitize-html"),
    }),
  });
  for (const path of ["/profile", "/notifications", "/notices", "/comments/entry-id"])
    assert.ok(
      pageMeta(path).meta.some((m) => m.name === "robots" && m.content.includes("noindex")),
    );
});
