import { useRef } from "react";
import { formatFileSize } from "@/lib/uploadLimits";

type UploadDropzoneProps = {
  label: string;
  accept: string;
  multiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  helperText?: string;
};

export function UploadDropzone({
  label,
  accept,
  multiple = false,
  files,
  onFilesChange,
  helperText
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="rounded-2xl border border-dashed border-cobalt-200 bg-gradient-to-br from-cobalt-50/60 via-white to-sand-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="font-display text-sm font-semibold text-ink">{label}</h4>
          {helperText ? <p className="text-xs text-sand-600">{helperText}</p> : null}
        </div>

        <button
          type="button"
          onClick={openPicker}
          className="rounded-lg border border-cobalt-200 bg-white px-3 py-2 text-xs font-semibold text-cobalt-700 transition hover:border-cobalt-300 hover:bg-cobalt-50"
        >
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
          <div className="rounded-lg border border-cobalt-100 bg-white px-3 py-2.5 text-sm text-sand-500">
            No files selected yet.
          </div>
        ) : null}
        {files.map((file) => (
          <div key={file.name + file.size} className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-sand-700">
            <span className="font-medium text-ink">{file.name}</span>
            <span className="ml-2 text-xs text-sand-500">({formatFileSize(file.size)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
