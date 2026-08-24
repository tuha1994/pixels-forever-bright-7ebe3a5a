import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { generateImage, generateVideo } from "./api";
import { deleteStoredJob, loadStoredJobs, putStoredJob, type StoredJob } from "./db";
import type { Job } from "./types";

export type NewJob = Omit<Job, "id" | "createdAt" | "status" | "progress">;

/** Chữ ký trạng thái để chỉ ghi DB khi có thay đổi đáng kể (tránh ghi mỗi frame preview). */
function signatureOf(job: Job) {
  return `${job.status}:${job.resultUrl ? "r" : ""}`;
}

function serialize(job: Job, videoBlob?: Blob): StoredJob {
  const { resultUrl, previewUrl: _preview, ...rest } = job;
  const record: StoredJob = { ...rest };
  if (job.kind === "image" && resultUrl) record.resultData = resultUrl;
  if (job.kind === "video" && videoBlob) record.resultBlob = videoBlob;
  return record;
}

export function useStudioQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const runningRef = useRef(false);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  /** Blob video theo job id — cần để ghi vào IndexedDB và tạo lại object URL sau F5. */
  const videoBlobsRef = useRef<Map<string, Blob>>(new Map());
  const persistedRef = useRef<Map<string, string>>(new Map());
  const quotaWarnedRef = useRef(false);
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;

  // Nạp lịch sử từ database local khi mở trang.
  useEffect(() => {
    let cancelled = false;
    loadStoredJobs()
      .then((stored) => {
        if (cancelled) return;
        const restored: Job[] = stored.map((s) => {
          const interrupted = s.status === "queued" || s.status === "running";
          let resultUrl: string | undefined;
          if (s.kind === "video" && s.resultBlob) {
            videoBlobsRef.current.set(s.id, s.resultBlob);
            resultUrl = URL.createObjectURL(s.resultBlob);
          } else if (s.kind === "image" && s.resultData) {
            resultUrl = s.resultData;
          }
          const message = interrupted ? "Bị gián đoạn khi tải lại trang" : s.message;
          const job: Job = {
            ...s,
            status: interrupted ? "canceled" : s.status,
            previewUrl: "",
            ...(message !== undefined ? { message } : {}),
            ...(resultUrl !== undefined ? { resultUrl } : {}),
          };
          persistedRef.current.set(job.id, signatureOf(job));
          return job;
        });
        setJobs(restored);
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Đồng bộ thay đổi xuống database local (debounce nhẹ).
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      const current = jobsRef.current;
      const seen = new Set<string>();
      for (const job of current) {
        seen.add(job.id);
        const sig = signatureOf(job);
        if (persistedRef.current.get(job.id) === sig) continue;
        persistedRef.current.set(job.id, sig);
        putStoredJob(serialize(job, videoBlobsRef.current.get(job.id))).catch(() => {
          if (!quotaWarnedRef.current) {
            quotaWarnedRef.current = true;
            toast.error("Bộ nhớ local đã đầy — không thể lưu thêm kết quả");
          }
        });
      }
      for (const id of [...persistedRef.current.keys()]) {
        if (!seen.has(id)) {
          persistedRef.current.delete(id);
          void deleteStoredJob(id).catch(() => {});
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [jobs, hydrated]);

  const patch = useCallback((id: string, next: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...next } : j)));
  }, []);

  const releaseMedia = useCallback((job: Job | undefined) => {
    if (!job) return;
    if (job.resultUrl?.startsWith("blob:")) URL.revokeObjectURL(job.resultUrl);
    videoBlobsRef.current.delete(job.id);
  }, []);

  const enqueue = useCallback((job: NewJob) => {
    const full: Job = {
      ...job,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      status: "queued",
      progress: 0,
    };
    setJobs((prev) => [full, ...prev]);
    return full.id;
  }, []);

  const cancel = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) controller.abort();
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id && (j.status === "queued" || j.status === "running")
          ? { ...j, status: "canceled", message: "Đã huỷ" }
          : j,
      ),
    );
  }, []);

  const remove = useCallback(
    (id: string) => {
      controllersRef.current.get(id)?.abort();
      releaseMedia(jobsRef.current.find((j) => j.id === id));
      setJobs((prev) => prev.filter((j) => j.id !== id));
    },
    [releaseMedia],
  );

  const retry = useCallback(
    (id: string) => {
      const job = jobsRef.current.find((j) => j.id === id);
      if (!job) return;
      enqueue({
        kind: job.kind,
        prompt: job.prompt,
        references: job.references,
        ...(job.imageSettings ? { imageSettings: job.imageSettings } : {}),
        ...(job.videoSettings ? { videoSettings: job.videoSettings } : {}),
      });
      toast.success("Đã thêm job mới vào hàng chờ");
    },
    [enqueue],
  );

  const clearFinished = useCallback(() => {
    for (const job of jobsRef.current) {
      if (job.status !== "queued" && job.status !== "running") releaseMedia(job);
    }
    setJobs((prev) => prev.filter((j) => j.status === "queued" || j.status === "running"));
  }, [releaseMedia]);

  // Sequential worker: runs one job at a time (video APIs are concurrency-limited).
  useEffect(() => {
    if (runningRef.current) return;
    const next = [...jobs].reverse().find((j) => j.status === "queued");
    if (!next) return;

    runningRef.current = true;
    const controller = new AbortController();
    controllersRef.current.set(next.id, controller);

    (async () => {
      patch(next.id, { status: "running", progress: 3, message: "Đang khởi tạo…" });
      try {
        if (next.kind === "image" && next.imageSettings) {
          let frames = 0;
          await generateImage(
            next.prompt,
            next.imageSettings,
            next.references,
            (dataUrl, isFinal) => {
              frames += 1;
              flushSync(() => {
                if (isFinal) {
                  patch(next.id, {
                    status: "succeeded",
                    progress: 100,
                    resultUrl: dataUrl,
                    previewUrl: "",
                    message: "Hoàn tất",
                  });
                } else {
                  patch(next.id, {
                    previewUrl: dataUrl,
                    progress: Math.min(85, 25 + frames * 20),
                    message: "Đang dựng ảnh…",
                  });
                }
              });
            },
            controller.signal,
          );
        } else if (next.kind === "video" && next.videoSettings) {
          const blob = await generateVideo(
            next.prompt,
            next.videoSettings,
            next.references,
            (progress, message) => patch(next.id, { progress, message }),
            controller.signal,
          );
          videoBlobsRef.current.set(next.id, blob);
          patch(next.id, {
            status: "succeeded",
            progress: 100,
            resultUrl: URL.createObjectURL(blob),
            message: "Hoàn tất",
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          patch(next.id, { status: "canceled", message: "Đã huỷ" });
        } else {
          const msg = error instanceof Error ? error.message : "Lỗi không xác định";
          patch(next.id, { status: "failed", error: msg, message: "Thất bại" });
          toast.error(msg);
        }
      } finally {
        controllersRef.current.delete(next.id);
        runningRef.current = false;
        // Nudge the effect to pick up the next queued job.
        setJobs((prev) => [...prev]);
      }
    })();
  }, [jobs, patch]);

  return { jobs, hydrated, enqueue, cancel, remove, retry, clearFinished };
}
