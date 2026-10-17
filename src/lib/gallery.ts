import type { Artwork } from "./community";

export const cleanTag = (tag: string) => tag.trim().replace(/^#+/, "").trim().replace(/\s+/g, " ");
export const tagKey = (tag: string) => cleanTag(tag).normalize("NFKC").toLocaleLowerCase("en");
export function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.map(cleanTag).filter((tag) => {
    const key = tagKey(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function tagSuggestions(tags: string[], query: string, selected: string[] = []) {
  const key = tagKey(query);
  const excluded = new Set(selected.map(tagKey));
  const rank = (tag: string) => (tagKey(tag) === key ? 0 : tagKey(tag).startsWith(key) ? 1 : 2);
  return uniqueTags(tags)
    .filter((tag) => !excluded.has(tagKey(tag)) && tagKey(tag).includes(key))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
export type GalleryFilters = {
  tags: string[];
  mode: "all" | "any";
  sort: "newest" | "oldest" | "artist" | "title";
  artist: string;
  rating: "sfw" | "nsfw";
};
export const defaultGalleryFilters: GalleryFilters = {
  tags: [],
  mode: "all",
  sort: "newest",
  artist: "",
  rating: "sfw",
};
export function readGalleryFilters(search: string): GalleryFilters {
  const params = new URLSearchParams(search);
  const sort = params.get("sort");
  return {
    tags: uniqueTags(params.getAll("tag")),
    mode: params.get("match") === "any" ? "any" : "all",
    sort: sort === "oldest" || sort === "artist" || sort === "title" ? sort : "newest",
    artist: params.get("artist") || "",
    rating: params.get("rating") === "nsfw" ? "nsfw" : "sfw",
  };
}
export function gallerySearch(filters: GalleryFilters): string {
  const params = new URLSearchParams();
  uniqueTags(filters.tags).forEach((tag) => params.append("tag", tag));
  if (filters.mode !== "all") params.set("match", filters.mode);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.artist) params.set("artist", filters.artist);
  if (filters.rating !== "sfw") params.set("rating", filters.rating);
  return params.toString();
}
export function filterArtworks(artworks: Artwork[], filters: GalleryFilters): Artwork[] {
  const selected = filters.tags.map(tagKey);
  const visible = artworks.filter((art) => {
    const tags = new Set((art.tags || []).map(tagKey));
    return (
      art.rating === filters.rating &&
      (!filters.artist || art.artist_name === filters.artist) &&
      (!selected.length ||
        (filters.mode === "all"
          ? selected.every((tag) => tags.has(tag))
          : selected.some((tag) => tags.has(tag))))
    );
  });
  return visible.sort((a, b) => {
    const newest = b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
    return filters.sort === "oldest"
      ? -newest
      : filters.sort === "artist"
        ? a.artist_name.localeCompare(b.artist_name) || newest
        : filters.sort === "title"
          ? a.title.localeCompare(b.title) || newest
          : newest;
  });
}
