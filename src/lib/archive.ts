import { supabase } from './community';

export async function loadArchive<T>(fallback: T): Promise<{ data: T; hasRemote: boolean }> {
  if (!supabase) return { data: fallback, hasRemote: false };
  const { data, error } = await supabase.from('archive_entries').select('category,name,data');
  if (error || !data?.length) return { data: fallback, hasRemote: false };
  const result: Record<string, unknown[]> = {};
  for (const row of data as Array<{ category: string; name: string; data: unknown }>) {
    const item = row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? { name: row.name, ...(row.data as object) } : row.data;
    (result[row.category] ??= []).push(item);
  }
  return { data: result as T, hasRemote: true };
}

export async function saveArchiveEntry(category: string, name: string, data: unknown) {
  if (!supabase) return;
  const { error } = await supabase.from('archive_entries').upsert({ category, name, data, updated_at: new Date().toISOString() }, { onConflict: 'category,name' });
  if (error) throw error;
}

export async function deleteArchiveEntry(category: string, name: string) {
  if (!supabase) return;
  const { error } = await supabase.from('archive_entries').delete().eq('category', category).eq('name', name);
  if (error) throw error;
}

export async function seedArchive(data: Record<string, unknown[]>) {
  if (!supabase) return;
  const rows = Object.entries(data).flatMap(([category, entries]) =>
    entries.map((entry: any) => ({ category, name: entry.name, data: entry, updated_at: new Date().toISOString() }))
  );
  if (!rows.length) return;
  const { error } = await supabase.from('archive_entries').upsert(rows, { onConflict: 'category,name' });
  if (error) throw error;
}
