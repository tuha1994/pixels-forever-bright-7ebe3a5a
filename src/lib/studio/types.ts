export type JobKind = "image" | "video";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type ReferenceImage = {
  id: string;
  tag: string;
  name: string;
  mimeType: string;
  /** raw base64 (no data URL prefix) */
  data: string;
  previewUrl: string;
};

export type ImageSettings = {
  model: string;
  aspect: "16:9" | "1:1" | "9:16";
  quality: "low" | "medium" | "high";
  upscale2k: boolean;
};

export type VideoSettings = {
  model: string;
  aspect: "16:9" | "9:16";
  resolution: "720p" | "1080p" | "4k";
  durationSeconds: 4 | 6 | 8;
  generateAudio: boolean;
  negativePrompt: string;
  seed: string;
};

export type Job = {
  id: string;
  kind: JobKind;
  prompt: string;
  createdAt: number;
  status: JobStatus;
  progress: number;
  message?: string;
  error?: string;
  /** data URL (image) or blob URL (video) */
  resultUrl?: string;
  /** blurred preview while streaming */
  previewUrl?: string;
  references: ReferenceImage[];
  imageSettings?: ImageSettings;
  videoSettings?: VideoSettings;
};

export const ASPECT_TO_SIZE: Record<ImageSettings["aspect"], string> = {
  "16:9": "1536x1024",
  "1:1": "1024x1024",
  "9:16": "1024x1536",
};

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  model: "openai/gpt-image-2",
  aspect: "16:9",
  quality: "high",
  upscale2k: true,
};

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  model: "google/veo-3.1-fast",
  aspect: "16:9",
  resolution: "1080p",
  durationSeconds: 8,
  generateAudio: true,
  negativePrompt: "",
  seed: "",
};

export const IMAGE_MODELS = [
  { value: "openai/gpt-image-2", label: "GPT Image 2 — mặc định, chất lượng cao nhất" },
  { value: "openai/gpt-image-1-mini", label: "GPT Image 1 Mini — nhanh & tiết kiệm" },
  { value: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image" },
  { value: "google/gemini-3.1-flash-image", label: "Nano Banana 2 (Flash)" },
];

export const VIDEO_MODELS = [
  { value: "google/veo-3.1-lite", label: "Veo 3.1 Lite — tiết kiệm nhất" },
  { value: "google/veo-3.1-fast", label: "Veo 3.1 Fast — cân bằng (mặc định)" },
  { value: "google/veo-3.1", label: "Veo 3.1 — chất lượng tối đa" },
];
