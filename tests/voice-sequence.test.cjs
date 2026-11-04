const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
test("voice lines play in order and loop independently per entry", () => {
  const { nextVoice } = load("src/lib/voice-sequence.ts");
  const a = [
    { url: "a", text: "First" },
    { url: "b", text: "Second" },
    { url: "c", text: "Third" },
  ];
  assert.equal(nextVoice(a, "one").url, "a");
  assert.equal(nextVoice(a, "one").url, "b");
  assert.equal(nextVoice(a, "two").url, "a");
  assert.equal(nextVoice(a, "one").url, "c");
  assert.equal(nextVoice(a, "one").url, "a");
  assert.equal(nextVoice([], "one"), undefined);
  assert.equal(nextVoice(a, "one").url, "a");
  assert.equal(nextVoice(a.slice(1), "one").url, "b");
});
test("retired community UI is absent from navigation, metadata and account controls", () => {
  const fs = require("node:fs");
  const app = fs.readFileSync("src/GsnArenaApp.tsx", "utf8");
  for (const text of [
    "CommunityArtPage",
    "CommunityModerationPage",
    "CommentsPage",
    "NotificationsPage",
    "signUp(",
    "% chance",
    "My Images",
  ])
    assert.ok(!app.includes(text), text);
  const profile = fs.readFileSync("src/MemberArea.tsx", "utf8");
  assert.ok(!profile.includes("My Images"));
  const { SECTIONS } = load("src/lib/crawler.server.ts", {
    "./entry-content": {},
    "./public-archive": load("src/lib/public-archive.ts"),
  });
  assert.ok(!SECTIONS.some(([route]) => route === "community"));
});
