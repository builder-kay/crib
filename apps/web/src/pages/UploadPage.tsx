import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UploadDropzone } from "@/components/UploadDropzone";
import { useToast } from "@/components/Toast";
import { createAssetListing } from "@/lib/api";
import { formatFileSize, MAX_PREVIEW_FILES, MAX_PREVIEW_FILE_SIZE_BYTES, MAX_PRIMARY_ASSET_SIZE_BYTES } from "@/lib/uploadLimits";
import { ASSET_CATEGORIES, uploadAssetSchema } from "@/lib/validators/asset";
import { useAuthStore } from "@/store/authStore";

export function UploadPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof ASSET_CATEGORIES)[number]>("Templates");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState("5");
  const [currency, setCurrency] = useState("GHS");
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [mainFile, setMainFile] = useState<File[]>([]);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);

  const parsedTagCount = useMemo(
    () =>
      tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean).length,
    [tags]
  );

  const checklist = useMemo(
    () => [
      { label: "Title and category selected", done: Boolean(title.trim() && category) },
      { label: "Description is detailed", done: description.trim().length >= 10 },
      { label: "Primary file attached", done: mainFile.length === 1 },
      { label: "Price and currency configured", done: Boolean(price.trim() && currency.trim()) },
      { label: "At least one preview image (recommended)", done: previewFiles.length > 0 }
    ],
    [title, category, description, mainFile.length, price, currency, previewFiles.length]
  );

  const completedChecklist = checklist.filter((item) => item.done).length;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("You must be signed in");
      }

      if (mainFile.length !== 1) {
        throw new Error("Upload exactly one primary asset file");
      }

      if (mainFile[0].size > MAX_PRIMARY_ASSET_SIZE_BYTES) {
        throw new Error(
          `Primary file is too large (${formatFileSize(mainFile[0].size)}). Limit is ${formatFileSize(MAX_PRIMARY_ASSET_SIZE_BYTES)}.`
        );
      }

      if (previewFiles.length > MAX_PREVIEW_FILES) {
        throw new Error(`You can upload up to ${MAX_PREVIEW_FILES} preview images.`);
      }

      const oversizedPreview = previewFiles.find((file) => file.size > MAX_PREVIEW_FILE_SIZE_BYTES);
      if (oversizedPreview) {
        throw new Error(
          `Preview image "${oversizedPreview.name}" is too large (${formatFileSize(oversizedPreview.size)}). Limit is ${formatFileSize(MAX_PREVIEW_FILE_SIZE_BYTES)}.`
        );
      }

      const parsed = uploadAssetSchema.safeParse({
        title,
        description,
        category,
        tags,
        price,
        currency,
        status
      });

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid upload form");
      }

      return createAssetListing(user.id, parsed.data, mainFile[0], previewFiles);
    },
    onSuccess: ({ assetId }) => {
      pushToast("Asset uploaded successfully", "success");
      navigate(`/asset/${assetId}`);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Upload failed", "error");
    }
  });

  return (
    <div className="space-y-6">
      <header className="surface-card-vivid subtle-pattern p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Creator Studio</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Upload Asset</h1>
            <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
              Shape your listing with clear positioning, polished previews, and pricing that converts.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <QuickPill label="Main file limit" value={formatFileSize(MAX_PRIMARY_ASSET_SIZE_BYTES)} />
            <QuickPill label="Preview slots" value={String(MAX_PREVIEW_FILES)} />
            <QuickPill label="Listing mode" value={status === "published" ? "Live" : "Draft"} />
          </div>
        </div>
      </header>

      <form
        className="grid gap-5 xl:grid-cols-[1.35fr,0.65fr]"
        onSubmit={(event) => {
          event.preventDefault();
          uploadMutation.mutate();
        }}
      >
        <div className="space-y-5">
          <section className="surface-card space-y-4 p-5 md:p-6">
            <SectionTitle
              title="Asset Identity"
              subtitle="Lead with a specific title, niche category, and concise description."
            />

            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Title"
                value={title}
                onChange={setTitle}
                required
                emphasizedLabel
                hint="Give it a clear buyer-facing name."
              />

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-sand-800">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as (typeof ASSET_CATEGORIES)[number])}
                  className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                >
                  {ASSET_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <Field label="Description" value={description} onChange={setDescription} multiline required />
          </section>

          <section className="surface-card space-y-4 p-5 md:p-6">
            <SectionTitle
              title="Pricing and Visibility"
              subtitle="Set your pricing signal and decide whether to publish now or save as draft."
            />

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Tags (comma-separated)" value={tags} onChange={setTags} />
              <Field label="Price (GHS)" type="number" value={price} onChange={setPrice} required />
              <Field label="Currency" value={currency} onChange={setCurrency} required />
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-sand-800">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as "draft" | "published")}
                className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </section>

          <section className="surface-card space-y-4 p-5 md:p-6">
            <SectionTitle
              title="Asset Files"
              subtitle="Upload one secure downloadable file and public preview images for marketplace browsing."
            />

            <UploadDropzone
              label="Primary asset file"
              accept=".zip,.pdf,.mp3,.wav,.mp4,.psd,.fig,.sketch,.ttf,.otf,.jpg,.jpeg,.png"
              files={mainFile}
              onFilesChange={(files) => setMainFile(files.slice(0, 1))}
              helperText={`Private buyer download file (max ${formatFileSize(MAX_PRIMARY_ASSET_SIZE_BYTES)})`}
            />

            <UploadDropzone
              label="Preview images"
              accept="image/*"
              files={previewFiles}
              onFilesChange={(files) => setPreviewFiles(files.slice(0, MAX_PREVIEW_FILES))}
              multiple
              helperText={`Public thumbnails shown in marketplace (up to ${MAX_PREVIEW_FILES}, max ${formatFileSize(MAX_PREVIEW_FILE_SIZE_BYTES)} each)`}
            />
          </section>

          <button
            type="submit"
            disabled={uploadMutation.isPending}
            className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadMutation.isPending ? "Publishing..." : status === "published" ? "Publish asset" : "Save draft"}
          </button>
        </div>

        <aside className="space-y-5">
          <section className="surface-card p-5">
            <h2 className="font-display text-lg font-semibold text-ink">Listing Snapshot</h2>
            <p className="mt-1 text-sm text-sand-600">Live preview of your listing essentials.</p>

            <div className="mt-4 space-y-3">
              <SnapshotRow label="Title" value={title.trim() || "Untitled asset"} />
              <SnapshotRow label="Category" value={category} />
              <SnapshotRow label="Price" value={`${currency || "GHS"} ${price || "0"}`} />
              <SnapshotRow label="Tags" value={`${parsedTagCount} selected`} />
              <SnapshotRow label="Previews" value={`${previewFiles.length}/${MAX_PREVIEW_FILES}`} />
              <SnapshotRow label="Status" value={status === "published" ? "Live on marketplace" : "Saved as draft"} />
            </div>
          </section>

          <section className="surface-card p-5">
            <h2 className="font-display text-lg font-semibold text-ink">Publishing Checklist</h2>
            <p className="mt-1 text-sm text-sand-600">
              {completedChecklist}/{checklist.length} ready
            </p>

            <div className="mt-4 space-y-2">
              {checklist.map((item) => (
                <ChecklistRow key={item.label} label={item.label} done={item.done} />
              ))}
            </div>
          </section>

          <section className="surface-card p-5">
            <h2 className="font-display text-lg font-semibold text-ink">Conversion Tips</h2>
            <ul className="mt-3 space-y-2 text-sm text-sand-700">
              <li>Use descriptive titles that mention outcome, not just file type.</li>
              <li>Add 2-4 preview images to improve trust and click-through.</li>
              <li>Draft first if you want to refine copy before publishing publicly.</li>
            </ul>
          </section>
        </aside>
      </form>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-sand-600">{subtitle}</p>
    </div>
  );
}

function QuickPill({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-cobalt-100 bg-white/90 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cobalt-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </article>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-sand-200 bg-sand-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function ChecklistRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${done ? "border-forest-200 bg-forest-100/60" : "border-sand-200 bg-sand-50"}`}>
      <p className={`font-medium ${done ? "text-forest-800" : "text-sand-700"}`}>{label}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  multiline,
  hint,
  emphasizedLabel
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
  emphasizedLabel?: boolean;
}) {
  return (
    <label className="block">
      <span
        className={`mb-1 block ${
          emphasizedLabel
            ? "font-display text-xl font-semibold tracking-tight text-ink"
            : "text-sm font-medium text-sand-800"
        }`}
      >
        {label}
      </span>
      {hint ? <span className="mb-1 block text-xs text-sand-600">{hint}</span> : null}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          required={required}
          className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          required={required}
          className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
        />
      )}
    </label>
  );
}
