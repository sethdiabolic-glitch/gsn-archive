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
    await page.goto(base + "/profile");
    await page.waitForFunction(() => {
      const b = document.querySelector(".topbar button.btn");
      return b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
    });
    await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
    await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill("fixture@example.com");
    await page.getByRole("button", { name: "Send recovery email", exact: true }).click();
    await page.getByText("If an account exists for that email", { exact: false }).waitFor();
    const recovery = requests.find((r) => r.path.includes("/auth/v1/recover"));
    assert.ok(recovery);
    assert.equal(recovery.redirect, base + "/reset-password");
    await context.close();
    ({ context, page } = await setup());
    await page.goto(base + "/reset-password");
    await page
      .getByText("This recovery link is missing, expired or already used.", { exact: false })
      .waitFor();
    assert.equal(await page.getByLabel("New password", { exact: true }).count(), 0);
    await context.close();
    ({ context, page } = await setup());
    const hash = new URLSearchParams({
      access_token: jwt,
      refresh_token: "fixture",
      expires_in: "3600",
      expires_at: String(Math.floor(Date.now() / 1000) + 3600),
      token_type: "bearer",
      type: "recovery",
    });
    await page.goto(base + "/reset-password#" + hash);
    await page.getByLabel("New password", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, "");
    await page.getByLabel("New password", { exact: true }).fill("fixture-password-only");
    await page.getByLabel("Confirm new password", { exact: true }).fill("different-password");
    await page.getByRole("button", { name: "Set new password", exact: true }).click();
    await page.getByText("The passwords do not match.", { exact: true }).waitFor();
    const before = requests.filter((r) => r.path === "/auth/v1/user" && r.method === "PUT").length;
    await page.getByLabel("Confirm new password", { exact: true }).fill("fixture-password-only");
    await page.getByRole("button", { name: "Set new password", exact: true }).click();
    await page.getByText("Your password has been changed.", { exact: false }).waitFor();
    assert.equal(
      requests.filter((r) => r.path === "/auth/v1/user" && r.method === "PUT").length,
      before + 1,
    );
    await context.close();
    ({ context, page } = await setup(true));
    await page.goto(base + "/profile");
    await page.getByRole("heading", { name: "CropTester", exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit profile", exact: true }).click();
    const png = Buffer.from(
      await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 320;
        const x = c.getContext("2d");
        x.fillStyle = "red";
        x.fillRect(0, 0, 320, 320);
        x.fillStyle = "blue";
        x.fillRect(320, 0, 320, 320);
        return c.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    );
    await page
      .locator('input[aria-label="Choose image for Change profile picture"]')
      .setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: png });
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("button", { name: "Apply crop", exact: true })
      .waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector(".crop-dialog button.btn.primary").disabled,
    );
    let rect = await page.locator(".crop-stage").boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width + 200, rect.y + rect.height / 2);
    await page.mouse.up();
    await page.getByRole("button", { name: "Apply crop", exact: true }).click();
    await page.getByAltText("Unsaved cropped profile preview").waitFor();
    const color = await page
      .getByAltText("Unsaved cropped profile preview")
      .evaluate(async (img) => {
        await img.decode();
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 512;
        c.getContext("2d").drawImage(img, 0, 0);
        return {
          width: img.naturalWidth,
          height: img.naturalHeight,
          color: [...c.getContext("2d").getImageData(256, 256, 1, 1).data],
        };
      });
    assert.equal(color.width, 512);
    assert.equal(color.height, 512);
    assert.ok(color.color[0] > 200 && color.color[2] < 30, JSON.stringify(color));
    const uploads = requests.filter(
      (r) => r.path.includes("/member-avatars") && r.method === "POST",
    ).length;
    assert.equal(uploads, 0);
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await page.getByText("Profile saved.", { exact: true }).waitFor();
    assert.equal(
      requests.filter((r) => r.path.includes("/member-avatars") && r.method === "POST").length,
      uploads + 1,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .locator('input[aria-label="Choose image for Change profile picture"]')
      .setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: png });
    await page.getByRole("dialog").waitFor();
    await page.getByLabel("Portrait zoom", { exact: true }).fill("2");
    await page
      .getByRole("group", { name: "Portrait position: drag or use arrow keys", exact: true })
      .focus();
    await page.keyboard.press("ArrowLeft");
    await page.getByRole("button", { name: "Reset position", exact: true }).click();
    assert.equal(await page.getByLabel("Portrait zoom", { exact: true }).inputValue(), "1");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForFunction(
      () => document.activeElement?.textContent === "Change profile picture",
    );
    assert.equal(await page.getByAltText("Unsaved cropped profile preview").count(), 0);
    await page.getByRole("button", { name: "Use GSN Arena logo", exact: true }).click();
    assert.equal(await page.locator(".profile-hero img").getAttribute("src"), "/gsn-logo.png");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("New password", { exact: true }).fill("fixture-password-only");
    await page.getByLabel("Confirm new password", { exact: true }).fill("not-matching");
    await page.getByRole("button", { name: "Update account", exact: true }).click();
    await page.getByText("The passwords do not match.", { exact: true }).waitFor();
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(base + "/entry/characters/Anis");
    await page.getByTestId("button-edit-dossier").click();
    await page.getByRole("button", { name: "Change portrait image", exact: true }).waitFor();
    await page
      .locator('input[aria-label="Choose image for Change portrait image"]')
      .setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: png });
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Apply crop", exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector(".profile-preview")?.getAttribute("src")?.includes("community-art"),
    );
    assert.ok(
      requests.some(
        (r) => r.path.includes("/storage/v1/object/community-art") && r.method === "POST",
      ),
    );
    await page.getByRole("button", { name: "Use GSN Arena logo", exact: true }).click();
    assert.equal(await page.locator(".profile-preview").getAttribute("src"), "/gsn-logo.png");
    await context.close();
    assert.deepEqual(errors, []);
    console.log(
      "Recovery/crop acceptance passed: reset email URL, invalid and valid recovery links, password confirmation, actual crop pixels/export, draft/save boundary, mobile/keyboard/reset/cancel, logo controls and dossier upload. No real emails or account passwords changed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
