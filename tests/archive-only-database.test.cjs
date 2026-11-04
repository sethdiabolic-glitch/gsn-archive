const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
test("archive-only release blocks retired APIs without deleting content or blocking admin assets", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    `create role anon; create role authenticated; create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;grant usage on schema auth,storage to anon,authenticated;grant select on storage.objects to anon,authenticated;grant insert,delete on storage.objects to authenticated;`,
  );

  for (const f of fs.readdirSync("supabase/migrations").sort())
    await db.exec(fs.readFileSync("supabase/migrations/" + f, "utf8"));
  const admin = "00000000-0000-4000-8000-000000000001",
    member = "00000000-0000-4000-8000-000000000002";
  await db.exec(
    `insert into auth.users values('${admin}'),('${member}');insert into user_roles(user_id,role)values('${admin}','admin');insert into archive_entries(category,name,data)values('characters','Retained dossier','{}');insert into artworks(title,artist_name,image_url,rating,status)values('Historical','Artist','https://example.com/image.png','sfw','approved');insert into storage.objects(bucket_id,name)values('community-art','old.png'),('member-art','old.png');`,
  );
  assert.equal((await db.query("select count(*)::int as n from artworks")).rows[0].n, 1);
  async function as(id, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
    await db.exec("set role " + role);
  }
  for (const [id, role] of [
    [null, "anon"],
    [member, "authenticated"],
    [admin, "authenticated"],
  ]) {
    await as(id, role);
    for (const table of ["artworks", "entry_comments", "member_notifications"]) {
      if (role === "anon" && table === "member_notifications")
        await assert.rejects(db.query("select * from " + table), /permission denied/);
      else assert.equal((await db.query("select * from " + table)).rows.length, 0);
    }
    assert.equal(
      (await db.query("select * from storage.objects where bucket_id='member-art'")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects where bucket_id='community-art'")).rows.length,
      1,
    );
    for (const call of [
      "comment_page(null,null)",
      "notification_page(null)",
      "my_art_page(null)",
      "post_entry_comment(null,'text',null)",
      "moderate_member_art(null,'approved','')",
    ])
      await assert.rejects(db.query("select * from " + call), /permission denied/);
    assert.equal(
      (await db.query("select * from archive_entries where category='characters'")).rows.length,
      1,
    );
  }
  await as(member);
  await assert.rejects(
    db.query("select save_member_profile('NotStaff',null)"),
    /Admin access required/,
  );
  await assert.rejects(
    db.query(
      `insert into storage.objects(bucket_id,name)values('community-art','${member}/image.png')`,
    ),
    /row-level security/,
  );
  await assert.rejects(
    db.query(
      `insert into storage.objects(bucket_id,name)values('member-avatars','${member}/image.png')`,
    ),
    /row-level security/,
  );
  await as(admin);
  await db.query("select save_member_profile('StaffMember',null)");
  await db.query(
    `insert into storage.objects(bucket_id,name)values('community-art','${admin}/image.png'),('member-avatars','${admin}/image.png')`,
  );
  await assert.rejects(
    db.query(
      `insert into storage.objects(bucket_id,name)values('member-art','${admin}/image.png')`,
    ),
    /row-level security/,
  );
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int as n from artworks")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from auth.users")).rows[0].n, 2);
});
