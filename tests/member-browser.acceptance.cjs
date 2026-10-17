const { chromium: pw } = require("playwright-core");
const { default: chromium, inflate } = require("@sparticuz/chromium");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  await inflate(
    require("node:path").join(
      require("node:path").dirname(require.resolve("@sparticuz/chromium")),
      "../bin/al2023.tar.br",
    ),
  );
  process.env.LD_LIBRARY_PATH = "/tmp/al2023/lib";
  const browser = await pw.launch({
    args: chromium.args.filter((a) => a !== "--single-process"),
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  const errors = [];
  const base = process.env.GSN_TEST_ORIGIN || "http://127.0.0.1:5173";
  const owner = "00000000-0000-4000-8000-000000000002",
    admin = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000003",
    entry = "00000000-0000-4000-8000-000000000010",
    artId = "00000000-0000-4000-8000-000000000011",
    rootId = "00000000-0000-4000-8000-000000000012",
    replyId = "00000000-0000-4000-8000-000000000013";
  const env = fs.readFileSync(require("node:path").join(__dirname, "../.env"), "utf8");
  const url = env.match(/VITE_SUPABASE_URL=["']?([^\s"']+)/)[1],
    host = new URL(url).hostname,
    project = host.split(".")[0];
  const now = "2026-10-17T14:00:00Z";
  let actor = owner;
  let isAdmin = false;
  let profile = { user_id: owner, username: "ArtistOne", avatar_path: null };
  let notifications = [
    {
      id: artId,
      kind: "artwork",
      title: "Artwork rejected",
      message: "Attribution needed",
      artwork_id: artId,
      entry_id: null,
      comment_id: null,
      created_at: now,
      read_at: null,
    },
  ];
  let notices = [
    {
      id: artId,
      title: "Welcome to the archive",
      message: "Community accounts are here.",
      link: null,
      active: true,
      expires_at: null,
      updated_at: now,
    },
  ];
  let art = {
    storage_path: owner + "/test.png",
    id: artId,
    title: "My artwork",
    artist_name: "ArtistOne",
    description: "An illustration",
    image_url: "https://images.fixture.test/test.png",
    rating: "sfw",
    status: "rejected",
    user_id: owner,
    moderation_reason: "Attribution needed",
    created_at: now,
    tags: [],
  };
  let comments = [
    {
      id: rootId,
      entry_id: entry,
      user_id: owner,
      parent_id: null,
      body: "Original comment",
      username: "ArtistOne",
      avatar_path: null,
      is_admin: false,
      deleted_at: null,
      created_at: now,
    },
    {
      id: replyId,
      entry_id: entry,
      user_id: admin,
      parent_id: rootId,
      body: "An admin reply",
      username: "ArchiveStaff",
      avatar_path: null,
      is_admin: true,
      deleted_at: null,
      created_at: now,
    },
  ];
  let requests = [];
  let submitted = 0;
  function token(id) {
    const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return (
      encode({ alg: "HS256", typ: "JWT" }) +
      "." +
      encode({
        sub: id,
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }) +
      ".fake"
    );
  }
  async function setup({ loggedIn = true, id = owner, adminMode = false } = {}) {
    actor = id;
    isAdmin = adminMode;
    profile = { ...profile, user_id: id, username: id === admin ? "ArchiveStaff" : "ArtistOne" };
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(
      ({ key, session }) => {
        try {
          if (session) localStorage.setItem(key, JSON.stringify(session));
        } catch {}
      },
      {
        key: `sb-${project}-auth-token`,
        session: loggedIn
          ? {
              access_token: token(id),
              refresh_token: "fixture",
              token_type: "bearer",
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: {
                id,
                email: "private@example.com",
                aud: "authenticated",
                role: "authenticated",
                app_metadata: { provider: "email" },
                user_metadata: {},
                created_at: now,
              },
            }
          : null,
      },
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("https://images.fixture.test/**", (r) =>
      r.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await page.route(url + "/**", async (route) => {
      const req = route.request(),
        u = new URL(req.url()),
        path = u.pathname;
      let data = [];
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {}
      requests.push({ path, body, method: req.method() });
      if (path.includes("/storage/v1/object/sign/member-art") && req.method() === "POST")
        data = body.paths.map((path) => ({
          path,
          signedURL: "/object/sign/member-art/" + path + "?token=fixture",
          error: null,
        }));
      else if (path.includes("/storage/v1/object/sign/member-art") && req.method() === "GET")
        return route.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
            "base64",
          ),
        });
      else if (path.includes("/auth/v1/user"))
        data = {
          id,
          email: "private@example.com",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: { provider: "email" },
          user_metadata: {},
        };
      else if (path.includes("/rpc/")) {
        const name = path.split("/").at(-1);
        switch (name) {
          case "is_gsn_admin":
            data = adminMode;
            break;
          case "member_username_available":
            data = body.p_username.toLowerCase() !== "takenname";
            break;
          case "save_member_profile":
            profile = { ...profile, username: body.p_username, avatar_path: body.p_avatar_path };
            data = null;
            break;
          case "my_art_page":
            data = [art];
            break;
          case "notification_page":
            data = notifications;
            break;
          case "mark_notifications_read":
            notifications = notifications.map((n) => ({ ...n, read_at: now }));
            data = null;
            break;
          case "comment_page":
            data = comments;
            break;
          case "comment_context":
            data = comments;
            break;
          case "post_entry_comment":
            comments.push({
              ...comments[0],
              id: crypto.randomUUID(),
              body: body.p_body,
              user_id: id,
              parent_id: body.p_parent,
              username: profile.username,
              is_admin: adminMode,
            });
            data = comments.at(-1).id;
            break;
          case "delete_entry_comment":
            comments = comments.map((c) =>
              c.id === body.p_id ? { ...c, body: "", deleted_at: now } : c,
            );
            data = null;
            break;
          case "manage_member_art":
            art = {
              ...art,
              status: body.p_action === "review" ? "pending" : "withdrawn",
              review_request: body.p_message,
            };
            data = null;
            break;
          case "moderate_member_art":
            art = { ...art, status: body.p_status, moderation_reason: body.p_reason };
            data = null;
            break;
          case "save_site_notice":
            notices = [
              {
                ...notices[0],
                title: body.p_title,
                message: body.p_message,
                active: body.p_active,
                updated_at: now,
              },
            ];
            data = artId;
            break;
          default:
            data = [];
        }
      } else if (path.includes("/member_profiles")) data = profile;
      else if (path.includes("/member_notifications")) {
        data = [];
        return route.fulfill({
          contentType: "application/json",
          headers: { "content-range": "0-0/1" },
          body: "[]",
        });
      } else if (path.includes("/archive_entries")) {
        if (u.searchParams.get("select") === "name,category")
          data = { name: "Anis", category: "characters" };
        else
          data = [
            {
              id: entry,
              category: "characters",
              name: "Anis",
              data: { name: "Anis", cls: "Nikke", tag: "TEST", summary: "<p>Public dossier.</p>" },
            },
          ];
      } else if (path.includes("/artworks") && req.method() === "POST") {
        submitted++;
        if (submitted === 2)
          return route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: "Fixture second upload failure" }),
          });
        data = null;
      } else if (path.includes("/artworks")) {
        const filter = u.searchParams.get("status")?.slice(3);
        data = !filter || filter === art.status ? [art] : [];
        if (u.searchParams.get("id")) data = art;
      } else if (path.includes("/site_notices")) data = notices;
      else if (path.includes("/entry_comments")) data = [];
      else if (path.includes("/artwork_moderation_log")) data = [];
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
    });
    return { page, context };
  }
  try {
    let { page, context } = await setup();
    await page.goto(base + "/profile");
    await page.getByRole("heading", { name: "ArtistOne", exact: true }).waitFor();
    await page.getByRole("heading", { name: "My Images", exact: true }).waitFor();
    assert.ok(await page.getByText("Attribution needed", { exact: false }).count());
    await page.getByRole("button", { name: "Submit artwork", exact: true }).click();
    await page.getByLabel("Artwork title", { exact: true }).fill("Upload test");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    );
    await page.locator("input[type=file]").setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: png },
      { name: "two.png", mimeType: "image/png", buffer: png },
    ]);
    await page.getByRole("button", { name: "Submit 2 for review", exact: true }).click();
    await page.getByText("Fixture second upload failure", { exact: false }).waitFor();
    assert.equal(await page.locator(".batch-item").count(), 1);
    assert.equal(submitted, 2);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Edit profile", exact: true }).click();
    await page.getByLabel("Username", { exact: true }).fill("TakenName");
    await page.getByText("That username is already taken", { exact: true }).waitFor();
    await page.getByLabel("Username", { exact: true }).fill("NewArtist");
    await page.getByText("Username available", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await page.getByText("Profile saved.", { exact: true }).waitFor();
    assert.equal(profile.username, "NewArtist");
    assert.equal(await page.locator(".profile-hero img").getAttribute("src"), "/gsn-logo.png");
    await page.getByRole("button", { name: "My Images", exact: true }).click();
    await page
      .getByLabel("Request review", { exact: true })
      .fill("I own this artwork. Please review again.");
    await page.getByRole("button", { name: "Request review", exact: true }).click();
    await page.getByText("pending", { exact: true }).first().waitFor();
    await page.goto(base + "/comments/" + entry);
    await page.getByText("Original comment", { exact: true }).waitFor();
    await page.getByText("Reply in this thread", { exact: true }).click();
    const reply = page.getByLabel("Your reply", { exact: true });
    await reply.fill("Thanks for reviewing this.");
    await page.getByText("26 / 1,000", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Post reply", exact: true }).click();
    await page.getByText("Thanks for reviewing this.", { exact: true }).waitFor();
    assert.ok(
      requests.some((r) => r.path.endsWith("/post_entry_comment") && r.body.p_parent === rootId),
    );
    assert.equal(await page.getByText("private@example.com", { exact: true }).count(), 0);
    await page.goto(base + "/notifications");
    await page.getByRole("heading", { name: "Artwork rejected", exact: true }).waitFor();
    await page.getByRole("button", { name: "Mark all as read", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll(".notification-item.unread").length === 0,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/profile");
    await page.getByRole("heading", { name: profile.username, exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: require("node:path").join(
        process.env.GSN_SCREENSHOT_DIR || require("node:os").tmpdir(),
        "member-mobile.png",
      ),
      fullPage: true,
    });
    await context.close();
    ({ page, context } = await setup({ id: other }));
    await page.goto(base + "/comments/" + entry);
    await page.getByText("Original comment", { exact: true }).waitFor();
    assert.equal(await page.getByText("Reply in this thread", { exact: true }).count(), 0);
    await context.close();
    ({ page, context } = await setup({ loggedIn: false }));
    await page.goto(base + "/comments/" + entry);
    await page.getByRole("button", { name: "Sign in to comment", exact: true }).waitFor();
    assert.equal(await page.getByLabel("Your comment", { exact: true }).count(), 0);
    await page.goto(base + "/profile");
    await page.getByRole("button", { name: "Sign in / Create account", exact: true }).waitFor();
    await context.close();
    art = { ...art, status: "pending" };
    ({ page, context } = await setup({ id: admin, adminMode: true }));
    await page.goto(base + "/community-editor");
    await page.getByRole("heading", { name: "My artwork", exact: true }).waitFor();
    assert.ok(await page.getByRole("button", { name: "Reject", exact: true }).isDisabled());
    await page
      .getByLabel("Reason to send the owner", { exact: true })
      .fill("Please add the original artist credit.");
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector(".moderation-list")?.textContent === "",
    );
    assert.equal(art.status, "rejected");
    assert.equal(art.moderation_reason, "Please add the original artist credit.");
    await page.goto(base + "/notices");
    await page.getByLabel("Title", { exact: true }).fill("New announcement");
    await page.getByLabel("Message", { exact: true }).fill("A test notice for the archive.");
    await page.getByLabel("Published (uncheck to dismiss site-wide)", { exact: true }).check();
    await page.getByRole("button", { name: "Save notice", exact: true }).click();
    await page
      .getByText("Notice saved. Public cards refresh within a minute.", { exact: true })
      .waitFor();
    assert.equal(notices[0].title, "New announcement");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await context.close();
    assert.deepEqual(errors, []);
    console.log(
      "Member browser acceptance passed: profile/default avatar, username checks, review request, author/admin replies, counter, guest/unrelated-user permissions, notifications, reason-required moderation, notices and mobile layouts.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
