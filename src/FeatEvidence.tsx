import { ImageViewerLink } from "./ImageViewerLink";
import { safeHttpUrl, type FeatSource } from "./lib/entry-feats";
export function FeatEvidence({ source }: { source?: FeatSource | undefined }) {
  if (!source) return null;
  const url = safeHttpUrl(source.url);
  const image = safeHttpUrl(source.image);
  if (!source.label && !source.chapter && !url && !image) return null;
  return (
    <details className="feat-evidence">
      <summary>Source / evidence</summary>
      {source.label && <strong>{source.label}</strong>}
      {source.chapter && <p>{source.chapter}</p>}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          View source ↗
        </a>
      )}
      {image && (
        <ImageViewerLink
          src={image}
          title={source.label ? `Evidence: ${source.label}` : "Feat evidence"}
        >
          <img
            src={image}
            alt={source.label ? `Evidence: ${source.label}` : "Feat evidence"}
            loading="lazy"
          />
        </ImageViewerLink>
      )}
    </details>
  );
}
