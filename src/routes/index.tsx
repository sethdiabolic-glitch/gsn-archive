import { pageMeta } from '../lib/page-meta';
import { createFileRoute } from "@tanstack/react-router";
import { GsnArenaApp } from "../GsnArenaApp";

export const Route = createFileRoute("/")({
  head: () => pageMeta('/'),
  component: GsnArenaApp,
});
