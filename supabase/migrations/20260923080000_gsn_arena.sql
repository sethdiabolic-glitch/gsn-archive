create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

create or replace function public.is_gsn_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(), 'admin') $$;
grant execute on function public.is_gsn_admin() to authenticated, anon;

create table public.archive_entries (
  category text not null,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (category, name)
);
grant select on public.archive_entries to anon, authenticated;
grant insert, update, delete on public.archive_entries to authenticated;
grant all on public.archive_entries to service_role;
alter table public.archive_entries enable row level security;
create policy "Public can read archive" on public.archive_entries for select to anon, authenticated using (true);
create policy "Admins can insert archive" on public.archive_entries for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update archive" on public.archive_entries for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete archive" on public.archive_entries for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_name text not null,
  description text not null default '',
  image_url text not null,
  rating text not null check (rating in ('sfw','nsfw')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.artworks to anon, authenticated;
grant insert on public.artworks to authenticated;
grant update on public.artworks to authenticated;
grant all on public.artworks to service_role;
alter table public.artworks enable row level security;
create policy "Public can read approved art" on public.artworks for select to anon, authenticated using (status = 'approved' or public.has_role(auth.uid(), 'admin'));
create policy "Signed in users can submit art" on public.artworks for insert to authenticated with check (auth.uid() = user_id and status = 'pending');
create policy "Admins can moderate art" on public.artworks for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into storage.buckets (id, name, public) values ('community-art', 'community-art', true) on conflict (id) do nothing;
create policy "Anyone can view community art files" on storage.objects for select to public using (bucket_id = 'community-art');
create policy "Signed in users can upload community art" on storage.objects for insert to authenticated with check (bucket_id = 'community-art' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can manage their own community art files" on storage.objects for delete to authenticated using (bucket_id = 'community-art' and (storage.foldername(name))[1] = auth.uid()::text);
