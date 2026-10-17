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

export function pageMeta(path: string) {
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
  const title = `${name} — GSN Arena`;
  const canonical = `https://gsn-archive.lovable.app${path === "/" ? "/" : "/" + segments.join("/")}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: canonical },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://gsn-archive.lovable.app/gsn-logo.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: "https://gsn-archive.lovable.app/gsn-logo.png" },
      ...(["editor", "community-editor"].includes(section)
        ? [{ name: "robots", content: "noindex, nofollow" }]
        : []),
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}
