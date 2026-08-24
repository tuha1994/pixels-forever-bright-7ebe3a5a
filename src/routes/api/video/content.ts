import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/video/content")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const id = new URL(request.url).searchParams.get("id");
        if (!id) return new Response("Missing id", { status: 400 });

        const res = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${id}/content`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok || !res.body) {
          return new Response(await res.text().catch(() => "Download failed"), {
            status: res.status,
          });
        }
        return new Response(res.body, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `inline; filename="${id}.mp4"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
