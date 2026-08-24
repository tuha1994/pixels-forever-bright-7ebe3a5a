import { Download, RotateCcw, Trash2, X, Loader2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { downloadImage, downloadVideo } from "@/lib/studio/download";
import type { Job } from "@/lib/studio/types";

const statusMeta: Record<Job["status"], { label: string; className: string }> = {
  queued: { label: "Trong hàng chờ", className: "text-muted-foreground" },
  running: { label: "Đang xử lý", className: "text-primary" },
  succeeded: { label: "Hoàn tất", className: "text-success" },
  failed: { label: "Thất bại", className: "text-destructive" },
  canceled: { label: "Đã huỷ", className: "text-muted-foreground" },
};

function StatusIcon({ status }: { status: Job["status"] }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin" />;
  if (status === "succeeded") return <CheckCircle2 className="size-4" />;
  if (status === "failed") return <AlertTriangle className="size-4" />;
  return <Clock className="size-4" />;
}

type Props = {
  job: Job;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
};

export function JobCard({ job, onRetry, onCancel, onRemove }: Props) {
  const meta = statusMeta[job.status];
  const active = job.status === "queued" || job.status === "running";
  const media = job.resultUrl ?? job.previewUrl;
  const settingLine =
    job.kind === "image"
      ? `${job.imageSettings?.model.split("/")[1]} · ${job.imageSettings?.aspect} · ${job.imageSettings?.quality}${job.imageSettings?.upscale2k ? " · 2K" : ""}`
      : `${job.videoSettings?.model.split("/")[1]} · ${job.videoSettings?.aspect} · ${job.videoSettings?.resolution} · ${job.videoSettings?.durationSeconds}s`;

  return (
    <article className="surface-panel overflow-hidden rounded-2xl">
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant={job.kind === "image" ? "secondary" : "outline"} className="uppercase">
              {job.kind === "image" ? "Ảnh" : "Video"}
            </Badge>
            <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.className}`}>
              <StatusIcon status={job.status} />
              {job.message ?? meta.label}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-foreground">{job.prompt}</p>
          <p className="mt-1 text-xs text-muted-foreground">{settingLine}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {active ? (
            <Button variant="ghost" size="icon" onClick={() => onCancel(job.id)} aria-label="Huỷ job">
              <X className="size-4" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={() => onRetry(job.id)} aria-label="Tạo lại">
                <RotateCcw className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onRemove(job.id)} aria-label="Xoá job">
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {active && <Progress value={job.progress} className="h-1 rounded-none" />}

      {media && (
        <div className="border-t border-border bg-background/40 p-4">
          {job.kind === "image" ? (
            <img
              src={media}
              alt={job.prompt}
              className={`w-full rounded-xl object-cover transition-[filter] duration-500 ${
                job.resultUrl ? "blur-0" : "blur-xl"
              }`}
              loading="lazy"
            />
          ) : (
            <video src={media} controls playsInline className="w-full rounded-xl" />
          )}

          {job.resultUrl && (
            <Button
              variant="default"
              className="mt-3 w-full"
              onClick={() => {
                if (job.kind === "image") {
                  void downloadImage(
                    job.resultUrl!,
                    `lovable-image-${job.id}.png`,
                    job.imageSettings?.upscale2k ?? false,
                  );
                } else {
                  downloadVideo(job.resultUrl!, `lovable-video-${job.id}.mp4`);
                }
              }}
            >
              <Download className="size-4" />
              Tải xuống {job.kind === "image" && job.imageSettings?.upscale2k ? "(2K)" : ""}
            </Button>
          )}
        </div>
      )}

      {job.error && (
        <p className="border-t border-border px-4 py-3 text-xs text-destructive">{job.error}</p>
      )}
    </article>
  );
}
