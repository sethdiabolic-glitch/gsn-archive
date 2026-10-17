export const PUBLIC_CATEGORIES = [
  "characters",
  "heretics",
  "raptures",
  "infra",
  "weapons",
  "theories",
  "appendix",
] as const;
export const SITE_URL = "https://gsn-archive.lovable.app";
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type PublicArchive = Record<string, Array<Record<string, JsonValue>>>;
export type PublicRow = {
  id?: string;
  category: string;
  name: string;
  data: Record<string, JsonValue>;
  updated_at?: string;
};
export function isPublicCategory(category: string) {
  return (PUBLIC_CATEGORIES as readonly string[]).includes(category);
}
export function entryPath(category: string, name: string) {
  return `/entry/${encodeURIComponent(category)}/${encodeURIComponent(name)}`;
}
export function archiveFromRows(rows: PublicRow[]): PublicArchive {
  const archive: PublicArchive = Object.fromEntries(
    PUBLIC_CATEGORIES.map((category) => [category, []]),
  );
  for (const row of rows) {
    if (row.category === "settings") {
      const nested = row.data["data"];
      const setting =
        nested && typeof nested === "object" && !Array.isArray(nested) ? nested : row.data;
      if (row.name === "terms" && typeof setting["content"] === "string")
        (archive["settings"] ??= []).push({ name: "terms", content: setting["content"] });
      if (row.name === "image_tags" && Array.isArray(setting["tags"]))
        (archive["settings"] ??= []).push({
          name: "image_tags",
          tags: setting["tags"].filter((tag) => typeof tag === "string"),
        });
      continue;
    }
    if (!isPublicCategory(row.category)) continue;
    (archive[row.category] ??= []).push({
      ...row.data,
      name: row.name,
      ...(row.id ? { id: row.id } : {}),
    });
  }
  return archive;
}
export function xmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
