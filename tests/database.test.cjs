const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

test("database migration: atomic renames, aliases, collisions, permissions, and cleanup", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Supabase supplies these schemas/functions in production.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
    grant usage on schema auth, storage to authenticated, anon;
    grant select, delete on storage.objects to authenticated;
  `);
  for (const file of fs.readdirSync("supabase/migrations").sort()) {
    if (file === "20261017100000_entry_revisions.sql") {
      await db.exec(
        `insert into archive_entries(category,name,data) values ('characters','Baseline','{"summary":"Before history"}'), ('settings','terms','{"content":"Terms"}');`,
      );
    }
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
    if (file === "20261017100000_entry_revisions.sql") {
      const baseline = (await db.query("select name, saved_by from archive_entry_revisions")).rows;
      assert.equal(baseline.length, 1);
      assert.equal(baseline[0].name, "Baseline");
      assert.equal(baseline[0].saved_by, null);
      await db.exec("delete from archive_entries where name in ('Baseline', 'terms')");
    }
  }
  const admin = "00000000-0000-4000-8000-000000000001";
  const owner = "00000000-0000-4000-8000-000000000002";
  await db.exec(
    `insert into auth.users values ('${admin}'), ('${owner}'); insert into user_roles(user_id, role) values ('${admin}', 'admin');`,
  );
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
  const save = (name, original = null) =>
    db.query("select save_archive_entry($1,$2,$3::jsonb,$4)", [
      "characters",
      name,
      JSON.stringify({ name, summary: "test" }),
      original,
    ]);
  await save("Original");
  const id = (await db.query("select id from archive_entries")).rows[0].id;
  await save("Renamed", "Original");
  assert.equal(
    (
      await db.query("select count(*)::int as n from archive_entry_revisions where entry_id = $1", [
        id,
      ])
    ).rows[0].n,
    2,
  );
  assert.equal((await db.query("select count(*)::int as n from archive_entries")).rows[0].n, 1);
  assert.equal((await db.query("select id from archive_entries")).rows[0].id, id);
  assert.equal((await db.query("select entry_id from archive_entry_aliases")).rows[0].entry_id, id);
  await save("Other");
  await assert.rejects(save("Other", "Renamed"), /already in use/);
  assert.equal(
    (
      await db.query("select count(*)::int as n from archive_entry_revisions where entry_id = $1", [
        id,
      ])
    ).rows[0].n,
    2,
  );
  assert.equal(
    (await db.query("select name from archive_entries where id = $1", [id])).rows[0].name,
    "Renamed",
  );
  await assert.rejects(save("Original"), /already in use/);
  await assert.rejects(save("Original", "Other"), /already in use/);
  await assert.rejects(save("New", "Missing"), /changed or was removed/);
  await save("Original", "Renamed"); // Reverting to your own old name is safe.
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
  await assert.rejects(save("Forbidden"), /Admin access required/);
  // Actual RLS: another user's file may be deleted by admin, not by an unrelated user.
  await db.exec(
    `insert into storage.objects(bucket_id,name) values ('community-art','${owner}/image.png'), ('community-art','${admin}/image.png'); set role authenticated;`,
  );
  assert.equal(
    (await db.query("select count(*)::int as n from archive_entry_revisions")).rows[0].n,
    0,
  );
  const denied = await db.query("delete from storage.objects where name = $1 returning id", [
    `${admin}/image.png`,
  ]);
  assert.equal(denied.rows.length, 0);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
  assert.ok(
    (await db.query("select count(*)::int as n from archive_entry_revisions")).rows[0].n > 0,
  );
  await assert.rejects(db.query("delete from archive_entry_revisions"), /permission denied/);
  const allowed = await db.query("delete from storage.objects where name = $1 returning id", [
    `${owner}/image.png`,
  ]);
  assert.equal(allowed.rows.length, 1);
  await db.exec("reset role");
  const historyCount = (await db.query("select count(*)::int as n from archive_entry_revisions"))
    .rows[0].n;
  await db.exec(fs.readFileSync("supabase/migrations/20261017100000_entry_revisions.sql", "utf8"));
  assert.equal(
    (await db.query("select count(*)::int as n from archive_entry_revisions")).rows[0].n,
    historyCount,
  );
  await db.query("delete from archive_entries where id = $1", [id]);
  assert.equal(
    (await db.query("select count(*)::int as n from archive_entry_aliases")).rows[0].n,
    0,
  );
});
