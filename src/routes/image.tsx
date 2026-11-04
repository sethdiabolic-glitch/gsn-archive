import { createFileRoute } from "@tanstack/react-router";
import { ImageViewer } from "../ImageViewer";
import { imageSearch } from "../lib/image-viewer";

export const Route = createFileRoute("/image")({
  validateSearch: imageSearch,
  head: ({ match }) => ({
    meta: [
      { title: `${match.search.title || "Image viewer"} — GSN Arena` },
      { name: "robots", content: "noindex, follow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ImagePage,
});
function ImagePage() {
  const image = Route.useSearch();
  return image.art ? (
    <main className="image-view-page">
      <h1>Image unavailable</h1>
      <p>This page is no longer available.</p>
      <a href="/">Return to archive</a>
    </main>
  ) : (
    <ImageViewer key={`${image.src}/${image.mature}`} image={image} />
  );
}
