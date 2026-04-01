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
  tone = "cobalt"
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => inputRef.current?.click();

  return (
    <div className={`upload-dropzone upload-dropzone-${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {badge ? <p className="upload-dropzone-badge">{badge}</p> : null}
          <h4 className="font-display text-sm font-semibold text-ink">{label}</h4>
          {helperText ? <p className="mt-1 text-xs text-sand-600">{helperText}</p> : null}
        </div>

        <button type="button" onClick={openPicker} className="upload-dropzone-picker">
          Choose file{multiple ? "s" : ""}
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

      <div className="mt-3 space-y-2">
        {files.length === 0 ? (
          <div className="upload-dropzone-empty">
            <p className="text-sm font-semibold text-ink">No files selected yet.</p>
            <p className="mt-1 text-xs text-sand-500">
              {emptyStateHint ?? `Choose ${multiple ? "files" : "a file"} to attach to this listing.`}
            </p>
          </div>
        ) : null}
        {files.map((file, index) => (
          <div key={file.name + file.size + index} className="upload-file-chip">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
              <p className="text-xs text-sand-500">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))}
              className="upload-file-remove"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
