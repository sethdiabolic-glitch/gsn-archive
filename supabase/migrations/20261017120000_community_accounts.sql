-- Account console, private submissions, comments, notifications and announcements.
-- Existing community-art URLs remain legacy public assets; new uploads use member-art.
begin;
create table public.member_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$' and lower(username) not in ('admin','administrator','moderator','system','gsn')),
 avatar_path text,
 updated_at timestamptz not null default now(),
 check (avatar_path is null or avatar_path like user_id::text || '/%')
);
create unique index member_username_unique on public.member_profiles(lower(username));
alter table public.member_profiles enable row level security;
create policy "Public profile identities" on public.member_profiles for select using (true);
grant select on public.member_profiles to anon,authenticated;

create table public.member_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null, title text not null, message text not null default '',
 artwork_id uuid, entry_id uuid, comment_id uuid,
 created_at timestamptz not null default now(), read_at timestamptz
);
create index member_notifications_owner on public.member_notifications(user_id,created_at desc);
alter table public.member_notifications enable row level security;
create policy "Own notifications only" on public.member_notifications for select using (user_id=auth.uid());
grant select on public.member_notifications to authenticated;
create function public.mark_notifications_read(p_id uuid default null) returns void language sql security definer set search_path=public as $$
 update member_notifications set read_at=now() where user_id=auth.uid() and read_at is null and (p_id is null or id=p_id);
$$;

create function public.save_member_profile(p_username text,p_avatar_path text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 insert into member_profiles(user_id,username,avatar_path) values(auth.uid(),trim(p_username),p_avatar_path)
 on conflict(user_id) do update set username=excluded.username,avatar_path=excluded.avatar_path,updated_at=now();
exception when unique_violation then raise exception 'That username is already taken';
end; $$;

create table public.entry_comments (
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.archive_entries(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 parent_id uuid references public.entry_comments(id) on delete cascade,
 body text not null, created_at timestamptz not null default now(), deleted_at timestamptz,
 check ((deleted_at is null and char_length(trim(body)) between 1 and 1000) or (deleted_at is not null and body=''))
);
create index entry_comments_thread on public.entry_comments(entry_id,created_at,id);
create index entry_comments_parent on public.entry_comments(parent_id);
create index entry_comments_author on public.entry_comments(user_id,created_at desc);
alter table public.entry_comments enable row level security;
create policy "Public entry comments" on public.entry_comments for select using (exists(select 1 from public.archive_entries e where e.id=entry_id and e.category in ('characters','heretics','raptures','infra','weapons','theories','appendix')));
grant select on public.entry_comments to anon,authenticated;

create function public.post_entry_comment(p_entry uuid,p_body text,p_parent uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare root entry_comments; new_id uuid; admin boolean; recipient uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to comment'; end if;
 if not exists(select 1 from member_profiles where user_id=auth.uid()) then raise exception 'Choose a username in your profile first'; end if;
 if not exists(select 1 from archive_entries where id=p_entry and category in ('characters','heretics','raptures','infra','weapons','theories','appendix')) then raise exception 'Entry not found'; end if;
 if char_length(trim(p_body)) not between 1 and 1000 then raise exception 'Use between 1 and 1000 characters'; end if;
 perform pg_advisory_xact_lock(hashtext('comment:' || auth.uid()::text));
 if exists(select 1 from entry_comments where user_id=auth.uid() and created_at>now()-interval '15 seconds') then raise exception 'Please wait 15 seconds between comments'; end if;
 admin := public.has_role(auth.uid(),'admin');
 if p_parent is not null then
  select * into root from entry_comments where id=p_parent;
  if root.id is null or root.parent_id is not null or root.entry_id<>p_entry or root.deleted_at is not null then raise exception 'Thread is unavailable'; end if;
  if not admin and not coalesce((root.user_id=auth.uid() and exists(select 1 from entry_comments c where c.parent_id=root.id and public.has_role(c.user_id,'admin') and c.deleted_at is null)),false) then raise exception 'Only admins and the original author after an admin response can reply'; end if;
 end if;
 insert into entry_comments(entry_id,user_id,parent_id,body) values(p_entry,auth.uid(),p_parent,trim(p_body)) returning id into new_id;
 if p_parent is not null then
  for recipient in select distinct c.user_id from entry_comments c where (c.id=p_parent or (c.parent_id=p_parent and public.has_role(c.user_id,'admin'))) and c.user_id<>auth.uid() loop
   insert into member_notifications(user_id,kind,title,message,entry_id,comment_id) values(recipient,'reply','New comment reply',left(trim(p_body),160),p_entry,new_id);
  end loop;
 end if;
 return new_id;
end; $$;
create function public.delete_entry_comment(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update entry_comments set body='',deleted_at=now() where id=p_id and (user_id=auth.uid() or public.has_role(auth.uid(),'admin')) and deleted_at is null;
 if not found then raise exception 'Comment could not be deleted'; end if;
end; $$;
create function public.comment_page(p_entry uuid,p_after uuid default null) returns table(id uuid,entry_id uuid,user_id uuid,parent_id uuid,body text,created_at timestamptz,deleted_at timestamptz,username text,avatar_path text,is_admin boolean) language sql stable set search_path=public as $$
 select c.id,c.entry_id,c.user_id,c.parent_id,c.body,c.created_at,c.deleted_at,p.username,p.avatar_path,public.has_role(c.user_id,'admin') from entry_comments c left join member_profiles p on p.user_id=c.user_id
 where c.entry_id=p_entry and (p_after is null or (c.created_at,c.id)>(select a.created_at,a.id from entry_comments a where a.id=p_after and a.entry_id=p_entry)) order by c.created_at,c.id limit 50;
$$;

-- Resolve notification anchors without loading an entire long discussion.
create function public.comment_context(p_comment uuid) returns table(id uuid,entry_id uuid,user_id uuid,parent_id uuid,body text,created_at timestamptz,deleted_at timestamptz,username text,avatar_path text,is_admin boolean) language sql stable set search_path=public as $$
 select c.id,c.entry_id,c.user_id,c.parent_id,c.body,c.created_at,c.deleted_at,p.username,p.avatar_path,public.has_role(c.user_id,'admin')
 from entry_comments c left join member_profiles p on p.user_id=c.user_id
 where c.id=p_comment or c.id=(select a.parent_id from entry_comments a where a.id=p_comment)
 order by c.created_at,c.id;
$$;
grant execute on function public.comment_context(uuid) to anon,authenticated;

create table public.site_notices (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(trim(title)) between 1 and 100),
 message text not null check(char_length(trim(message)) between 1 and 1000), link text,
 active boolean not null default false, expires_at timestamptz, updated_at timestamptz not null default now(),
 check(link is null or (char_length(link)<=2000 and link ~ '^https?://'))
);
alter table public.site_notices enable row level security;
create policy "Published notices or admin" on public.site_notices for select using ((active and (expires_at is null or expires_at>now())) or public.has_role(auth.uid(),'admin'));
grant select on public.site_notices to anon,authenticated;
create function public.save_site_notice(p_id uuid,p_title text,p_message text,p_link text,p_active boolean,p_expiry timestamptz) returns uuid language plpgsql security definer set search_path=public as $$
declare notice_id uuid := coalesce(p_id,gen_random_uuid());
begin
 if not public.has_role(auth.uid(),'admin') then raise exception 'Admin access required'; end if;
 insert into site_notices(id,title,message,link,active,expires_at) values(notice_id,trim(p_title),trim(p_message),nullif(trim(p_link),''),p_active,p_expiry)
 on conflict(id) do update set title=excluded.title,message=excluded.message,link=excluded.link,active=excluded.active,expires_at=excluded.expires_at,updated_at=now();
 return notice_id;
end; $$;

alter table public.artworks add column storage_path text;
alter table public.artworks add column moderation_reason text not null default '';
alter table public.artworks add column review_request text not null default '';
alter table public.artworks add column moderated_at timestamptz;
alter table public.artworks drop constraint artworks_status_check;
alter table public.artworks add constraint artworks_status_check check(status in ('pending','approved','rejected','removed','withdrawn'));
create table public.artwork_moderation_log (
 id uuid primary key default gen_random_uuid(), artwork_id uuid references public.artworks(id) on delete set null,
 actor_id uuid references auth.users(id) on delete set null, action text not null, reason text not null default '', created_at timestamptz not null default now()
);
alter table public.artwork_moderation_log enable row level security;
create policy "Admin moderation history" on public.artwork_moderation_log for select using(public.has_role(auth.uid(),'admin'));
grant select on public.artwork_moderation_log to authenticated;
-- Status changes and notifications must use the transactional RPC, including for admins.
drop policy if exists "Admins can moderate art" on public.artworks;
drop policy if exists "Owners can delete own artwork" on public.artworks;
drop policy if exists "Signed in users can submit art" on public.artworks;
revoke update,delete on public.artworks from authenticated,anon;
create policy "Private pending submissions" on public.artworks for insert to authenticated with check (
 user_id=auth.uid() and status='pending' and char_length(trim(title)) between 1 and 150 and char_length(artist_name) between 1 and 100 and char_length(description)<=1000 and cardinality(tags)<=50 and moderation_reason='' and review_request='' and moderated_at is null
 and exists(select 1 from member_profiles where user_id=auth.uid())
 and storage_path like auth.uid()::text || '/%' and image_url='' 
 and exists(select 1 from storage.objects where bucket_id='member-art' and name=storage_path)
);
create function public.moderate_member_art(p_id uuid,p_status text,p_reason text default '') returns void language plpgsql security definer set search_path=public as $$
declare art artworks;
begin
 if not public.has_role(auth.uid(),'admin') then raise exception 'Admin access required'; end if;
 if p_status not in ('approved','rejected','removed') then raise exception 'Invalid decision'; end if;
 if p_status in ('rejected','removed') and char_length(trim(p_reason)) not between 3 and 1000 then raise exception 'Provide a reason (3–1000 characters)'; end if;
 select * into art from artworks where id=p_id for update;
 if art.id is null then raise exception 'Artwork not found'; end if;
 if not ((art.status='pending' and p_status in ('approved','rejected')) or (art.status='approved' and p_status='removed')) then raise exception 'Artwork status changed. Refresh before moderating'; end if;
 update artworks set status=p_status,moderation_reason=trim(p_reason),review_request='',moderated_at=now() where id=p_id;
 insert into artwork_moderation_log(artwork_id,actor_id,action,reason) values(p_id,auth.uid(),p_status,trim(p_reason));
 if art.user_id is not null then
 insert into member_notifications(user_id,kind,title,message,artwork_id) values(art.user_id,'artwork',art.title || ' — ' || p_status,trim(p_reason),p_id);
 end if;
end; $$;
create function public.manage_member_art(p_id uuid,p_action text,p_message text default '') returns void language plpgsql security definer set search_path=public as $$
declare art artworks;
begin
 select * into art from artworks where id=p_id and user_id=auth.uid() for update;
 if art.id is null then raise exception 'Artwork not found'; end if;
 if p_action='withdraw' then
  if art.status='withdrawn' then raise exception 'Already withdrawn'; end if;
  update artworks set status='withdrawn' where id=p_id;
 elsif p_action='review' then
  if art.status not in ('rejected','removed') or char_length(trim(p_message)) not between 3 and 1000 then raise exception 'Explain the review request (3–1000 characters) for rejected or removed art'; end if;
  update artworks set status='pending',review_request=trim(p_message) where id=p_id;
 elsif p_action='delete' then
  if art.status<>'withdrawn' then raise exception 'Withdraw artwork before permanently deleting'; end if;
  delete from artworks where id=p_id;
 else raise exception 'Invalid action'; end if;
 insert into artwork_moderation_log(artwork_id,actor_id,action,reason) values(case when p_action='delete' then null else p_id end,auth.uid(),p_action,trim(p_message));
end; $$;

create function public.resubmit_member_art(p_id uuid,p_title text,p_description text) returns void language plpgsql security definer set search_path=public as $$
begin
 if char_length(trim(p_title)) not between 1 and 150 or char_length(p_description)>1000 then raise exception 'Use a title up to 150 characters and description up to 1000'; end if;
 update artworks set title=trim(p_title),description=p_description,status='pending',review_request='Edited and resubmitted by owner' where id=p_id and user_id=auth.uid() and status in ('rejected','removed','withdrawn');
 if not found then raise exception 'This submission cannot be resubmitted'; end if;
 insert into artwork_moderation_log(artwork_id,actor_id,action,reason) values(p_id,auth.uid(),'resubmit','Edited and resubmitted');
end; $$;
revoke all on function public.resubmit_member_art(uuid,text,text) from public,anon;
grant execute on function public.resubmit_member_art(uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('member-art','member-art',false,12582912,array['image/png','image/jpeg','image/webp','image/gif']),('member-avatars','member-avatars',true,2097152,array['image/png','image/jpeg','image/webp']);
create policy "Member artwork upload" on storage.objects for insert to authenticated with check(bucket_id='member-art' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Member artwork visibility" on storage.objects for select using(bucket_id='member-art' and ((storage.foldername(name))[1]=auth.uid()::text or public.has_role(auth.uid(),'admin') or exists(select 1 from public.artworks a where a.storage_path=name and a.status='approved')));
create policy "Member artwork cleanup" on storage.objects for delete to authenticated using(bucket_id='member-art' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.artworks a where a.storage_path=name));
create policy "Avatar upload" on storage.objects for insert to authenticated with check(bucket_id='member-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Public avatars" on storage.objects for select using(bucket_id='member-avatars');
create policy "Avatar cleanup" on storage.objects for delete to authenticated using(bucket_id='member-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create function public.member_username_available(p_username text) returns boolean language sql stable set search_path=public as $$
 select not exists(select 1 from member_profiles where lower(username)=lower(p_username) and user_id is distinct from auth.uid());
$$;
grant execute on function public.member_username_available(text) to anon,authenticated;
create function public.notification_page(p_after uuid default null) returns setof public.member_notifications language sql stable set search_path=public as $$
 select n.* from member_notifications n where n.user_id=auth.uid() and (p_after is null or (n.created_at,n.id)<(select a.created_at,a.id from member_notifications a where a.id=p_after)) order by n.created_at desc,n.id desc limit 50;
$$;
revoke all on function public.notification_page(uuid) from public,anon;
grant execute on function public.notification_page(uuid) to authenticated;
create function public.my_art_page(p_after uuid default null) returns setof public.artworks language sql stable set search_path=public as $$
 select a.* from artworks a where a.user_id=auth.uid() and (p_after is null or (a.created_at,a.id)<(select b.created_at,b.id from artworks b where b.id=p_after)) order by a.created_at desc,a.id desc limit 24;
$$;
revoke all on function public.my_art_page(uuid) from public,anon;
grant execute on function public.my_art_page(uuid) to authenticated;

-- Apply server-side MIME and size limits (Supabase supplies these bucket columns).
-- Function grants are explicit; anonymous readers can only call the read-only comment feed.
revoke all on function public.save_member_profile(text,text), public.mark_notifications_read(uuid),public.post_entry_comment(uuid,text,uuid),public.delete_entry_comment(uuid),public.save_site_notice(uuid,text,text,text,boolean,timestamptz),public.moderate_member_art(uuid,text,text),public.manage_member_art(uuid,text,text) from public,anon;
grant execute on function public.save_member_profile(text,text), public.mark_notifications_read(uuid),public.post_entry_comment(uuid,text,uuid),public.delete_entry_comment(uuid),public.save_site_notice(uuid,text,text,text,boolean,timestamptz),public.moderate_member_art(uuid,text,text),public.manage_member_art(uuid,text,text) to authenticated;
grant execute on function public.comment_page(uuid,uuid) to anon,authenticated;
commit;
