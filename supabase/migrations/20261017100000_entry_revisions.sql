-- Apply after 20261016090000_archive_safety.sql. No existing entries are removed.
begin;
create table if not exists public.archive_entry_revisions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.archive_entries(id) on delete cascade,
  category text not null,
  name text not null,
  data jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by uuid default auth.uid()
);
create index if not exists archive_entry_revisions_entry_idx on public.archive_entry_revisions(entry_id, saved_at desc);
alter table public.archive_entry_revisions enable row level security;
grant select on public.archive_entry_revisions to authenticated;
drop policy if exists "Admins can read entry revisions" on public.archive_entry_revisions;
create policy "Admins can read entry revisions" on public.archive_entry_revisions for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Trigger runs inside the same transaction as the save: failed edits create no history.
create or replace function public.capture_archive_revision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.category <> 'settings' then
    insert into public.archive_entry_revisions(entry_id, category, name, data, saved_by)
      values (new.id, new.category, new.name, new.data, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.capture_archive_revision() from public;
drop trigger if exists archive_revision_saved on public.archive_entries;
create trigger archive_revision_saved after insert or update of data, name on public.archive_entries
  for each row execute function public.capture_archive_revision();

-- Baseline snapshot permits recovery of the version that existed before this migration.
insert into public.archive_entry_revisions(entry_id, category, name, data, saved_by)
  select entry.id, entry.category, entry.name, entry.data, null from public.archive_entries entry
  where entry.category <> 'settings' and not exists (
    select 1 from public.archive_entry_revisions revision where revision.entry_id = entry.id
  );
commit;
