import { createFileRoute } from "@tanstack/react-router";

type Body = {
  prompt: string;
  model?: string;
  durationSeconds?: number;
  resolution?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  negativePrompt?: string;
  seed?: number;
  image?: { data: string; mimeType: string } | null;
};

export const Route = createFileRoute("/api/video/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const {
          prompt,
          model = "google/veo-3.1-fast",
          durationSeconds = 8,
          resolution = "1080p",
          aspectRatio = "16:9",
          generateAudio = true,
          negativePrompt,
          seed,
          image,
        } = (await request.json()) as Body;

        if (!prompt?.trim()) return new Response("Prompt is required", { status: 400 });

        const instance: Record<string, unknown> = { prompt };
        if (image?.data) {
          instance["image"] = {
            bytesBase64Encoded: image.data.replace(/^data:[^,]+,/, ""),
            mimeType: image.mimeType,
          };
        }

        const parameters: Record<string, unknown> = {
          durationSeconds,
          resolution,
          sampleCount: 1,
          generateAudio,
        };
        // Veo derives orientation from an input image and rejects an explicit ratio next to one.
        if (!image?.data) parameters["aspectRatio"] = aspectRatio;
        if (negativePrompt?.trim()) parameters["negativePrompt"] = negativePrompt.trim();
        if (typeof seed === "number" && Number.isFinite(seed)) parameters["seed"] = seed;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/videos", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, instances: [instance], parameters }),
        });

        const text = await res.text();
        return new Response(text, {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
