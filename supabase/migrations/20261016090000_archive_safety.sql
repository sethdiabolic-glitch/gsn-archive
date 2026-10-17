-- Stable identity survives renames; historical names keep existing links working.
alter table public.archive_entries add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists archive_entries_id_key on public.archive_entries(id);
create table if not exists public.archive_entry_aliases (
  category text not null,
  name text not null,
  entry_id uuid not null references public.archive_entries(id) on delete cascade,
  primary key(category, name)
);
alter table public.archive_entry_aliases enable row level security;
grant select on public.archive_entry_aliases to anon, authenticated;
create policy "Public can read archive aliases" on public.archive_entry_aliases for select using (true);

-- One transaction: collision checks, rename and alias creation either all succeed or all roll back.
create or replace function public.save_archive_entry(p_category text, p_name text, p_data jsonb, p_original_name text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare entry_uuid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin access required'; end if;
  if length(trim(p_name)) = 0 then raise exception 'An entry name is required'; end if;
  -- Serialise writes, including concurrent attempts to claim a historical name.
  perform pg_advisory_xact_lock(hashtext('gsn_archive_save'));
  if p_original_name is null then
    if exists(select 1 from archive_entries where category = p_category and name = p_name)
      or exists(select 1 from archive_entry_aliases where category = p_category and name = p_name) then
      raise exception 'That name is already in use. Choose another name.';
    end if;
    insert into archive_entries(category, name, data) values(p_category, p_name, p_data);
  else
    select id into entry_uuid from archive_entries where category = p_category and name = p_original_name for update;
    if entry_uuid is null then raise exception 'This entry has changed or was removed. Reload before editing.'; end if;
    if exists(select 1 from archive_entries where category = p_category and name = p_name and id <> entry_uuid)
      or exists(select 1 from archive_entry_aliases where category = p_category and name = p_name and entry_id <> entry_uuid) then
      raise exception 'That name is already in use. Choose another name.';
    end if;
    if p_original_name <> p_name then
      insert into archive_entry_aliases(category, name, entry_id) values(p_category, p_original_name, entry_uuid)
        on conflict(category, name) do nothing;
    end if;
    update archive_entries set name = p_name, data = p_data, updated_at = now() where id = entry_uuid;
  end if;
end;
$$;
revoke all on function public.save_archive_entry(text, text, jsonb, text) from public;
grant execute on function public.save_archive_entry(text, text, jsonb, text) to authenticated;

create policy "Admins can delete community art files" on storage.objects for delete to authenticated
using (bucket_id = 'community-art' and public.has_role(auth.uid(), 'admin'));
