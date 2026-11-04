-- Archive-only release. Preserve historical records and files; block retired social APIs.
-- Apply with this app release, not while old community controls are still published.
begin;
create policy "Staff profile access" on public.member_profiles as restrictive for select to anon, authenticated using(public.has_role(auth.uid(),'admin'));
create policy "Retired moderation history" on public.artwork_moderation_log as restrictive for all to anon, authenticated using(false) with check(false);
create policy "Retired artwork access" on public.artworks as restrictive for all to anon, authenticated using(false) with check(false);
create policy "Retired discussion access" on public.entry_comments as restrictive for all to anon, authenticated using(false) with check(false);
create policy "Retired notification access" on public.member_notifications as restrictive for all to anon, authenticated using(false) with check(false);
create policy "Retired member artwork storage" on storage.objects as restrictive for all to anon, authenticated using(bucket_id <> 'member-art') with check(bucket_id <> 'member-art');
-- The existing bucket also holds dossier images and audio. Keep reading those assets,
-- but only admins can upload/delete them or account avatar assets.
create policy "Archive asset upload requires admin" on storage.objects as restrictive for insert to authenticated with check(bucket_id not in ('community-art','member-avatars') or public.has_role(auth.uid(),'admin'));
create policy "Archive asset deletion requires admin" on storage.objects as restrictive for delete to authenticated using(bucket_id not in ('community-art','member-avatars') or public.has_role(auth.uid(),'admin'));
revoke execute on function public.post_entry_comment(uuid,text,uuid),public.delete_entry_comment(uuid),public.comment_page(uuid,uuid),public.comment_context(uuid),public.notification_page(uuid),public.mark_notifications_read(uuid),public.my_art_page(uuid),public.moderate_member_art(uuid,text,text),public.manage_member_art(uuid,text,text),public.resubmit_member_art(uuid,text,text) from public,anon,authenticated;
-- Profile reads and writes are now staff-only.
create or replace function public.save_member_profile(p_username text,p_avatar_path text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin') then raise exception 'Admin access required'; end if;
 insert into member_profiles(user_id,username,avatar_path) values(auth.uid(),trim(p_username),p_avatar_path)
 on conflict(user_id) do update set username=excluded.username,avatar_path=excluded.avatar_path,updated_at=now();
exception when unique_violation then raise exception 'That username is already taken';
end; $$;
revoke all on function public.save_member_profile(text,text) from public,anon;
grant execute on function public.save_member_profile(text,text) to authenticated;
commit;
