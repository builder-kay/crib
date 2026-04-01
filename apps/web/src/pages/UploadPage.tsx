import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UploadDropzone } from "@/components/UploadDropzone";
import { useToast } from "@/components/Toast";
import { createAssetListing } from "@/lib/api";
import { formatMajorCurrency } from "@/lib/format";
import { formatFileSize, MAX_PREVIEW_FILES, MAX_PREVIEW_FILE_SIZE_BYTES, MAX_PRIMARY_ASSET_SIZE_BYTES } from "@/lib/uploadLimits";
import { ASSET_CATEGORIES, PRIMARY_ASSET_ACCEPT, uploadAssetSchema } from "@/lib/validators/asset";
import { useAuthStore } from "@/store/authStore";

const CATEGORY_GUIDANCE: Record<(typeof ASSET_CATEGORIES)[number], string> = {
  "Figma Templates": "Interface kits, wireframes, design systems, social packs, landing pages, and collaborative product templates built for Figma.",
  "Canva Templates": "Editable Canva layouts for social media, presentations, media kits, flyers, resumes, and branded content packs.",
  "Photoshop Templates": "Editable PSD or PSB packs for flyers, social posts, cover art, composites, and layered design work.",
  "Illustrator Templates": "Vector-first logo systems, icon sets, poster templates, packaging layouts, and scalable brand assets.",
  "InDesign Templates": "Pitch decks, magazines, reports, portfolios, brand books, and other long-form layout systems.",
  "Lightroom Presets": "Desktop or mobile preset packs for portrait, editorial, travel, wedding, and product photography workflows.",
  "Premiere Pro Templates": "Openers, lower thirds, reels, broadcast graphics, timeline packs, and editor-ready sequence files.",
  "After Effects Templates": "Motion design scenes, typography systems, MOGRTs, logo reveals, and animation starter packs.",
  "Creative Cloud Bundles": "Multi-app packs that combine source files, exports, style guides, and support documents in one download.",
  "Other Creative Cloud Assets": "Adobe-ready source files or design works that do not fit a single app lane but still belong in this catalog."
};

const STATUS_OPTIONS = [
  {
    value: "published",
    label: "Publish now",
    description: "Make the listing visible immediately after save."
  },
  {
    value: "draft",
    label: "Save draft",
    description: "Keep it private while you keep refining it."
  }
] as const;

const PLATFORM_COMMISSION_RATE = 0.1;

const AFRICAN_CURRENCIES = [
  { code: "GHS", label: "Ghanaian cedi", countries: "Ghana" },
  { code: "AOA", label: "Angolan kwanza", countries: "Angola" },
  { code: "BIF", label: "Burundian franc", countries: "Burundi" },
  { code: "BWP", label: "Botswana pula", countries: "Botswana" },
  { code: "CDF", label: "Congolese franc", countries: "Democratic Republic of the Congo" },
  { code: "CVE", label: "Cape Verdean escudo", countries: "Cabo Verde" },
  { code: "DJF", label: "Djiboutian franc", countries: "Djibouti" },
  { code: "DZD", label: "Algerian dinar", countries: "Algeria" },
  { code: "EGP", label: "Egyptian pound", countries: "Egypt" },
  { code: "ERN", label: "Eritrean nakfa", countries: "Eritrea" },
  { code: "ETB", label: "Ethiopian birr", countries: "Ethiopia" },
  { code: "GMD", label: "Gambian dalasi", countries: "The Gambia" },
  { code: "GNF", label: "Guinean franc", countries: "Guinea" },
  { code: "KES", label: "Kenyan shilling", countries: "Kenya" },
  { code: "KMF", label: "Comorian franc", countries: "Comoros" },
  { code: "LRD", label: "Liberian dollar", countries: "Liberia" },
  { code: "LSL", label: "Lesotho loti", countries: "Lesotho" },
  { code: "LYD", label: "Libyan dinar", countries: "Libya" },
  { code: "MAD", label: "Moroccan dirham", countries: "Morocco" },
  { code: "MGA", label: "Malagasy ariary", countries: "Madagascar" },
  { code: "MRU", label: "Mauritanian ouguiya", countries: "Mauritania" },
  { code: "MUR", label: "Mauritian rupee", countries: "Mauritius" },
  { code: "MWK", label: "Malawian kwacha", countries: "Malawi" },
  { code: "MZN", label: "Mozambican metical", countries: "Mozambique" },
  { code: "NAD", label: "Namibian dollar", countries: "Namibia" },
  { code: "NGN", label: "Nigerian naira", countries: "Nigeria" },
  { code: "RWF", label: "Rwandan franc", countries: "Rwanda" },
  { code: "SCR", label: "Seychellois rupee", countries: "Seychelles" },
  { code: "SDG", label: "Sudanese pound", countries: "Sudan" },
  { code: "SLE", label: "Sierra Leonean leone", countries: "Sierra Leone" },
  { code: "SOS", label: "Somali shilling", countries: "Somalia" },
  { code: "SSP", label: "South Sudanese pound", countries: "South Sudan" },
  { code: "STN", label: "Sao Tome and Principe dobra", countries: "Sao Tome and Principe" },
  { code: "SZL", label: "Swazi lilangeni", countries: "Eswatini" },
  { code: "TND", label: "Tunisian dinar", countries: "Tunisia" },
  { code: "TZS", label: "Tanzanian shilling", countries: "Tanzania" },
  { code: "UGX", label: "Ugandan shilling", countries: "Uganda" },
  { code: "XAF", label: "Central African CFA franc", countries: "Cameroon, Central African Republic, Chad, Congo, Equatorial Guinea, Gabon" },
  { code: "XOF", label: "West African CFA franc", countries: "Benin, Burkina Faso, Cote d'Ivoire, Guinea-Bissau, Mali, Niger, Senegal, Togo" },
  { code: "ZAR", label: "South African rand", countries: "South Africa" },
  { code: "ZMW", label: "Zambian kwacha", countries: "Zambia" },
  { code: "ZWG", label: "Zimbabwe Gold", countries: "Zimbabwe" }
] as const;

type UploadStepId = "identity" | "pricing" | "files";

export function UploadPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof ASSET_CATEGORIES)[number]>("Photoshop Templates");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState("5");
  const [currency, setCurrency] = useState("GHS");
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [mainFile, setMainFile] = useState<File[]>([]);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [activeStepId, setActiveStepId] = useState<UploadStepId>("identity");

  const steps = useMemo(
    () => [
      {
        id: "identity" as const,
        title: "Listing details",
        description: "Name the listing and explain what buyers get.",
        done: Boolean(title.trim() && description.trim().length >= 10 && category)
      },
      {
        id: "pricing" as const,
        title: "Pricing",
        description: "Set price, currency, and visibility.",
        done: Boolean(price.trim() && currency.trim())
      },
      {
        id: "files" as const,
        title: "Files",
        description: "Upload the source file and optional previews.",
        done: mainFile.length === 1
      }
    ],
    [category, currency, description, mainFile.length, price, title]
  );

  const activeStepIndex = steps.findIndex((step) => step.id === activeStepId);
  const safeActiveStepIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
  const activeStep = steps[safeActiveStepIndex];
  const isFirstStep = safeActiveStepIndex === 0;
  const isLastStep = safeActiveStepIndex === steps.length - 1;
  const numericPrice = Number(price);
  const normalizedPrice = Number.isFinite(numericPrice) ? Math.max(numericPrice, 0) : 0;
  const estimatedCommission = normalizedPrice * PLATFORM_COMMISSION_RATE;
  const estimatedSellerNet = Math.max(normalizedPrice - estimatedCommission, 0);
  const activeControlToneClass =
    activeStep.id === "identity"
      ? "upload-form-control upload-form-control-cobalt"
      : activeStep.id === "pricing"
        ? "upload-form-control upload-form-control-sunset"
        : "upload-form-control upload-form-control-lagoon";

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("You must be signed in");
      }

      if (mainFile.length !== 1) {
        throw new Error("Upload exactly one primary listing file");
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
      pushToast("Listing uploaded successfully", "success");
      navigate(`/asset/${assetId}`);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Upload failed", "error");
    }
  });

  const goToPreviousStep = () => {
    if (isFirstStep) {
      return;
    }

    setActiveStepId(steps[safeActiveStepIndex - 1].id);
  };

  const goToNextStep = () => {
    if (isLastStep) {
      return;
    }

    setActiveStepId(steps[safeActiveStepIndex + 1].id);
  };

  return (
    <div className="upload-shell space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Creator Studio</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">Upload Creative Listing</h1>
            <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
              Move through the steps, add your listing details, then publish when everything is ready.
            </p>
          </div>

          <span className="chip-spectrum">{`Step ${safeActiveStepIndex + 1} of ${steps.length}`}</span>
        </div>
      </header>

      <form
        className="grid gap-5 lg:grid-cols-[280px,minmax(0,1fr)]"
        onSubmit={(event) => {
          event.preventDefault();
          uploadMutation.mutate();
        }}
      >
        <aside className="surface-card upload-step-sidebar p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Steps</p>

          <div className="mt-4 space-y-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepId(step.id)}
                className={`upload-step-item ${
                  step.id === activeStep.id ? "upload-step-item-active" : step.done ? "upload-step-item-complete" : ""
                }`}
              >
                <span className="upload-step-index">{step.done && step.id !== activeStep.id ? "OK" : index + 1}</span>
                <span className="min-w-0">
                  <span className="upload-step-title">{step.title}</span>
                  <span className="upload-step-copy">{step.description}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className={`surface-card upload-wizard-panel upload-wizard-panel-${activeStep.id} p-5 md:p-6`}>
          <div className="flex flex-col gap-2 border-b border-sand-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">{`Step ${safeActiveStepIndex + 1}`}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">{activeStep.title}</h2>
              <p className="mt-1 text-sm text-sand-600">{activeStep.description}</p>
            </div>

            <span className={`upload-step-state upload-step-state-${activeStep.id} ${activeStep.done ? "upload-step-state-complete" : ""}`}>
              {activeStep.done ? "Ready" : "In progress"}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {activeStep.id === "identity" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Title" value={title} onChange={setTitle} required emphasizedLabel controlClassName={activeControlToneClass} />

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-sand-800">Category</span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value as (typeof ASSET_CATEGORIES)[number])}
                      className={`w-full rounded-xl px-3 py-2 outline-none transition ${activeControlToneClass}`}
                    >
                      {ASSET_CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-sand-600">{CATEGORY_GUIDANCE[category]}</p>
                  </label>
                </div>

                <Field label="Description" value={description} onChange={setDescription} multiline required controlClassName={activeControlToneClass} />
              </>
            ) : null}

            {activeStep.id === "pricing" ? (
              <>
                <Field label="Tags (comma-separated)" value={tags} onChange={setTags} controlClassName={activeControlToneClass} />

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Price" type="number" value={price} onChange={setPrice} required controlClassName={activeControlToneClass} />

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-sand-800">Currency</span>
                    <select
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className={`w-full rounded-xl px-3 py-2 outline-none transition ${activeControlToneClass}`}
                    >
                      {AFRICAN_CURRENCIES.map((option) => (
                        <option key={option.code} value={option.code}>
                          {`${option.code} - ${option.label} (${option.countries})`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="upload-profit-panel">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sunset-700">Earnings estimate</p>
                  <p className="mt-2 text-sm text-sand-700">
                    CRIB takes a 10% platform commission on every successful sale. Here is the estimated split at your current price.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MetricTile label="Buyer pays" value={formatMajorCurrency(normalizedPrice, currency)} tone="cobalt" />
                    <MetricTile label="Platform fee" value={formatMajorCurrency(estimatedCommission, currency)} tone="sunset" />
                    <MetricTile label="You keep" value={formatMajorCurrency(estimatedSellerNet, currency)} tone="forest" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-sand-800">Visibility</p>
                    <p className="mt-1 text-xs text-sand-600">Choose whether this listing goes live now or stays private as a draft.</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {STATUS_OPTIONS.map((option) => (
                      <StatusOptionCard
                        key={option.value}
                        label={option.label}
                        description={option.description}
                        active={status === option.value}
                        onClick={() => setStatus(option.value)}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {activeStep.id === "files" ? (
              <div className="space-y-4">
                <div className="upload-files-highlight">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lagoon-700">Delivery setup</p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-ink">Package the listing beautifully</h3>
                  <p className="mt-2 text-sm text-sand-700">
                    Upload the final editable file buyers receive, then add preview images that make the work easy to understand at a glance.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="upload-files-chip upload-files-chip-cobalt">Secure source file</span>
                    <span className="upload-files-chip upload-files-chip-lagoon">Marketplace previews</span>
                    <span className="upload-files-chip upload-files-chip-sunset">Buyer-ready delivery</span>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="upload-files-dropzone-card upload-files-dropzone-card-cobalt">
                    <UploadDropzone
                      label="Primary template file"
                      accept={PRIMARY_ASSET_ACCEPT}
                      files={mainFile}
                      onFilesChange={(files) => setMainFile(files.slice(0, 1))}
                      helperText={`One source file or ZIP package. Max ${formatFileSize(MAX_PRIMARY_ASSET_SIZE_BYTES)}.`}
                      badge="Required"
                      emptyStateHint="Attach the source file buyers receive after checkout."
                      tone="cobalt"
                    />
                  </div>

                  <div className="upload-files-dropzone-card upload-files-dropzone-card-lagoon">
                    <UploadDropzone
                      label="Preview images"
                      accept="image/*"
                      files={previewFiles}
                      onFilesChange={(files) => setPreviewFiles(files.slice(0, MAX_PREVIEW_FILES))}
                      multiple
                      helperText={`Optional previews. Up to ${MAX_PREVIEW_FILES} images, ${formatFileSize(MAX_PREVIEW_FILE_SIZE_BYTES)} each.`}
                      badge="Optional"
                      emptyStateHint="Add preview images if you want buyers to see the work before purchase."
                      tone="lagoon"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="upload-files-note upload-files-note-cobalt">
                    The primary file is the one buyer downloads after checkout, so use a clean final source package.
                  </div>
                  <div className="upload-files-note upload-files-note-lagoon">
                    Preview images help buyers trust the listing before purchase, so show key screens, layers, or results.
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-4">
            <button type="button" onClick={goToPreviousStep} disabled={isFirstStep} className="upload-nav-button upload-nav-button-secondary">
              Previous
            </button>

            <div className="flex flex-wrap gap-2">
              {!isLastStep ? (
                <button type="button" onClick={goToNextStep} className={`upload-nav-button upload-nav-button-primary upload-nav-button-primary-${activeStep.id}`}>
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className={`upload-nav-button upload-nav-button-primary upload-nav-button-primary-${activeStep.id} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {uploadMutation.isPending ? "Saving..." : status === "published" ? "Publish listing" : "Save draft"}
                </button>
              )}
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

function StatusOptionCard({
  label,
  description,
  active,
  onClick
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`upload-status-card ${active ? "upload-status-card-active" : ""}`}>
      <span className="block font-display text-lg font-semibold text-ink">{label}</span>
      <span className="upload-status-copy mt-1 block text-sm text-sand-600">{description}</span>
    </button>
  );
}

function MetricTile({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "cobalt" | "sunset" | "forest";
}) {
  return (
    <article className={`upload-metric-tile upload-metric-tile-${tone}`}>
      <p className="upload-metric-label">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  multiline,
  emphasizedLabel,
  controlClassName = "upload-form-control upload-form-control-cobalt"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  emphasizedLabel?: boolean;
  controlClassName?: string;
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
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          required={required}
          className={`w-full rounded-xl px-3 py-2 outline-none transition ${controlClassName}`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          required={required}
          className={`w-full rounded-xl px-3 py-2 outline-none transition ${controlClassName}`}
        />
      )}
    </label>
  );
}
