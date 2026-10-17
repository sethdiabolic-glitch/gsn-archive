import { plainEntryText } from "./entry-content";
import {
  SITE_URL,
  PUBLIC_CATEGORIES,
  isPublicCategory,
  entryPath,
  xmlText,
  type PublicRow,
} from "./public-archive";

export const BASE_URL = SITE_URL;
export const SECTIONS = [
  ["characters", "Characters — Nikke dossiers"],
  ["heretics", "Heretics"],
  ["raptures", "Raptures"],
  ["infra", "Structures"],
  ["weapons", "Weapons"],
  ["theories", "Theories"],
  ["appendix", "Appendix"],
  ["tier-list", "Tier list"],
  ["compare", "Compare units"],
  ["community", "Community art"],
  ["terms", "Terms of Use"],
] as const;

/** Anonymous public reads only. Never forward visitor cookies or use service credentials. */
export async function fetchEntries(): Promise<PublicRow[]> {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;
  if (!url || !key) throw new Error("Public archive is not configured.");
  const rows: PublicRow[] = [];
  const signal = AbortSignal.timeout(10000);
  const filter = `or=(category.in.(${PUBLIC_CATEGORIES.join(",")}),and(category.eq.settings,name.in.(terms,image_tags)))`;
  // Explicit pagination avoids Supabase's default row cap silently truncating the sitemap/archive.
  for (let offset = 0; ;) {
    const res = await fetch(
      `${url}/rest/v1/archive_entries?select=id,category,name,data,updated_at&${filter}&order=category,name&limit=500&offset=${offset}`,
      { headers: { apikey: key, Prefer: "count=exact" }, signal },
    );
    if (!res.ok) throw new Error(`Public archive read failed (${res.status}).`);
    const page: unknown = await res.json();
    if (!Array.isArray(page)) throw new Error("Invalid public archive response.");
    for (const item of page) {
      if (
        typeof item?.category !== "string" ||
        typeof item?.name !== "string" ||
        !item.data ||
        typeof item.data !== "object" ||
        Array.isArray(item.data)
      )
        continue;
      if (
        isPublicCategory(item.category) ||
        (item.category === "settings" && ["terms", "image_tags"].includes(item.name))
      )
        rows.push(item as PublicRow);
    }
    offset += page.length;
    const range = res.headers.get("content-range");
    const total = range && /\/(\d+)$/.exec(range)?.[1];
    if (!page.length || (total && offset >= Number(total)) || (!total && page.length < 500)) break;
  }
  return rows;
}

export function summaryOf(data: Record<string, unknown>): string {
  for (const k of ["summary", "actualSummary", "description", "bio", "overview"]) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return plainEntryText(v).slice(0, 600);
  }
  return "";
}

export function sitemapXml(rows: PublicRow[]): string {
  const paths = ["/", ...SECTIONS.map(([slug]) => `/${slug}`), "/llms.txt"];
  const urls = paths.map((path) => `<url><loc>${xmlText(BASE_URL + path)}</loc></url>`);
  for (const row of rows.filter((row) => isPublicCategory(row.category))) {
    const date =
      row.updated_at && !Number.isNaN(Date.parse(row.updated_at))
        ? new Date(row.updated_at).toISOString()
        : null;
    urls.push(
      `<url><loc>${xmlText(BASE_URL + entryPath(row.category, row.name))}</loc>${date ? `<lastmod>${date}</lastmod>` : ""}</url>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}
export function llmsText(rows: PublicRow[]): string {
  let out =
    "# GSN Arena — Intelligence Archive\n\n> Community-maintained GODDESS OF VICTORY: NIKKE dossiers, feats, theories and references.\n\n## Sections\n";
  for (const [slug, label] of SECTIONS) out += `- [${label}](${BASE_URL}/${slug})\n`;
  for (const category of PUBLIC_CATEGORIES) {
    const entries = rows.filter((row) => row.category === category);
    if (!entries.length) continue;
    out += `\n## ${category}\n`;
    for (const row of entries)
      out += `- [${row.name.replace(/[[\]\\\r\n]/g, " ")}](${BASE_URL}${entryPath(row.category, row.name)}): ${summaryOf(row.data)}\n`;
  }
  return out;
}
