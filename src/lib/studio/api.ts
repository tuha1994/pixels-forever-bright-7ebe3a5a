import { createParser } from "eventsource-parser";
import type { ImageSettings, ReferenceImage, VideoSettings } from "./types";
import { ASPECT_TO_SIZE } from "./types";

type ImagePayload = {
  type?: string;
  b64_json?: string;
  error?: { message?: string };
};

export async function generateImage(
  prompt: string,
  settings: ImageSettings,
  references: ReferenceImage[],
  onFrame: (dataUrl: string, isFinal: boolean) => void,
  signal: AbortSignal,
): Promise<void> {
  const payload = {
    prompt,
    model: settings.model,
    size: ASPECT_TO_SIZE[settings.aspect],
    quality: settings.quality,
    references: references.map((r) => ({ data: r.data, mimeType: r.mimeType, name: r.name })),
  };

  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Tạo ảnh thất bại (${res.status}): ${await res.text().catch(() => "")}`);
  }

  let sawAny = false;
  let sawCompleted = false;
  let streamError: string | undefined;

  const parser = createParser({
    onEvent(event) {
      let data: ImagePayload | undefined;
      try {
        data = JSON.parse(event.data) as ImagePayload;
      } catch {
        return;
      }
      if (event.event === "error" || data?.type === "error") {
        sawAny = true;
        streamError = data?.error?.message ?? "Tạo ảnh thất bại";
        return;
      }
      const names = [
        "image_generation.partial_image",
        "image_generation.completed",
        "image_edit.partial_image",
        "image_edit.completed",
      ];
      if (!names.includes(event.event ?? "") || !data?.b64_json) return;
      sawAny = true;
      const isFinal = (event.event ?? "").endsWith(".completed");
      onFrame(`data:image/png;base64,${data.b64_json}`, isFinal);
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);

  if (!sawAny) {
    const replay = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, stream: false }),
      signal,
    });
    if (!replay.ok) {
      throw new Error(`Tạo ảnh thất bại (${replay.status}): ${await replay.text().catch(() => "")}`);
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("Không nhận được ảnh từ mô hình");
    onFrame(`data:image/png;base64,${b64}`, true);
    return;
  }
  if (!sawCompleted) throw new Error("Luồng ảnh kết thúc trước khi hoàn tất");
}

type VideoJob = {
  id?: string;
  status?: string;
  progress?: number;
  error?: { code?: string; message?: string };
  message?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateVideo(
  prompt: string,
  settings: VideoSettings,
  references: ReferenceImage[],
  onProgress: (progress: number, message: string) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const first = references[0];
  const createRes = await fetch("/api/video/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      model: settings.model,
      durationSeconds: settings.durationSeconds,
      resolution: settings.resolution,
      aspectRatio: settings.aspect,
      generateAudio: settings.generateAudio,
      negativePrompt: settings.negativePrompt,
      seed: settings.seed ? Number(settings.seed) : undefined,
      image: first ? { data: first.data, mimeType: first.mimeType } : null,
    }),
    signal,
  });

  const created = (await createRes.json().catch(() => ({}))) as VideoJob;
  if (!createRes.ok || !created.id) {
    throw new Error(created.message ?? created.error?.message ?? `Tạo video thất bại (${createRes.status})`);
  }

  onProgress(5, "Đã gửi job tới Veo…");

  for (let i = 0; i < 200; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await sleep(6000);
    const statusRes = await fetch(`/api/video/status?id=${created.id}`, { signal });
    const job = (await statusRes.json().catch(() => ({}))) as VideoJob;
    if (job.status === "failed") {
      throw new Error(job.error?.message ?? "Veo báo lỗi khi dựng video");
    }
    if (job.status === "completed") {
      onProgress(92, "Đang tải video về…");
      const contentRes = await fetch(`/api/video/content?id=${created.id}`, { signal });
      if (!contentRes.ok) throw new Error("Không tải được video đã tạo");
      return await contentRes.blob();
    }
    onProgress(Math.min(88, 8 + (job.progress ?? i * 4)), "Đang dựng video…");
  }
  throw new Error("Hết thời gian chờ video");
}
