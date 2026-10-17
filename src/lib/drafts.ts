export type Draft<T> = { version: 1; updatedAt: string; base: string; data: T };
export function draftKey(user: string, category: string, identity: string) {
  return `gsn:draft:v1:${encodeURIComponent(user)}:${encodeURIComponent(category)}:${encodeURIComponent(identity)}`;
}
export function readDraft<T>(storage: Pick<Storage, "getItem">, key: string): Draft<T> | null {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    if (
      value?.version !== 1 ||
      typeof value.updatedAt !== "string" ||
      typeof value.base !== "string" ||
      !value.data ||
      typeof value.data !== "object"
    )
      return null;
    for (const field of ["name", "cls", "summary", "speed", "strength", "durability"])
      if (typeof value.data[field] !== "string") return null;
    if (JSON.stringify(value.data) === value.base) return null;
    return value as Draft<T>;
  } catch {
    return null;
  }
}
export function writeDraft<T>(
  storage: Pick<Storage, "setItem">,
  key: string,
  data: T,
  base: string,
) {
  const draft: Draft<T> = { version: 1, updatedAt: new Date().toISOString(), base, data };
  storage.setItem(key, JSON.stringify(draft));
  return draft;
}
