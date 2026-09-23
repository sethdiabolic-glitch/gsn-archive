import { createFileRoute } from "@tanstack/react-router";
import { GsnArenaApp } from "../GsnArenaApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GSN Arena — Intelligence Archive" },
      { name: "description", content: "GSN Arena is a community-maintained intelligence archive for Nikke dossiers, feats, tier lists, and comparisons." },
      { property: "og:title", content: "GSN Arena — Intelligence Archive" },
      { property: "og:description", content: "Explore community-maintained Nikke dossiers, feats, tier lists, and comparisons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GsnArenaApp,
});
