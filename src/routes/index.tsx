import { useCallback, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkles,
  Film,
  Image as ImageIcon,
  Wand2,
  Eraser,
  Database,
  History,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReferenceUploader } from "@/components/studio/ReferenceUploader";
import { JobCard } from "@/components/studio/JobCard";
import { useStudioQueue } from "@/lib/studio/useStudioQueue";
import {
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  IMAGE_MODELS,
  VIDEO_MODELS,
  ASPECT_TO_SIZE,
  type ExportTarget,
  type ImageSettings,
  type ReferenceImage,
  type VideoSettings,
} from "@/lib/studio/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora Studio — Xưởng tạo ảnh & video AI" },
      {
        name: "description",
        content:
          "Tạo ảnh GPT Image (xuất 2K/4K) và video Veo 3.1 với hàng chờ prompt, ảnh tham chiếu gắn tag và lịch sử lưu tự động trong database local.",
      },
      { property: "og:title", content: "Aurora Studio — Xưởng tạo ảnh & video AI" },
      {
        property: "og:description",
        content:
          "Hàng chờ prompt, ảnh tham chiếu gắn tag, xuất ảnh 2K/4K, lịch sử lưu local — tải lại trang không mất.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-input bg-background/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.value
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StudioPage() {
  const { jobs, enqueue, cancel, remove, retry, clearFinished } = useStudioQueue();

  const [mode, setMode] = useState<"image" | "video">("image");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [imageRefs, setImageRefs] = useState<ReferenceImage[]>([]);
  const [videoRefs, setVideoRefs] = useState<ReferenceImage[]>([]);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [videoSettings, setVideoSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS);

  const imageTextarea = useRef<HTMLTextAreaElement>(null);
  const videoTextarea = useRef<HTMLTextAreaElement>(null);

  const insertTag = useCallback((target: "image" | "video", tag: string) => {
    const setter = target === "image" ? setImagePrompt : setVideoPrompt;
    setter((prev) => (prev.endsWith(" ") || prev === "" ? `${prev}${tag} ` : `${prev} ${tag} `));
    (target === "image" ? imageTextarea : videoTextarea).current?.focus();
  }, []);

  const stats = useMemo(
    () => ({
      queued: jobs.filter((j) => j.status === "queued").length,
      running: jobs.filter((j) => j.status === "running").length,
      done: jobs.filter((j) => j.status === "succeeded").length,
    }),
    [jobs],
  );

  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === "queued" || j.status === "running"),
    [jobs],
  );
  const historyJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status !== "queued" &&
          j.status !== "running" &&
          (filter === "all" || j.kind === filter),
      ),
    [jobs, filter],
  );
  const hasFinished = jobs.length > activeJobs.length;

  function buildPromptWithTags(prompt: string, refs: ReferenceImage[]) {
    const used = refs.filter((r) => prompt.includes(r.tag));
    if (used.length === 0) return prompt;
    const legend = used.map((r, i) => `${r.tag} = ảnh tham chiếu #${i + 1} (${r.name})`).join("; ");
    return `${prompt}\n\nReference legend: ${legend}.`;
  }

  function submitImage() {
    if (!imagePrompt.trim()) {
      toast.error("Hãy nhập prompt cho ảnh");
      return;
    }
    enqueue({
      kind: "image",
      prompt: buildPromptWithTags(imagePrompt.trim(), imageRefs),
      references: imageRefs,
      imageSettings,
    });
    toast.success("Đã thêm vào hàng chờ");
  }

  function submitVideo() {
    if (!videoPrompt.trim()) {
      toast.error("Hãy nhập prompt cho video");
      return;
    }
    enqueue({
      kind: "video",
      prompt: buildPromptWithTags(videoPrompt.trim(), videoRefs),
      references: videoRefs,
      videoSettings,
    });
    toast.success("Đã thêm vào hàng chờ");
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-lg font-semibold leading-tight">Aurora Studio</h1>
              <p className="text-xs text-muted-foreground">GPT Image · Veo 3.1 · hàng chờ prompt</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="outline" className="gap-1.5">
              <History className="size-3" /> Chờ: {stats.queued}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Loader2 className={`size-3 ${stats.running > 0 ? "animate-spin" : ""}`} /> Chạy:{" "}
              {stats.running}
            </Badge>
            <Badge variant="secondary">Xong: {stats.done}</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4 py-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">
              AI Generation Studio
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              Xưởng sáng tạo <span className="text-gradient">Aurora</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Xếp hàng nhiều prompt, gắn ảnh tham chiếu bằng tag, xuất ảnh 2K/4K và dựng video Veo —
              tất cả trong một bàn làm việc.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs text-muted-foreground">
            <Database className="size-3.5 text-primary" />
            Lưu tự động vào database local — F5 không mất lịch sử
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section className="surface-panel rounded-3xl p-5 sm:p-6 lg:sticky lg:top-24">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "image" | "video")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="image" className="gap-2">
                  <ImageIcon className="size-4" /> Tạo ảnh
                </TabsTrigger>
                <TabsTrigger value="video" className="gap-2">
                  <Film className="size-4" /> Tạo video
                </TabsTrigger>
              </TabsList>

              <TabsContent value="image" className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="image-prompt" className="font-display text-base">
                    Prompt ảnh
                  </Label>
                  <Textarea
                    id="image-prompt"
                    ref={imageTextarea}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Ví dụ: studio portrait của một phi hành gia, ánh sáng viền cam, nền tối, chi tiết cao…"
                    className="min-h-36 resize-y text-base"
                  />
                </div>

                <ReferenceUploader
                  references={imageRefs}
                  onChange={setImageRefs}
                  onInsertTag={(tag) => insertTag("image", tag)}
                  hint="Với GPT Image, ảnh tham chiếu sẽ dùng chế độ chỉnh sửa/biến thể. Nhấp tag để chèn vào prompt."
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Model">
                    <Select
                      value={imageSettings.model}
                      onValueChange={(model) => setImageSettings((s) => ({ ...s, model }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMAGE_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Tỷ lệ khung hình">
                    <Select
                      value={imageSettings.aspect}
                      onValueChange={(aspect) =>
                        setImageSettings((s) => ({ ...s, aspect: aspect as ImageSettings["aspect"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 — ngang (mặc định)</SelectItem>
                        <SelectItem value="1:1">1:1 — vuông</SelectItem>
                        <SelectItem value="9:16">9:16 — dọc</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Chất lượng render">
                    <Select
                      value={imageSettings.quality}
                      onValueChange={(quality) =>
                        setImageSettings((s) => ({ ...s, quality: quality as ImageSettings["quality"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High — sắc nét nhất</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low — nhanh, rẻ</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label={`Xuất bản · gốc ${ASPECT_TO_SIZE[imageSettings.aspect]}`}>
                    <Segmented<ExportTarget>
                      value={imageSettings.exportRes}
                      onChange={(exportRes) => setImageSettings((s) => ({ ...s, exportRes }))}
                      options={[
                        { value: "original", label: "Gốc" },
                        { value: "2k", label: "2K" },
                        { value: "4k", label: "4K" },
                      ]}
                    />
                  </Field>
                </div>

                <p className="text-xs text-muted-foreground">
                  2K (2560px) và 4K (3840px) được upscale sắc nét ngay trên trình duyệt khi tải xuống.
                </p>

                <Button size="lg" className="w-full" onClick={submitImage}>
                  <Wand2 className="size-4" /> Thêm job tạo ảnh vào hàng chờ
                </Button>
              </TabsContent>

              <TabsContent value="video" className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="video-prompt" className="font-display text-base">
                    Prompt video
                  </Label>
                  <Textarea
                    id="video-prompt"
                    ref={videoTextarea}
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Ví dụ: camera dolly chậm quanh @ref_1, sương mù cuộn nhẹ, ánh sáng hoàng hôn…"
                    className="min-h-36 resize-y text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Prompt tiếng Anh cho kết quả tốt nhất. Lời thoại viết dạng “Anna says: ...”, không
                    dùng dấu ngoặc kép.
                  </p>
                </div>

                <ReferenceUploader
                  references={videoRefs}
                  onChange={setVideoRefs}
                  onInsertTag={(tag) => insertTag("video", tag)}
                  hint="Ảnh đầu tiên được dùng làm khung hình mở đầu; các tag được gắn kèm vào prompt để mô tả."
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Model">
                    <Select
                      value={videoSettings.model}
                      onValueChange={(model) => setVideoSettings((s) => ({ ...s, model }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Tỷ lệ khung hình">
                    <Select
                      value={videoSettings.aspect}
                      onValueChange={(aspect) =>
                        setVideoSettings((s) => ({ ...s, aspect: aspect as VideoSettings["aspect"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 — ngang (mặc định)</SelectItem>
                        <SelectItem value="9:16">9:16 — dọc</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Độ phân giải">
                    <Select
                      value={videoSettings.resolution}
                      onValueChange={(resolution) =>
                        setVideoSettings((s) => ({
                          ...s,
                          resolution: resolution as VideoSettings["resolution"],
                          durationSeconds: resolution === "720p" ? s.durationSeconds : 8,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="1080p">1080p (mặc định)</SelectItem>
                        <SelectItem value="4k">4K — chỉ Veo 3.1 / 3.1 Fast</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Thời lượng">
                    <Select
                      value={String(videoSettings.durationSeconds)}
                      onValueChange={(d) =>
                        setVideoSettings((s) => ({
                          ...s,
                          durationSeconds: Number(d) as VideoSettings["durationSeconds"],
                        }))
                      }
                      disabled={videoSettings.resolution !== "720p"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 giây</SelectItem>
                        <SelectItem value="6">6 giây</SelectItem>
                        <SelectItem value="8">8 giây</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Negative prompt">
                    <Input
                      value={videoSettings.negativePrompt}
                      onChange={(e) =>
                        setVideoSettings((s) => ({ ...s, negativePrompt: e.target.value }))
                      }
                      placeholder="text overlays, blur, extra fingers"
                    />
                  </Field>

                  <Field label="Seed (tuỳ chọn)">
                    <Input
                      value={videoSettings.seed}
                      inputMode="numeric"
                      onChange={(e) =>
                        setVideoSettings((s) => ({ ...s, seed: e.target.value.replace(/\D/g, "") }))
                      }
                      placeholder="Để trống = ngẫu nhiên"
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Âm thanh</p>
                    <p className="text-xs text-muted-foreground">
                      Sinh nhạc nền và tiếng động cùng video
                    </p>
                  </div>
                  <Switch
                    checked={videoSettings.generateAudio}
                    onCheckedChange={(generateAudio) =>
                      setVideoSettings((s) => ({ ...s, generateAudio }))
                    }
                  />
                </div>

                <Button size="lg" className="w-full" onClick={submitVideo}>
                  <Wand2 className="size-4" /> Thêm job tạo video vào hàng chờ
                </Button>
              </TabsContent>
            </Tabs>
          </section>

          <aside className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                <History className="size-4 text-primary" /> Hàng chờ &amp; kết quả
              </h2>
              <div className="flex items-center gap-2">
                <Segmented<"all" | "image" | "video">
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "Tất cả" },
                    { value: "image", label: "Ảnh" },
                    { value: "video", label: "Video" },
                  ]}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFinished}
                  disabled={!hasFinished}
                  aria-label="Dọn các job đã xong"
                >
                  <Eraser className="size-4" /> Dọn
                </Button>
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="surface-panel grid place-items-center rounded-3xl p-12 text-center">
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
                    <Wand2 className="size-6" />
                  </span>
                  <p className="mt-4 font-display text-base font-medium">Chưa có job nào</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Nhập prompt và thêm vào hàng chờ — các job chạy tuần tự để đảm bảo độ ổn định, kết
                    quả được lưu lại trên thiết bị này.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {activeJobs.length > 0 && (
                  <div className="space-y-4">
                    {activeJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onRetry={retry}
                        onCancel={cancel}
                        onRemove={remove}
                      />
                    ))}
                  </div>
                )}

                {historyJobs.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {historyJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onRetry={retry}
                        onCancel={cancel}
                        onRemove={remove}
                      />
                    ))}
                  </div>
                ) : (
                  activeJobs.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Chưa có kết quả nào khớp bộ lọc — các job đang chạy sẽ xuất hiện tại đây.
                    </p>
                  )
                )}
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
