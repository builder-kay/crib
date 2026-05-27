import { useRef } from "react";
import { formatFileSize } from "@/lib/uploadLimits";

type UploadDropzoneProps = {
  label: string;
  accept: string;
  multiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  helperText?: string;
  badge?: string;
  emptyStateHint?: string;
  tone?: "cobalt" | "lagoon";
  variant?: "default" | "thumbnail";
  pickerLabel?: string;
};

export function UploadDropzone({
  label,
  accept,
  multiple = false,
  files,
  onFilesChange,
  helperText,
  badge,
  emptyStateHint,
  tone = "cobalt",
  variant = "default",
  pickerLabel
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toneAccentClass = tone === "lagoon" ? "text-cobalt-700" : "text-cobalt-700";
  const toneSurfaceClass = tone === "lagoon" ? "bg-white/75 border-cobalt-100" : "bg-white/80 border-cobalt-100";
  const isThumbnailVariant = variant === "thumbnail";

  const openPicker = () => inputRef.current?.click();

  return (
    <div className={`upload-dropzone upload-dropzone-${tone} ${isThumbnailVariant ? "upload-dropzone-thumbnail" : ""}`}>
      <div className={isThumbnailVariant ? "upload-dropzone-thumbnail-header" : "flex flex-wrap items-start justify-between gap-4"}>
        <div className="max-w-2xl">
          {badge ? <p className="upload-dropzone-badge text-cobalt-700">{badge}</p> : null}
          <div className={isThumbnailVariant ? "mt-4 flex flex-col items-center gap-3 text-center" : "mt-2 flex items-center gap-3"}>
            <span className={isThumbnailVariant ? "upload-dropzone-thumbnail-icon" : "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cobalt-600 text-white shadow-lg shadow-cobalt-200/70"}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16.5V6" />
                <path d="m8.5 9.5 3.5-3.5 3.5 3.5" />
                <path d="M5 18.5h14" />
              </svg>
            </span>
            <div>
              <h4 className={`font-display text-lg font-semibold ${toneAccentClass}`}>{label}</h4>
              {helperText ? <p className="mt-1 text-sm leading-6 text-cobalt-800/85">{helperText}</p> : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openPicker}
          className={`upload-dropzone-picker bg-cobalt-600 text-white shadow-sm shadow-cobalt-200 hover:bg-cobalt-700 ${isThumbnailVariant ? "upload-dropzone-picker-thumbnail" : ""}`}
        >
          {pickerLabel ?? `Choose file${multiple ? "s" : ""}`}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          onFilesChange(selected);
        }}
      />

      <div className="mt-4 space-y-3">
        {files.length === 0 ? (
          <div className={`upload-dropzone-empty rounded-[1.5rem] border px-4 py-5 ${toneSurfaceClass} ${isThumbnailVariant ? "upload-dropzone-empty-thumbnail" : ""}`}>
            <p className="text-sm font-semibold text-cobalt-700">No files selected yet.</p>
            <p className="mt-1 text-sm leading-6 text-sand-700">
              {emptyStateHint ?? `Choose ${multiple ? "files" : "a file"} to attach to this listing.`}
            </p>
          </div>
        ) : null}
        {files.map((file, index) => (
          <div key={file.name + file.size + index} className="upload-file-chip border-cobalt-100 bg-white/90">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
              <p className="text-xs text-cobalt-700">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))}
              className="upload-file-remove text-cobalt-700 hover:text-cobalt-800"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
