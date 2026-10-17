export type ReferenceEntry = { category: string; name: string; summary: string; id?: string };
export type ReferenceAlias = { category: string; name: string; entry_id: string };
export type ReferencePart = { text: string; entry?: ReferenceEntry };

const normalise = (name: string) => name.trim().normalize("NFKC").toLocaleLowerCase("en");

export function referenceIndex(entries: ReferenceEntry[], aliases: ReferenceAlias[] = []) {
  const index = new Map<string, ReferenceEntry[]>();
  const add = (name: string, entry: ReferenceEntry) => {
    const key = normalise(name);
    const matches = index.get(key) || [];
    if (!matches.includes(entry)) matches.push(entry);
    index.set(key, matches);
  };
  entries.forEach((entry) => add(entry.name, entry));
  aliases.forEach((alias) => {
    const entry = entries.find(
      (entry) => entry.id === alias.entry_id && entry.category === alias.category,
    );
    if (entry) add(alias.name, entry);
  });
  return (name: string): ReferenceEntry | undefined => {
    const matches = index.get(normalise(name)) || [];
    // Definitions always take precedence, regardless of category ordering.
    return (
      matches.find((entry) => entry.category === "appendix") ||
      (matches.length === 1 ? matches[0] : undefined)
    );
  };
}

/** Accept paired single or double asterisks, but never span paragraphs or partial triple markers. */
export function referenceParts(
  text: string,
  resolve: (name: string) => ReferenceEntry | undefined,
): ReferencePart[] {
  const parts: ReferencePart[] = [];
  const expression = /(?<!\*)\*\*([^*\n]+)\*\*(?!\*)|(?<!\*)\*([^*\n]+)\*(?!\*)/g;
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
    const name = (match[1] || match[2] || "").trim();
    const entry = resolve(name);
    parts.push(entry ? { text: name, entry } : { text: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function referenceHref(entry: ReferenceEntry) {
  return `/entry/${encodeURIComponent(entry.category)}/${encodeURIComponent(entry.name)}`;
}
