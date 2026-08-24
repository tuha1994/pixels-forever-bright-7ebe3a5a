import type { ExportTarget } from "./types";

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Cạnh dài mục tiêu cho từng mức xuất bản (2K = 2560px, 4K = 3840px). */
export const EXPORT_TARGET_PX: Record<Exclude<ExportTarget, "original">, number> = {
  "2k": 2560,
  "4k": 3840,
};

/** Upscale a data-URL image so its longest edge reaches `targetLongEdge` px. */
async function upscale(dataUrl: string, targetLongEdge: number): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  if (longEdge >= targetLongEdge) return dataUrl;
  const scale = targetLongEdge / longEdge;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export async function downloadImage(dataUrl: string, filename: string, target: ExportTarget) {
  const url = target === "original" ? dataUrl : await upscale(dataUrl, EXPORT_TARGET_PX[target]);
  triggerDownload(url, filename);
}

export function downloadVideo(objectUrl: string, filename: string) {
  triggerDownload(objectUrl, filename);
}

export function fileToReference(file: File): Promise<{ data: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ data: result.slice(result.indexOf(",") + 1), previewUrl: result });
    };
    reader.onerror = () => reject(new Error("Không đọc được tệp ảnh"));
    reader.readAsDataURL(file);
  });
}
