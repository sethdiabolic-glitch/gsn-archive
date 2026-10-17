const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");
const g = load("src/lib/gallery.ts");
const arts = [
  {
    id: "a",
    title: "Beach",
    artist_name: "Zed",
    rating: "sfw",
    tags: ["#Anis", "Summer"],
    created_at: "2026-10-01",
  },
  {
    id: "b",
    title: "Ark",
    artist_name: "Amy",
    rating: "sfw",
    tags: ["anis"],
    created_at: "2026-10-02",
  },
  {
    id: "c",
    title: "Winter",
    artist_name: "Amy",
    rating: "sfw",
    tags: ["Winter"],
    created_at: "2026-10-03",
  },
  {
    id: "d",
    title: "Mature",
    artist_name: "Amy",
    rating: "nsfw",
    tags: ["Anis", "Summer"],
    created_at: "2026-10-04",
  },
];
const defaults = g.defaultGalleryFilters;
test("tag suggestions rank exact, starts-with then contains, without requiring #", () => {
  assert.equal(
    g.tagSuggestions(["Fan Anis", "Anis Summer", "ANIS", "#anis", "Rapi"], "anis").join("|"),
    "ANIS|Anis Summer|Fan Anis",
  );
  assert.equal(
    g.tagSuggestions(["Anis", "Anis Summer"], "#Anis", ["anis"]).join("|"),
    "Anis Summer",
  );
  assert.equal(g.uniqueTags(["#Anis", "anis", "  Summer  ", "#summer"]).join("|"), "Anis|Summer");
});
test("all/any filtering respects normalized tags, rating and artist together", () => {
  assert.equal(
    g
      .filterArtworks(arts, { ...defaults, tags: ["anis", "#summer"] })
      .map((a) => a.id)
      .join(),
    "a",
  );
  assert.equal(
    g
      .filterArtworks(arts, { ...defaults, mode: "any", tags: ["Anis", "Winter"] })
      .map((a) => a.id)
      .join(),
    "c,b,a",
  );
  assert.equal(
    g
      .filterArtworks(arts, { ...defaults, tags: ["anis"], artist: "Amy" })
      .map((a) => a.id)
      .join(),
    "b",
  );
  assert.equal(g.filterArtworks(arts, { ...defaults, tags: ["missing"] }).length, 0);
});
test("sorting is applied after filtering, never mutates input", () => {
  assert.equal(
    g
      .filterArtworks(arts, { ...defaults, sort: "oldest" })
      .map((a) => a.id)
      .join(),
    "a,b,c",
  );
  assert.equal(
    g
      .filterArtworks(arts, { ...defaults, sort: "title" })
      .map((a) => a.title)
      .join(),
    "Ark,Beach,Winter",
  );
  assert.equal(
    g
      .filterArtworks(arts, { ...defaults, sort: "artist" })
      .map((a) => a.id)
      .join(),
    "c,b,a",
  );
  assert.equal(arts.map((a) => a.id).join(), "a,b,c,d");
});
test("gallery URL roundtrips all filters and tolerates invalid sort/match values", () => {
  const filters = {
    tags: ["Anis", "Summer & Sea"],
    sort: "title",
    mode: "any",
    rating: "nsfw",
    artist: "A + B",
  };
  const recovered = g.readGalleryFilters(g.gallerySearch(filters));
  for (const key of Object.keys(filters))
    assert.equal(JSON.stringify(recovered[key]), JSON.stringify(filters[key]));
  assert.equal(g.readGalleryFilters("?sort=bad&match=bad&rating=bad").sort, "newest");
  assert.equal(g.readGalleryFilters("?tag=Anis&tag=%23anis").tags.length, 1);
});
