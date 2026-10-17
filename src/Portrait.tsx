import type { CSSProperties } from "react";
import { ImageViewerLink } from "./ImageViewerLink";

export function Portrait({ src, name, category }: { src: string; name: string; category: string }) {
  return (
    <figure
      className="dossier-profile category-glow"
      style={{ "--profile-glow": `var(--category-${category})` } as CSSProperties}
    >
      <ImageViewerLink
        src={src}
        title={`${name} — portrait`}
        back={`/entry/${category}/${encodeURIComponent(name)}`}
        className="portrait-trigger"
      >
        <img src={src} alt={name} />
      </ImageViewerLink>
      <figcaption className="sr-only">
        Tap to view the full image and download or share it.
      </figcaption>
    </figure>
  );
}
