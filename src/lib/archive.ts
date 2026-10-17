import { supabase } from './community';

export async function loadArchive<T>(fallback: T): Promise<{ data: T; source: 'remote' | 'cache' | 'unconfigured'; error?: string }> {
  if (!supabase) return { data: fallback, source: 'unconfigured' };
  try {
    const { data, error } = await supabase.from('archive_entries').select('id,category,name,data');
    if (error) throw new Error(error.message);
    const result: Record<string, unknown[]> = {};
    for (const row of data || []) {
      const item = row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...row.data, name: row.name, id: row.id } : row.data;
      (result[row.category] ??= []).push(item);
    }
    return { data: result as T, source: 'remote' };
  } catch (error) {
    return { data: fallback, source: 'cache', error: error instanceof Error ? error.message : 'Shared archive unavailable' };
  }
}

export async function loadArchiveAliases(): Promise<Array<{ category: string; name: string; entry_id: string }>> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('archive_entry_aliases').select('category,name,entry_id');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveArchiveEntry(category: string, name: string, data: unknown, originalName?: string) {
  if (!supabase) throw new Error('Shared storage is not connected. Nothing was published.');
  // Settings have fixed keys, unlike user-named dossiers.
  const { error } = category === 'settings'
    ? await supabase.from('archive_entries').upsert({ category, name, data, updated_at: new Date().toISOString() }, { onConflict: 'category,name' })
    : await supabase.rpc('save_archive_entry', { p_category: category, p_name: name, p_data: data, p_original_name: originalName ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteArchiveEntry(category: string, name: string) {
  if (!supabase) throw new Error('Shared storage is not connected.');
  const { data, error } = await supabase.from('archive_entries').delete().eq('category', category).eq('name', name).select('name');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('The entry was not deleted. Reload and check your admin access.');
}
