import { createFileRoute } from "@tanstack/react-router";

type RefImage = { data: string; mimeType: string; name?: string };

type Body = {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  stream?: boolean;
  references?: RefImage[];
};

function b64ToBytes(b64: string) {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const {
          prompt,
          model = "openai/gpt-image-2",
          size = "1536x1024",
          quality = "high",
          stream = true,
          references = [],
        } = (await request.json()) as Body;

        if (!prompt?.trim()) return new Response("Prompt is required", { status: 400 });

        const isOpenAI = model.startsWith("openai/");
        const hasRefs = references.length > 0;

        let upstream: Response;

        if (isOpenAI && hasRefs) {
          // OpenAI models edit through the multipart /v1/images/edits endpoint.
          const form = new FormData();
          form.append("model", model);
          form.append("prompt", prompt);
          form.append("size", size);
          form.append("quality", quality);
          for (const ref of references) {
            const blob = new Blob([b64ToBytes(ref.data)], { type: ref.mimeType });
            form.append("image[]", blob, ref.name || "reference.png");
          }
          if (stream) {
            form.append("stream", "true");
            form.append("partial_images", "2");
          }
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: form,
          });
        } else {
          let body: Record<string, unknown> = { model };
          if (isOpenAI) {
            body = {
              model,
              prompt,
              size,
              quality,
              n: 1,
              ...(stream ? { stream: true, partial_images: 2 } : {}),
            };
          } else {
            const content: unknown[] = [{ type: "text", text: prompt }];
            for (const ref of references) {
              content.push({
                type: "image_url",
                image_url: { url: `data:${ref.mimeType};base64,${ref.data.replace(/^data:[^,]+,/, "")}` },
              });
            }
            body = {
              model,
              messages: [{ role: "user", content: hasRefs ? content : prompt }],
              modalities: ["image", "text"],
              ...(stream ? { stream: true } : {}),
            };
          }

          upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "Image generation failed");
          return new Response(text, { status: upstream.status });
        }

        if (!stream) {
          return new Response(upstream.body, {
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
