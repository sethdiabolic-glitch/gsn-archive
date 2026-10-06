import { plainEntryText } from './entry-content';

export const BASE_URL = 'https://gsn-archive.lovable.app';
export const SECTIONS = [
  ['infra', 'Infra — the world beyond the battlefield'],
  ['characters', 'Characters — Nikke dossiers'],
  ['heretics', 'Heretics'],
  ['raptures', 'Raptures'],
  ['structures', 'Structures'],
  ['weapons', 'Weapons'],
  ['theories', 'Theories about the world of Goddess of Victory'],
  ['appendix', 'Appendix'],
  ['tier-list', 'Tier list'],
  ['compare', 'Compare units'],
  ['community', 'Community art'],
] as const;

type Row = { category: string; name: string; data: Record<string, unknown> };

export async function fetchEntries(): Promise<Row[]> {
  const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/archive_entries?select=category,name,data&order=category,name`, { headers: { apikey: key } });
    if (!res.ok) return [];
    return (await res.json()) as Row[];
  } catch { return []; }
}

export function summaryOf(data: Record<string, unknown>): string {
  for (const k of ['summary', 'actualSummary', 'description', 'bio', 'overview']) {
    const v = data?.[k];
    if (typeof v === 'string' && v.trim()) return plainEntryText(v).slice(0, 600);
  }
  return '';
}
