import { SITE_URL, isPublicCategory, type PublicArchive } from "./public-archive";
import { plainEntryText } from "./entry-content";
const labels: Record<string, string> = {
  characters: "Characters",
  heretics: "Heretics",
  raptures: "Raptures",
  infra: "Structures",
  weapons: "Weapons",
  theories: "Theories",
  appendix: "Appendix",
  "tier-list": "Tier List",
  compare: "Compare Units",
  community: "Community Art",
  terms: "Terms of Use",
  editor: "Database Editor",
  "community-editor": "Art Moderation",
};

export function pageMeta(path: string, archive?: PublicArchive | null) {
  const segments = path.split("/").filter(Boolean);
  const section = segments[0] || "";
  let name = labels[section] || "Intelligence Archive";
  let description =
    "Explore GSN Arena’s NIKKE dossiers, feats, tier rankings, theories, and community artwork.";
  if (section === "entry" && segments[2]) {
    try {
      name = decodeURIComponent(segments.slice(2).join("/"));
    } catch {
      name = "Dossier";
    }
    description = `Read the ${name} dossier in GSN Arena’s GODDESS OF VICTORY: NIKKE intelligence archive.`;
  } else if (labels[section]) {
    description = `Explore ${name.toLowerCase()} in GSN Arena’s GODDESS OF VICTORY: NIKKE intelligence archive.`;
  }
  let missing = false;
  let image = `${SITE_URL}/gsn-logo.png`;
  if (section === "entry" && archive) {
    const category = segments[1] || "";
    const entry = isPublicCategory(category)
      ? archive[category]?.find((row) => row["name"] === name)
      : undefined;
    missing = !entry;
    if (entry) {
      if (typeof entry["summary"] === "string")
        description = plainEntryText(entry["summary"]).slice(0, 180) || description;
      if (typeof entry["image"] === "string" && /^https?:\/\//i.test(entry["image"]))
        image = entry["image"];
    }
  }
  const noindex =
    archive === null ||
    missing ||
    ["editor", "community-editor"].includes(section) ||
    (!!section && !labels[section] && section !== "entry");
  const title = `${name} — GSN Arena`;
  const canonical = `${SITE_URL}${path === "/" ? "/" : "/" + segments.join("/")}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: canonical },
      { property: "og:type", content: "website" },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}
