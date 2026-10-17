export const featDefinitions = [
  { key: "speed", label: "Speed" },
  { key: "strength", label: "Power / Strength" },
  { key: "durability", label: "Durability" },
] as const;

export type FeatKey = (typeof featDefinitions)[number]["key"];
export type FeatSource = { label?: string; chapter?: string; url?: string; image?: string };
export type EntryFeats = {
  speed: string;
  strength: string;
  durability: string;
  hiddenFeats?: FeatKey[];
  featSources?: Partial<Record<FeatKey, FeatSource>>;
  featLabels?: Partial<Record<FeatKey, string>>;
};

// Older entries have no visibility settings and keep their existing measurements.
export function visibleFeats(entry: EntryFeats) {
  return featDefinitions
    .filter(({ key }) => !entry.hiddenFeats?.includes(key) && entry[key]?.trim())
    .map(({ key, label }) => ({
      key,
      label: entry.featLabels?.[key]?.trim() || label,
      value: entry[key],
      source: entry.featSources?.[key],
    }));
}

export function hasFeatData(entry: EntryFeats): boolean {
  return visibleFeats(entry).some((feat) => feat.value.trim().toLowerCase() !== "n/a");
}

export function setFeatIncluded(entry: EntryFeats, key: FeatKey, included: boolean): FeatKey[] {
  const hidden = new Set(entry.hiddenFeats || []);
  if (included) hidden.delete(key);
  else hidden.add(key);
  return [...hidden];
}

export function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
