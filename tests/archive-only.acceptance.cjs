const { chromium: pw } = require("playwright-core");
const { default: chromium, inflate } = require("@sparticuz/chromium");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  await inflate(
    path.join(path.dirname(require.resolve("@sparticuz/chromium")), "../bin/al2023.tar.br"),
  );
  process.env.LD_LIBRARY_PATH = "/tmp/al2023/lib";
  const browser = await pw.launch({
    args: chromium.args.filter((a) => a !== "--single-process"),
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  const base = process.env.GSN_TEST_ORIGIN || "http://127.0.0.1:5173";
  const env = fs.readFileSync(path.join(__dirname, "../.env"), "utf8");
  const url = env.match(/VITE_SUPABASE_URL=["']?([^\s"']+)/)[1];
  const project = new URL(url).hostname.split(".")[0];
  const id = "00000000-0000-4000-8000-000000000001";
  const entryId = "00000000-0000-4000-8000-000000000010";
  const now = new Date().toISOString();
  let requests = [];
  const errors = [];
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt =
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      sub: id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: "authenticated",
      role: "authenticated",
    }) +
    ".fixture";
  const user = {
    id,
    email: "fixture@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: now,
  };
  const session = {
    access_token: jwt,
    refresh_token: "fixture",
    token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    user,
  };
  async function setup(loggedIn = false) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    if (loggedIn)
      await context.addInitScript(
        ({ key, session }) => {
          try {
            localStorage.setItem(key, JSON.stringify(session));
          } catch {}
        },
        { key: `sb-${project}-auth-token`, session },
      );
    await context.addInitScript(() => {
      window.playedVoices = [];
      window.Audio = class {
        constructor(url) {
          this.url = url;
        }
        play() {
          window.playedVoices.push(this.url);
          return Promise.resolve();
        }
        pause() {}
      };
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    let profile = { user_id: id, username: "CropTester", avatar_path: null };
    await page.route(url + "/**", async (route) => {
      const req = route.request(),
        u = new URL(req.url()),
        p = u.pathname;
      let body;
      try {
        body = req.postDataJSON();
      } catch {}
      requests.push({
        path: p,
        method: req.method(),
        body,
        redirect: u.searchParams.get("redirect_to"),
      });
      let data = [];
      if (p.includes("/auth/v1/user")) data = user;
      else if (p.includes("/auth/v1/recover") || p.includes("/auth/v1/logout")) data = {};
      else if (p.includes("/storage/v1/object/") && req.method() === "POST")
        data = { Key: "fixture/image.webp", Id: "fixture" };
      else if (p.includes("/storage/v1/object/") && req.method() === "GET")
        return route.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
            "base64",
          ),
        });
      else if (p.includes("/rpc/is_gsn_admin")) data = true;
      else if (p.includes("/rpc/member_username_available")) data = true;
      else if (p.includes("/rpc/save_member_profile")) {
        profile = { ...profile, username: body.p_username, avatar_path: body.p_avatar_path };
        data = null;
      } else if (p.includes("/member_profiles")) data = profile;
      else if (p.includes("/archive_entries"))
        data = [
          {
            id: entryId,
            category: "characters",
            name: "Anis",
            data: {
              name: "Anis",
              cls: "Nikke",
              tag: "TEST",
              summary: "<p>A dossier.</p>",
              voiceVersion: 2,
              voices: [
                { url: "/first.mp3", text: "First line" },
                { url: "/second.mp3", text: "Second line" },
              ],
              image: "",
            },
          },
        ];
      else if (p.includes("/member_notifications"))
        return route.fulfill({
          contentType: "application/json",
          headers: { "content-range": "*/0" },
          body: "[]",
        });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
    });
    return { context, page };
  }
  try {
    let { context, page } = await setup();
    await page.goto(base + "/");
    await page.waitForFunction(
      () =>
        !!document.querySelector(".sidebar .nav-item") &&
        Object.keys(document.querySelector(".sidebar .nav-item")).some((k) =>
          k.startsWith("__reactProps"),
        ),
    );
    const rail = page.locator(".sidebar");
    const main = page.locator(".main-wrap");
    await page.mouse.move(900, 800);
    await page.waitForFunction(
      () => Math.round(document.querySelector(".sidebar").getBoundingClientRect().width) === 72,
    );
    const left = (await main.boundingBox()).x;
    await rail.hover({ position: { x: 65, y: 180 } });
    await page.waitForTimeout(450); // Longer than the expansion transition/delay.
    assert.equal(Math.round((await rail.boundingBox()).width), 72);
    await page.locator('.sidebar .brand-logo').hover();
    await page.waitForFunction(
      () => Math.round(document.querySelector(".sidebar").getBoundingClientRect().width) === 248,
    );
    assert.equal((await main.boundingBox()).x, left);
    await rail.hover({ position: { x: 180, y: 200 } });
    assert.equal(Math.round((await rail.boundingBox()).width), 248);
    assert.equal(await rail.evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
    await page.mouse.move(900, 800);
    await page.waitForFunction(
      () => Math.round(document.querySelector(".sidebar").getBoundingClientRect().width) === 72,
    );
    await rail.getByRole("link", { name: "Overview", exact: true }).focus();
    await page.waitForFunction(
      () => Math.round(document.querySelector(".sidebar").getBoundingClientRect().width) === 248,
    );
    await page.locator(".search-trigger").focus();
    await page.waitForFunction(
      () => Math.round(document.querySelector(".sidebar").getBoundingClientRect().width) === 72,
    );
    assert.equal(
      (await page.locator("body").innerText()).toLowerCase().includes("community"),
      false,
    );
    for (const path of ["/community", "/community-editor", "/comments/test", "/notifications"]) {
      await page.goto(base + path);
      await page.getByRole("heading", { name: "File not found" }).waitFor();
    }
    await page.goto(base + "/profile");
    await page.getByRole("heading", { name: "Administrator access" }).waitFor();
    await page.getByRole("button", { name: "Admin sign in", exact: true }).last().click();
    assert.equal(await page.getByRole("button", { name: /create account|sign up/i }).count(), 0);
    await context.close();
    ({ context, page } = await setup(true));
    await page.goto(base + "/profile");
    await page.getByRole("heading", { name: "CropTester", exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: /My Images|My Activity|Notifications|Moderation/ })
        .count(),
      0,
    );
    await page.goto(base + "/characters");
    await page.getByText("A dossier.", { exact: true }).waitFor();
    await page.waitForFunction(() =>
      Object.keys(document.querySelector("[data-testid=card-entry-anis]")).some((k) =>
        k.startsWith("__reactProps"),
      ),
    );
    await page.getByTestId("card-entry-anis").click();
    await page.getByRole("heading", { name: "Anis", exact: true }).waitFor();
    await page.waitForFunction(() => window.playedVoices.length === 1);
    assert.deepEqual(await page.evaluate(() => window.playedVoices), ["/first.mp3"]);
    await page.getByTestId("button-back-dossier").click();
    await page.getByTestId("card-entry-anis").click();
    await page.waitForFunction(() => window.playedVoices.length === 2);
    assert.deepEqual(await page.evaluate(() => window.playedVoices), ["/first.mp3", "/second.mp3"]);
    await page.getByTestId("button-back-dossier").click();
    await page.getByTestId("card-entry-anis").click();
    await page.waitForFunction(() => window.playedVoices.length === 3);
    assert.equal((await page.evaluate(() => window.playedVoices))[2], "/first.mp3");
    await context.close();
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    page = await context.newPage();
    await page.route(url + "/**", (route) =>
      route.fulfill({ contentType: "application/json", body: "[]" }),
    );
    await page.goto(base + "/");
    const menu = page.getByTestId("button-open-navigation");
    await menu.waitFor();
    await menu.click();
    await page.waitForFunction(() => document.querySelector(".sidebar").classList.contains("open"));
    await page.getByRole("button", { name: "Close navigation", exact: true }).first().click();
    await page.waitForFunction(
      () => !document.querySelector(".sidebar").classList.contains("open"),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Archive-only browser checks passed: hover/focus rail without layout shift, retired routes, no signup/community UI, retained admin settings, sequential audio and mobile navigation.",
    );
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
