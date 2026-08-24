import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/video/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const id = new URL(request.url).searchParams.get("id");
        if (!id) return new Response("Missing id", { status: 400 });

        const res = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${id}`, {
          headers: { Authorization: `Bearer ${key}` },
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
