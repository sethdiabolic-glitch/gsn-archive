import { loadPublicArchivePage } from "../lib/archive-loader";
import { pageMeta } from "../lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { GsnArenaApp } from "../GsnArenaApp";

export const Route = createFileRoute("/")({
  loader: () => loadPublicArchivePage(),
  head: ({ loaderData }) => pageMeta("/", loaderData),
  component: ArchiveRoute,
});

function ArchiveRoute() {
  const initialArchive = Route.useLoaderData();
  return <GsnArenaApp initialArchive={initialArchive} />;
}
