import { useState, useEffect } from "react";
import { TagSearch } from "./TagSearch";
import {
  defaultGalleryFilters,
  readGalleryFilters,
  gallerySearch,
  uniqueTags,
  filterArtworks,
  type GalleryFilters as Filters,
} from "./lib/gallery";
import type { Artwork } from "./lib/community";

export function useGalleryFilters() {
  const [filters, setFilters] = useState<Filters>(() =>
    readGalleryFilters(typeof window === "undefined" ? "" : window.location.search),
  );
  useEffect(() => {
    const pop = () => setFilters(readGalleryFilters(window.location.search));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const update = (patch: Partial<Filters>) =>
    setFilters((previous) => {
      const next = { ...previous, ...patch };
      const query = gallerySearch(next);
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${query ? "?" + query : ""}${window.location.hash}`,
      );
      return next;
    });
  return { filters, update };
}
export function GalleryFilterBar({
  filters,
  update,
  tags,
  artworks,
  resultCount,
}: {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  tags: string[];
  artworks: Artwork[];
  resultCount: number;
}) {
  const [share, setShare] = useState("");
  const available = uniqueTags([...tags, ...artworks.flatMap((art) => art.tags || [])]);
  const artists = Array.from(new Set(artworks.map((art) => art.artist_name))).sort((a, b) =>
    a.localeCompare(b),
  );
  return (
    <section className="gallery-filter-bar" aria-label="Artwork filters">
      <TagSearch
        tags={available}
        selected={filters.tags}
        onChange={(tags) => update({ tags })}
        count={(tag) =>
          filterArtworks(artworks, { ...filters, tags: [...filters.tags, tag] }).length
        }
      />
      <div className="filter-controls">
        <label>
          Tag matching
          <select
            className="select-input"
            value={filters.mode}
            onChange={(event) => update({ mode: event.target.value as Filters["mode"] })}
          >
            <option value="all">Match all tags</option>
            <option value="any">Match any tag</option>
          </select>
        </label>
        <label>
          Sort
          <select
            className="select-input"
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value as Filters["sort"] })}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="artist">Artist A–Z</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
        <label>
          Artist
          <select
            className="select-input"
            value={filters.artist}
            onChange={(event) => update({ artist: event.target.value })}
          >
            <option value="">All artists</option>
            {artists.map((artist) => (
              <option key={artist}>{artist}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-footer">
        <span role="status">
          {resultCount} artwork{resultCount === 1 ? "" : "s"} found
        </span>
        <div className="row-actions">
          <button
            className="btn ghost"
            type="button"
            onClick={() => update({ ...defaultGalleryFilters, rating: filters.rating })}
          >
            Clear filters
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setShare("Gallery link copied.");
              } catch {
                setShare(`Copy this link: ${window.location.href}`);
              }
            }}
          >
            Share this view
          </button>
        </div>
      </div>
      {share && (
        <p className="note-guide" role="status">
          {share}
        </p>
      )}
    </section>
  );
}
