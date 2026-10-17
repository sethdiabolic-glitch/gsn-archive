import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Share2, Link as LinkIcon, ExternalLink } from "lucide-react";
import { imageDownloadName, imageShareUrl, type ImageView } from "./lib/image-viewer";

export function ImageViewer({ image }: { image: ImageView }) {
  const [accepted, setAccepted] = useState(!image.mature);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copyValue, setCopyValue] = useState("");
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (ref.current?.complete) {
      setLoaded(ref.current.naturalWidth > 0);
      setFailed(ref.current.naturalWidth === 0);
    }
  }, [image.src, accepted]);
  const copyLink = async () => {
    const url = imageShareUrl(window.location.href);
    try {
      await navigator.clipboard.writeText(url);
      setCopyValue("");
      setMessage("Image page link copied.");
    } catch {
      setCopyValue(url);
      setMessage("Clipboard access is unavailable. Select and copy this link:");
    }
  };
  const share = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: image.title,
        text: image.credit ? `${image.title} — by ${image.credit}` : image.title,
        url: imageShareUrl(window.location.href),
      });
      setMessage("Share completed.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessage("Sharing cancelled.");
        return;
      }
      await copyLink();
    }
  };
  const download = async () => {
    setBusy(true);
    setMessage("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(image.src, {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error("The image host did not allow this download.");
      const type = response.headers.get("content-type") || "";
      if (!type.toLowerCase().startsWith("image/"))
        throw new Error("The host did not return an image file.");
      if (Number(response.headers.get("content-length")) > 50 * 1024 * 1024)
        throw new Error("This image is too large for direct download.");
      const blob = await response.blob();
      if (blob.size > 50 * 1024 * 1024)
        throw new Error("This image is too large for direct download.");
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = imageDownloadName(image.src, image.title, type);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage("Download started. Please respect the artist’s usage rights.");
    } catch {
      setMessage(
        "Direct download is unavailable for this host or image. Use “Open original”, then your browser’s Save image option.",
      );
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
    }
  };

  return (
    <main className="image-view-page">
      <header className="image-view-header">
        <a className="back-link" href={image.back}>
          <ArrowLeft size={16} /> Back to archive
        </a>
        <a href="/" className="image-view-brand">
          GSN <span>ARENA</span>
        </a>
      </header>
      <section className="image-view-main">
        <div className="eyebrow">Archive / image viewer</div>
        <h1>{image.title || "Archive image"}</h1>
        {image.credit && <p className="image-credit">By {image.credit}</p>}
        {!image.src ? (
          <div className="notice-box" role="alert">
            This image link is missing or invalid. Return to the archive and open the image again.
          </div>
        ) : !accepted ? (
          <div className="notice-box">
            <h2>Mature artwork</h2>
            <p>
              This shared image is marked as mature. Continue only if you want to view adult/NSFW
              artwork.
            </p>
            <button className="btn primary" onClick={() => setAccepted(true)}>
              View mature image
            </button>
          </div>
        ) : (
          <>
            <div className="image-view-stage">
              {!loaded && !failed && (
                <p className="image-load-message" role="status">
                  Loading image…
                </p>
              )}
              {failed && (
                <p className="image-load-message" role="alert">
                  This image could not be loaded. It may have been removed or its link may have
                  expired.
                </p>
              )}
              <img
                ref={ref}
                src={image.src}
                alt={image.title || "Archive image"}
                referrerPolicy="no-referrer"
                onLoad={() => {
                  setLoaded(true);
                  setFailed(false);
                }}
                onError={() => {
                  setLoaded(false);
                  setFailed(true);
                }}
              />
            </div>
            <div className="image-view-actions" aria-label="Image actions">
              <button
                className="btn primary"
                disabled={busy || failed || !loaded}
                onClick={download}
              >
                <Download size={17} />
                {busy ? "Downloading…" : "Download"}
              </button>
              <button className="btn" onClick={share}>
                <Share2 size={17} />
                Share
              </button>
              <button className="btn" onClick={copyLink}>
                <LinkIcon size={17} />
                Copy link
              </button>
              <a className="btn ghost" href={image.src} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} />
                Open original
              </a>
            </div>
            {message && (
              <p className="image-action-status" role="status">
                {message}
              </p>
            )}
            {copyValue && (
              <input
                className="text-input image-copy-field"
                aria-label="Image page link"
                readOnly
                value={copyValue}
                onFocus={(event) => event.target.select()}
              />
            )}
            <p className="image-rights-note">
              Artwork belongs to its respective creator. Download and sharing controls do not grant
              permission to reuse it.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
