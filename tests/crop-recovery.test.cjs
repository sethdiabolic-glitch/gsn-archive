const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const crop = load("src/lib/portrait-crop.ts");
test("circle crop covers its frame, centers at reset and clamps dragging to real pixels", () => {
  for (const [w, h] of [
    [1000, 500],
    [500, 1000],
    [800, 800],
  ]) {
    const base = crop.cropGeometry(w, h, 1, { x: 0, y: 0 });
    assert.ok(base.drawnWidth >= 320 && base.drawnHeight >= 320);
    assert.ok(Math.abs(base.sourceX - (w - base.sourceSize) / 2) < 0.001);
    for (const zoom of [1, 1.5, 3])
      for (const pan of [
        { x: 10000, y: -10000 },
        { x: -10000, y: 10000 },
      ]) {
        const c = crop.cropGeometry(w, h, zoom, pan);
        assert.ok(c.sourceX >= -1e-8 && c.sourceY >= -1e-8);
        assert.ok(c.sourceX + c.sourceSize <= w + 1e-8 && c.sourceY + c.sourceSize <= h + 1e-8);
      }
  }
});
test("crop rejects unsupported media and oversized originals", () => {
  assert.equal(crop.portraitFileError({ type: "image/webp", size: 100 }), "");
  assert.ok(crop.portraitFileError({ type: "image/svg+xml", size: 100 }));
  assert.ok(crop.portraitFileError({ type: "image/png", size: 13 * 1024 * 1024 }));
  assert.throws(() => crop.cropGeometry(0, 100, 1, { x: 0, y: 0 }), /dimensions/);
});
test("password confirmation and length are checked before calling auth", () => {
  const { passwordError } = load("src/lib/recovery-session.ts");
  assert.ok(passwordError("short", "short"));
  assert.ok(passwordError("long-enough", "not-the-same"));
  assert.equal(passwordError("long-enough", "long-enough"), "");
});
test("only recovery events create a short-lived account-bound recovery marker", () => {
  let handler;
  const store = new Map();
  const lib = load(
    "src/lib/recovery-session.ts",
    {},
    {},
    {
      window: {},
      location: { pathname: "/reset-password", hash: "", search: "" },
      sessionStorage: {
        getItem: (key) => store.get(key) || null,
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => store.delete(k),
      },
    },
  );
  lib.installRecoveryTracking({
    auth: {
      onAuthStateChange: (callback) => {
        handler = callback;
      },
    },
  });
  handler("SIGNED_IN", { user: { id: "user" } });
  assert.equal(lib.hasRecovery("user"), false);
  handler("PASSWORD_RECOVERY", { user: { id: "user" } });
  assert.equal(lib.hasRecovery("user"), true);
  assert.equal(lib.hasRecovery("other"), false);
  handler("SIGNED_OUT", null);
  assert.equal(lib.hasRecovery("user"), false);
});
