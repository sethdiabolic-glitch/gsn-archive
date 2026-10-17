const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const admin = "00000000-0000-4000-8000-000000000001",
  owner = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";

test("member permissions: identities, comment threads, notifications, notices and private moderation", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    `create role anon; create role authenticated; create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;grant usage on schema auth,storage to anon,authenticated;grant select on storage.objects to anon,authenticated;grant insert,delete on storage.objects to authenticated;`,
  );
  for (const f of fs.readdirSync("supabase/migrations").sort())
    await db.exec(fs.readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(
    `insert into auth.users values('${admin}'),('${owner}'),('${other}');insert into user_roles(user_id,role)values('${admin}','admin');insert into archive_entries(category,name,data)values('characters','Comment entry','{}'),('settings','private','{}');`,
  );
  const entry = (await db.query("select id from archive_entries where category='characters'"))
    .rows[0].id;
  const privateId = (await db.query("select id from archive_entries where category='settings'"))
    .rows[0].id;
  async function as(id, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
    await db.exec("set role " + role);
  }
  const query = (sql, args = []) => db.query(sql, args);
  const post = (text, parent = null, entryId = entry) =>
    query("select post_entry_comment($1,$2,$3) as id", [entryId, text, parent]);
  async function cooldown() {
    await db.exec("reset role");
    await db.exec("update entry_comments set created_at=created_at-interval '1 minute'");
    await db.exec("set role authenticated");
  }
  await as(owner);
  await assert.rejects(post("Before profile"), /username/);
  await query("select save_member_profile($1,null)", ["Artist_One"]);
  await assert.rejects(query("select save_member_profile('admin',null)"), /check constraint/);
  await assert.rejects(
    query("select save_member_profile($1,$2)", ["Artist_One", other + "/file.png"]),
    /check constraint/,
  );
  await assert.rejects(
    query("insert into member_profiles(user_id,username) values(auth.uid(),'Spoof')"),
    /permission denied|row-level security/,
  );
  await as(other);
  await assert.rejects(query("select save_member_profile('artist_one',null)"), /already taken/);
  await query("select save_member_profile('Other_User',null)");
  assert.equal(
    (await query("select member_username_available('ARTIST_ONE') as available")).rows[0].available,
    false,
  );
  await as(admin);
  await query("select save_member_profile('ArchiveStaff',null)");
  await as(owner);
  await assert.rejects(post("private", null, privateId), /Entry not found/);
  await assert.rejects(post("x".repeat(1001)), /1000/);
  const root = (await post("Hello <script>plain text</script>")).rows[0].id;
  await assert.rejects(post("Too soon"), /15 seconds/);
  await cooldown();
  await assert.rejects(post("Not yet", root), /Only admins/);
  await as(other);
  await assert.rejects(post("Unrelated reply", root), /Only admins/);
  await as(admin);
  const reply = (await post("Admin answer", root)).rows[0].id;
  await as(owner);
  const notifications = (await query("select * from notification_page()")).rows;
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].comment_id, reply);
  await query("select mark_notifications_read($1)", [notifications[0].id]);
  assert.ok((await query("select * from notification_page()")).rows[0].read_at);
  await post("Author response", root);
  await cooldown();
  await assert.rejects(post("Deep nesting", reply), /Thread is unavailable/);
  await as(other);
  assert.equal((await query("select * from notification_page()")).rows.length, 0);
  await assert.rejects(
    query(
      "insert into member_notifications(user_id,kind,title) values(auth.uid(),'fake','forged')",
    ),
    /permission denied|row-level security/,
  );
  await assert.rejects(query("select delete_entry_comment($1)", [root]), /could not be deleted/);
  await as(owner);
  await query("select delete_entry_comment($1)", [root]);
  const deleted = (await query("select * from comment_page($1)", [entry])).rows.find(
    (c) => c.id === root,
  );
  assert.equal(deleted.body, "");
  assert.ok(deleted.deleted_at);
  await as(null, "anon");
  assert.ok((await query("select * from comment_page($1)", [entry])).rows.some((c) => c.is_admin));
  await assert.rejects(post("Anonymous"), /permission denied/);
  // Notice drafts are invisible, publishing and expiry are enforced by RLS.
  await as(owner);
  await assert.rejects(
    query("select save_site_notice(null,'Notice','Body',null,true,null)"),
    /Admin access required/,
  );
  await as(admin);
  await query("select save_site_notice(null,'Draft','Body',null,false,null)");
  await query("select save_site_notice(null,'Live','Body','https://example.com',true,null)");
  await query("select save_site_notice(null,'Expired','Body',null,true,now()-interval '1 day')");
  await as(null, "anon");
  assert.deepEqual(
    (await query("select title from site_notices")).rows.map((r) => r.title),
    ["Live"],
  );
  // Private storage is unreadable to unrelated users until approved; decisions require reasons.
  await as(owner);
  await query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "member-art",
    owner + "/image.png",
  ]);
  const art = (
    await query(
      "insert into artworks(title,artist_name,image_url,storage_path,rating,user_id)values('Art','Artist','',$1,'sfw',auth.uid())returning id",
      [owner + "/image.png"],
    )
  ).rows[0].id;
  await assert.rejects(
    query("update artworks set status='approved' where id=$1", [art]),
    /permission denied/,
  );
  await as(other);
  assert.equal(
    (await query("select * from storage.objects where bucket_id='member-art'")).rows.length,
    0,
  );
  assert.equal((await query("select * from artworks where id=$1", [art])).rows.length, 0);
  await assert.rejects(
    query("select moderate_member_art($1,'approved','')", [art]),
    /Admin access required/,
  );
  await as(admin);
  await assert.rejects(
    query("select moderate_member_art($1,'rejected','')", [art]),
    /Provide a reason/,
  );
  await query("select moderate_member_art($1,'approved','')", [art]);
  await as(null, "anon");
  assert.equal(
    (await query("select * from storage.objects where bucket_id='member-art'")).rows.length,
    1,
  );
  await as(admin);
  await query("select moderate_member_art($1,'removed','Wrong attribution')", [art]);
  await as(null, "anon");
  assert.equal(
    (await query("select * from storage.objects where bucket_id='member-art'")).rows.length,
    0,
  );
  await as(owner);
  assert.equal(
    (await query("select * from my_art_page()")).rows[0].moderation_reason,
    "Wrong attribution",
  );
  assert.equal(
    (await query("select * from storage.objects where bucket_id='member-art'")).rows.length,
    1,
  );
  assert.ok(
    (await query("select * from notification_page()")).rows.some(
      (n) => n.message === "Wrong attribution",
    ),
  );
  await query("select manage_member_art($1,'review','This attribution is correct')", [art]);
  assert.equal(
    (await query("select status from artworks where id=$1", [art])).rows[0].status,
    "pending",
  );
  await assert.rejects(
    query("select manage_member_art($1,'review','repeat')", [art]),
    /Explain the review/,
  );
  await query("select manage_member_art($1,'withdraw','')", [art]);
  assert.equal(
    (await query("delete from storage.objects where bucket_id='member-art' returning id")).rows
      .length,
    0,
  );
  await query("select resubmit_member_art($1,'Revised title','New context')", [art]);
  assert.equal(
    (await query("select status from artworks where id=$1", [art])).rows[0].status,
    "pending",
  );
  await query("select manage_member_art($1,'withdraw','')", [art]);
  await query("select manage_member_art($1,'delete','')", [art]);
  assert.equal(
    (await query("delete from storage.objects where bucket_id='member-art' returning id")).rows
      .length,
    1,
  );
  await as(admin);
  assert.ok((await query("select * from artwork_moderation_log")).rows.length >= 6);
  // Stable UUID tie-breakers prevent skipped rows when timestamps are identical.
  await db.exec("reset role");
  await db.exec("delete from member_notifications; delete from entry_comments;");
  await query(
    "insert into entry_comments(entry_id,user_id,body,created_at) select $1,$2,'Page '||i,now() from generate_series(1,55)i",
    [entry, owner],
  );
  await query(
    "insert into member_notifications(user_id,kind,title,created_at) select $1,'test','Notice '||i,now() from generate_series(1,55)i",
    [owner],
  );
  await query(
    "insert into artworks(title,artist_name,image_url,rating,user_id,created_at) select 'Page '||i,'Artist','legacy','sfw',$1,now() from generate_series(1,25)i",
    [owner],
  );
  await as(owner);
  const firstComments = (await query("select * from comment_page($1)", [entry])).rows;
  const nextComments = (
    await query("select * from comment_page($1,$2)", [entry, firstComments.at(-1).id])
  ).rows;
  assert.equal(firstComments.length, 50);
  assert.equal(nextComments.length, 5);
  assert.equal(new Set([...firstComments, ...nextComments].map((c) => c.id)).size, 55);
  const firstNotifications = (await query("select * from notification_page()")).rows;
  const nextNotifications = (
    await query("select * from notification_page($1)", [firstNotifications.at(-1).id])
  ).rows;
  assert.equal(firstNotifications.length, 50);
  assert.equal(nextNotifications.length, 5);
  const firstArt = (await query("select * from my_art_page()")).rows;
  const nextArt = (await query("select * from my_art_page($1)", [firstArt.at(-1).id])).rows;
  assert.equal(firstArt.length, 24);
  assert.equal(nextArt.length, 1);
  assert.equal(
    (await query("select * from comment_context($1)", [nextComments[0].id])).rows[0].id,
    nextComments[0].id,
  );
});
