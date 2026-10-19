export const CROP_SIZE = 320;
export type CropPan = { x: number; y: number };
export function cropGeometry(width: number, height: number, zoom: number, pan: CropPan) {
  if (!(width > 0 && height > 0 && Number.isFinite(width + height + zoom + pan.x + pan.y)))
    throw new Error("Invalid image dimensions.");
  const scale = Math.max(CROP_SIZE / width, CROP_SIZE / height) * Math.max(1, Math.min(3, zoom));
  const drawnWidth = width * scale,
    drawnHeight = height * scale;
  const maxX = (drawnWidth - CROP_SIZE) / 2,
    maxY = (drawnHeight - CROP_SIZE) / 2;
  const x = Math.max(-maxX, Math.min(maxX, pan.x)),
    y = Math.max(-maxY, Math.min(maxY, pan.y));
  return {
    scale,
    drawnWidth,
    drawnHeight,
    pan: { x, y },
    left: (CROP_SIZE - drawnWidth) / 2 + x,
    top: (CROP_SIZE - drawnHeight) / 2 + y,
    sourceX: (maxX - x) / scale,
    sourceY: (maxY - y) / scale,
    sourceSize: CROP_SIZE / scale,
  };
}
export function portraitFileError(file: Pick<File, "type" | "size">) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return "Choose a PNG, JPEG or WebP image.";
  if (file.size > 12 * 1024 * 1024) return "Please choose an image under 12 MB.";
  return "";
}
export async function exportPortrait(
  image: HTMLImageElement,
  zoom: number,
  pan: CropPan,
  outputSize: number,
): Promise<File> {
  const crop = cropGeometry(image.naturalWidth, image.naturalHeight, zoom, pan);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this crop.");
  context.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceSize,
    crop.sourceSize,
    0,
    0,
    outputSize,
    outputSize,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Could not export this crop. Try another image.")),
      "image/webp",
      0.92,
    ),
  );
  if (blob.size > 2 * 1024 * 1024)
    throw new Error("The cropped image is too large. Try a smaller image.");
  return new File([blob], `portrait.${blob.type === "image/webp" ? "webp" : "png"}`, {
    type: blob.type,
  });
}
