import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ArtworkStatus = 'pending' | 'approved' | 'rejected';
export type ArtworkRating = 'sfw' | 'nsfw';

export type Artwork = {
  id: string;
  title: string;
  artist_name: string;
  description: string;
  image_url: string;
  rating: ArtworkRating;
  status: ArtworkStatus;
  created_at: string;
  user_id?: string;
  tags?: string[];
};

const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

const DEMO_KEY = 'gsnArenaCommunityArt';

export function getDemoArt(): Artwork[] {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]') as Artwork[]; } catch { return []; }
}

export function saveDemoArt(items: Artwork[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(items));
}

export async function getArt(): Promise<Artwork[]> {
  if (!supabase) return getDemoArt();
  const { data, error } = await supabase.from('artworks').select('*').eq('status', 'approved').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Artwork[];
}

export async function getPendingArt(): Promise<Artwork[]> {
  if (!supabase) return getDemoArt().filter(a => a.status === 'pending');
  const { data, error } = await supabase.from('artworks').select('*').eq('status', 'pending').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Artwork[];
}

export async function submitArt(input: { title: string; artist_name: string; description: string; rating: ArtworkRating; file: File; tags?: string[] }): Promise<void> {
  if (!supabase) {
    const reader = new FileReader();
    const image_url = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(input.file); });
    const items = getDemoArt();
    items.unshift({ id: crypto.randomUUID(), title: input.title, artist_name: input.artist_name, description: input.description, image_url, rating: input.rating, status: 'pending', created_at: new Date().toISOString() });
    saveDemoArt(items);
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in before submitting artwork.');
  const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('community-art').upload(path, input.file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data: publicData } = supabase.storage.from('community-art').getPublicUrl(path);
  const { error } = await supabase.from('artworks').insert({ title: input.title, artist_name: input.artist_name, description: input.description, rating: input.rating, image_url: publicData.publicUrl, status: 'pending', user_id: user.id, tags: input.tags || [] });
  if (error) {
    const { error: cleanupError } = await supabase.storage.from('community-art').remove([path]);
    if (cleanupError) throw new Error('Submission failed and the uploaded file could not be cleaned up. Please contact an admin.');
    throw new Error(error.message);
  }
}

// Calls the is_gsn_admin() database function (see supabase-schema.sql).
// This runs as SECURITY DEFINER, so it can safely tell a signed-in user
// whether THEY are an admin, without ever exposing the admin list itself.
export async function isGsnAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_gsn_admin');
  if (error) return false;
  return data === true;
}

export async function setArtStatus(id: string, status: ArtworkStatus): Promise<void> {
  if (!supabase) {
    const items = getDemoArt().map(a => a.id === id ? { ...a, status } : a);
    saveDemoArt(items);
    return;
  }
  const { error } = await supabase.from('artworks').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadArchiveImage(file: File): Promise<string> {
  if (!supabase) throw new Error('Storage is not connected.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in first.');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${user.id}/archive-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('community-art').upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('community-art').getPublicUrl(path).data.publicUrl;
}

export async function deleteMyArt(art: Artwork): Promise<void> {
  if (!supabase) throw new Error('Storage is not connected.');
  // Keep the record as a retry handle until file deletion is confirmed.
  const prefix = `${url}/storage/v1/object/public/community-art/`;
  if (!art.image_url.startsWith(prefix)) throw new Error('Unrecognised image location. Ask an admin to review this artwork.');
  const path = decodeURIComponent(art.image_url.slice(prefix.length).split('?')[0]!);
  const { data: removed, error: storageError } = await supabase.storage.from('community-art').remove([path]);
  if (storageError) throw new Error(storageError.message);
  if (!removed?.length) {
    // Storage may silently filter unauthorised deletes. Distinguish this from an already missing file.
    const slash = path.lastIndexOf('/');
    const { data: files, error: listError } = await supabase.storage.from('community-art').list(path.slice(0, slash), { search: path.slice(slash + 1) });
    if (listError) throw new Error(listError.message);
    if (files?.some(file => file.name === path.slice(slash + 1))) throw new Error('Image deletion was not permitted. The artwork record was kept; check storage policies and retry.');
  }
  const { data: deleted, error } = await supabase.from('artworks').delete().eq('id', art.id).select('id');
  if (error || !deleted?.length) throw new Error('Image removed, but the artwork record could not be deleted. Retry the takedown to finish.');
}

export async function submitArtBatch(input: { title: string; artist_name: string; description: string; rating: ArtworkRating; items: { file: File; tags: string[]; title: string }[] }): Promise<void> {
  if (input.items.length > 13) throw new Error('You can upload up to 13 images at once.');
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    if (!it) continue;
    const title = it.title.trim() || input.title;
    await submitArt({ title, artist_name: input.artist_name, description: input.description, rating: input.rating, file: it.file, tags: it.tags });
  }
}

export async function uploadArchiveFile(file: File, prefix = 'voice'): Promise<string> {
  if (!supabase) throw new Error('Storage is not connected.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in first.');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const path = `${user.id}/${prefix}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('community-art').upload(path, file, file.type ? { upsert: false, contentType: file.type } : { upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('community-art').getPublicUrl(path).data.publicUrl;
}
