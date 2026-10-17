import { useEffect, useState } from "react";
import { supabase, resolveArtworkImages, type Artwork } from "../lib/community";
import type { ImageView } from "../lib/image-viewer";
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
    <ArtworkImage key={image.art} image={image} />
  ) : (
    <ImageViewer key={`${image.src}/${image.mature}`} image={image} />
  );
}

function ArtworkImage({ image }: { image: ImageView }) {
  const [resolved, setResolved] = useState<ImageView | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let stale = false;
    setResolved(null);
    setError("");
    const load = async () => {
      try {
        if (!supabase) throw new Error("Storage is not connected.");
        const { data, error } = await supabase
          .from("artworks")
          .select("*")
          .eq("id", image.art!)
          .maybeSingle();
        if (error) throw error;
        if (!data)
          throw new Error(
            "This artwork is not public, has been removed, or requires the owner to sign in.",
          );
        const [art] = await resolveArtworkImages([data as Artwork]);
        if (!stale)
          setResolved({
            ...image,
            src: art!.image_url,
            title: art!.title,
            credit: art!.artist_name,
            mature: art!.rating === "nsfw",
          });
      } catch (e) {
        if (!stale) setError(e instanceof Error ? e.message : "Image unavailable.");
      }
    };
    void load();
    return () => {
      stale = true;
    };
  }, [image, version]);
  return resolved ? (
    <>
      <ImageViewer key={resolved.src} image={resolved} />
      <button className="btn ghost" onClick={() => setVersion((v) => v + 1)}>
        Refresh expired image
      </button>
    </>
  ) : (
    <main className="image-view-page">
      <a href={image.back}>Back to archive</a>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button className="btn" onClick={() => setVersion((v) => v + 1)}>
            Retry
          </button>
          <a href="/profile">Sign in via your profile</a>
        </>
      ) : (
        <p role="status">Loading artwork…</p>
      )}
    </main>
  );
}
