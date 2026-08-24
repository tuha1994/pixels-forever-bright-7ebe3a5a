import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fileToReference } from "@/lib/studio/download";
import type { ReferenceImage } from "@/lib/studio/types";

type Props = {
  references: ReferenceImage[];
  onChange: (next: ReferenceImage[]) => void;
  onInsertTag: (tag: string) => void;
  hint?: string;
};

function slugTag(name: string, index: number) {
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
  return `@${base || "ref"}_${index + 1}`;
}

export function ReferenceUploader({ references, onChange, onInsertTag, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: ReferenceImage[] = [...references];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} lớn hơn 8MB`);
        continue;
      }
      const { data, previewUrl } = await fileToReference(file);
      next.push({
        id: `${Date.now()}-${next.length}`,
        tag: slugTag(file.name, next.length),
        name: file.name,
        mimeType: file.type,
        data,
        previewUrl,
      });
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Ảnh tham chiếu</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-4" /> Thêm ảnh
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {references.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="group relative w-28 overflow-hidden rounded-xl border border-border bg-card"
            >
              <img src={ref.previewUrl} alt={ref.name} className="h-20 w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(references.filter((r) => r.id !== ref.id))}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label={`Xoá ${ref.name}`}
              >
                <X className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onInsertTag(ref.tag)}
                className="w-full px-2 py-1.5 text-left"
                title="Chèn tag vào prompt"
              >
                <Badge variant="secondary" className="w-full justify-center truncate text-[11px]">
                  {ref.tag}
                </Badge>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
