import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { generateImage, generateVideo } from "./api";
import type { Job } from "./types";

export type NewJob = Omit<Job, "id" | "createdAt" | "status" | "progress">;

export function useStudioQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const runningRef = useRef(false);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;

  const patch = useCallback((id: string, next: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...next } : j)));
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

  const remove = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

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
    setJobs((prev) => prev.filter((j) => j.status === "queued" || j.status === "running"));
  }, []);

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
          const url = await generateVideo(
            next.prompt,
            next.videoSettings,
            next.references,
            (progress, message) => patch(next.id, { progress, message }),
            controller.signal,
          );
          patch(next.id, { status: "succeeded", progress: 100, resultUrl: url, message: "Hoàn tất" });
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

  return { jobs, enqueue, cancel, remove, retry, clearFinished };
}
