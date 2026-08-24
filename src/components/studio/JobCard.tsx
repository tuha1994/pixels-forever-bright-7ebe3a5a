import { Download, RotateCcw, Trash2, X, Loader2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { downloadImage, downloadVideo } from "@/lib/studio/download";
import { EXPORT_RES_LABELS, type Job } from "@/lib/studio/types";

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
  const exportRes = job.imageSettings?.exportRes ?? "original";
  const settingLine =
    job.kind === "image"
      ? `${job.imageSettings?.model.split("/")[1]} · ${job.imageSettings?.aspect} · ${job.imageSettings?.quality} · xuất ${EXPORT_RES_LABELS[exportRes]}`
      : `${job.videoSettings?.model.split("/")[1]} · ${job.videoSettings?.aspect} · ${job.videoSettings?.resolution} · ${job.videoSettings?.durationSeconds}s`;
  const createdLabel = new Date(job.createdAt).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <article className="surface-panel group overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-[var(--shadow-glow)]">
      {media && (
        <div className="relative border-b border-border bg-background/40">
          {job.kind === "image" ? (
            <img
              src={media}
              alt={job.prompt}
              className={`max-h-96 w-full object-cover transition-[filter] duration-500 ${
                job.resultUrl ? "blur-0" : "blur-xl"
              }`}
              loading="lazy"
            />
          ) : (
            <video src={media} controls playsInline className="max-h-96 w-full" />
          )}
        </div>
      )}

      {active && <Progress value={job.progress} className="h-1 rounded-none" />}

      <div className="p-4">
        <div className="flex items-center gap-2">
          <Badge variant={job.kind === "image" ? "secondary" : "outline"} className="uppercase">
            {job.kind === "image" ? "Ảnh" : "Video"}
          </Badge>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.className}`}>
            <StatusIcon status={job.status} />
            {job.message ?? meta.label}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">{createdLabel}</span>
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-foreground">{job.prompt}</p>
        <p className="mt-1 text-xs text-muted-foreground">{settingLine}</p>

        {job.error && <p className="mt-2 text-xs text-destructive">{job.error}</p>}

        <div className="mt-3 flex items-center gap-1.5">
          {job.resultUrl && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                if (job.kind === "image") {
                  void downloadImage(job.resultUrl!, `aurora-image-${job.id}.png`, exportRes);
                } else {
                  downloadVideo(job.resultUrl!, `aurora-video-${job.id}.mp4`);
                }
              }}
            >
              <Download className="size-4" />
              Tải xuống
              {job.kind === "image" && exportRes !== "original" ? ` (${EXPORT_RES_LABELS[exportRes]})` : ""}
            </Button>
          )}
          {active ? (
            <Button
              variant="ghost"
              size="icon"
              className={job.resultUrl ? "" : "ml-auto"}
              onClick={() => onCancel(job.id)}
              aria-label="Huỷ job"
            >
              <X className="size-4" />
            </Button>
          ) : (
            <div className={`flex gap-1 ${job.resultUrl ? "" : "ml-auto"}`}>
              <Button variant="ghost" size="icon" onClick={() => onRetry(job.id)} aria-label="Tạo lại">
                <RotateCcw className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onRemove(job.id)} aria-label="Xoá job">
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
