import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  cropGeometry,
  portraitFileError,
  exportPortrait,
  CROP_SIZE,
  type CropPan,
} from "./lib/portrait-crop";

export function CropImageButton({
  onCropped,
  disabled = false,
  label = "Change profile picture",
  outputSize = 512,
}: {
  onCropped: (file: File) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  outputSize?: 512 | 1024;
}) {
  const input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState("");
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="btn ghost"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {label}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled}
        aria-label={`Choose image for ${label}`}
        onChange={(e) => {
          const next = e.target.files?.[0];
          e.target.value = "";
          if (!next) return;
          const invalid = portraitFileError(next);
          setError(invalid);
          if (!invalid) setFile(next);
        }}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {file && (
        <PortraitCropper
          file={file}
          outputSize={outputSize}
          onApply={onCropped}
          onClose={() => setFile(null)}
          restoreFocus={() => trigger.current?.focus()}
        />
      )}
    </>
  );
}
function PortraitCropper({
  file,
  outputSize,
  onApply,
  onClose,
  restoreFocus,
}: {
  file: File;
  outputSize: 512 | 1024;
  onApply: (file: File) => void | Promise<void>;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const [url, setUrl] = useState(""),
    [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState<CropPan>({ x: 0, y: 0 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const image = useRef<HTMLImageElement>(null),
    drag = useRef<{ id: number; x: number; y: number; pan: CropPan } | null>(null);
  useEffect(() => {
    const source = URL.createObjectURL(file);
    setUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [file]);
  const geometry = dimensions ? cropGeometry(dimensions.width, dimensions.height, zoom, pan) : null;
  const imageStyle: CSSProperties = geometry
    ? {
        width: `${(geometry.drawnWidth / CROP_SIZE) * 100}%`,
        height: `${(geometry.drawnHeight / CROP_SIZE) * 100}%`,
        left: `${(geometry.left / CROP_SIZE) * 100}%`,
        top: `${(geometry.top / CROP_SIZE) * 100}%`,
      }
    : {};
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="crop-overlay" />
        <Dialog.Content
          className="crop-dialog"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            restoreFocus();
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <Dialog.Title>Position your portrait</Dialog.Title>
          <Dialog.Description>
            Drag the image under the circle. Adjust zoom, or focus the image and use arrow keys.
            Hold Shift for larger steps. Nothing is saved until you apply.
          </Dialog.Description>
          <div className="crop-layout">
            <div
              className="crop-stage"
              role="group"
              aria-label="Portrait position: drag or use arrow keys"
              tabIndex={0}
              onPointerDown={(e) => {
                if (!geometry || busy) return;
                e.preventDefault();
                e.currentTarget.focus();
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: geometry.pan };
              }}
              onPointerMove={(e) => {
                const start = drag.current;
                if (!start || start.id !== e.pointerId || busy || !dimensions) return;
                const ratio = CROP_SIZE / e.currentTarget.getBoundingClientRect().width;
                setPan(
                  cropGeometry(dimensions.width, dimensions.height, zoom, {
                    x: start.pan.x + (e.clientX - start.x) * ratio,
                    y: start.pan.y + (e.clientY - start.y) * ratio,
                  }).pan,
                );
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
              onKeyDown={(e) => {
                const directions: Record<string, CropPan> = {
                  ArrowLeft: { x: -1, y: 0 },
                  ArrowRight: { x: 1, y: 0 },
                  ArrowUp: { x: 0, y: -1 },
                  ArrowDown: { x: 0, y: 1 },
                };
                const direction = directions[e.key];
                if (!direction || !geometry || !dimensions || busy) return;
                e.preventDefault();
                const step = e.shiftKey ? 16 : 4;
                setPan(
                  cropGeometry(dimensions.width, dimensions.height, zoom, {
                    x: geometry.pan.x + direction.x * step,
                    y: geometry.pan.y + direction.y * step,
                  }).pan,
                );
              }}
            >
              {url && (
                <img
                  ref={image}
                  src={url}
                  alt="Image to position"
                  draggable={false}
                  style={imageStyle}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth * img.naturalHeight > 40_000_000) {
                      setError("Please choose an image smaller than 40 megapixels.");
                      return;
                    }
                    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                  }}
                  onError={() =>
                    setError("This image could not be opened. Please choose another file.")
                  }
                />
              )}
              <div className="crop-circle" aria-hidden="true" />
            </div>
            <div className="crop-preview-wrap">
              <span>Preview</span>
              <div className="crop-preview">
                {geometry && (
                  <img
                    src={url}
                    alt="Cropped portrait preview"
                    style={imageStyle}
                    draggable={false}
                  />
                )}
              </div>
            </div>
          </div>
          <label className="crop-zoom">
            Zoom · {Math.round(zoom * 100)}%
            <input
              type="range"
              aria-label="Portrait zoom"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              disabled={!dimensions || busy}
              onChange={(e) => {
                const value = Number(e.target.value);
                setZoom(value);
                if (dimensions)
                  setPan(
                    cropGeometry(dimensions.width, dimensions.height, value, geometry?.pan || pan)
                      .pan,
                  );
              }}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="row-actions">
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset position
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!dimensions || busy}
              onClick={async () => {
                if (!image.current) return;
                setBusy(true);
                setError("");
                try {
                  await onApply(
                    await exportPortrait(image.current, zoom, geometry?.pan || pan, outputSize),
                  );
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not save this crop. Try again.");
                  setBusy(false);
                }
              }}
            >
              {busy ? "Applying…" : "Apply crop"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
