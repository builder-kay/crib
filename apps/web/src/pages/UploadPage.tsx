import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { UploadDropzone } from "@/components/UploadDropzone";
import { useToast } from "@/components/Toast";
import { createAssetListing } from "@/lib/api";
import { formatMajorCurrency } from "@/lib/format";
import { formatFileSize, MAX_PREVIEW_FILES, MAX_PREVIEW_FILE_SIZE_BYTES, MAX_PRIMARY_ASSET_SIZE_BYTES } from "@/lib/uploadLimits";
import {
  ADOBE_APP_CATEGORIES,
  CANVA_ASSET_CATEGORIES,
  FIGMA_ASSET_CATEGORIES,
  OTHER_ASSET_CATEGORIES,
  PRIMARY_ASSET_ACCEPT,
  TEMPLATE_TYPES,
  uploadAssetSchema
} from "@/lib/validators/asset";
import { useAuthStore } from "@/store/authStore";

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

const TEMPLATE_TYPE_CONTENT = {
  canva: {
    label: "Canva",
    description: "Best for social packs, flyers, decks, media kits, and editable marketing layouts.",
    contentLabel: "Paste your Canva template link",
    contentHint: "In Canva, click Share and copy the Template link buyers should receive after purchase.",
    deliverySummary: "No file hosting required. Buyers receive the Canva template link after checkout.",
    categories: CANVA_ASSET_CATEGORIES
  },
  figma: {
    label: "Figma",
    description: "Great for UI kits, web templates, app screens, design systems, and product resources.",
    contentLabel: "Paste your Figma file link or upload a .fig file",
    contentHint: "Use a shareable Figma file link for quick delivery, or upload a .fig or ZIP package for advanced buyers.",
    deliverySummary: "You can sell Figma templates as a live access link or as a downloadable source file.",
    categories: FIGMA_ASSET_CATEGORIES
  },
  adobe: {
    label: "Adobe",
    description: "Upload Photoshop, Illustrator, InDesign, Lightroom, Premiere Pro, or After Effects templates.",
    contentLabel: "Upload your Adobe design files",
    contentHint: "ZIP is recommended when the template includes fonts, linked images, or multiple source files.",
    deliverySummary: "File-based delivery is ideal for PSD, AI, INDD, preset packs, and bundled Adobe assets.",
    categories: [...ADOBE_APP_CATEGORIES, "Creative Cloud Bundles"] as const
  },
  other: {
    label: "Other",
    description: "Use this for PDF layouts, print-ready templates, poster packs, or generic editable design assets.",
    contentLabel: "Upload the template buyers should receive",
    contentHint: "Universal formats like ZIP, PDF, PNG, and JPG work well here, especially for print-ready products.",
    deliverySummary: "Use file delivery for universal template packs, posters, envelopes, and ready-made design kits.",
    categories: OTHER_ASSET_CATEGORIES
  }
} satisfies Record<(typeof TEMPLATE_TYPES)[number], { label: string; description: string; contentLabel: string; contentHint: string; deliverySummary: string; categories: readonly string[] }>;

const PRICING_OPTIONS = [
  {
    value: "free",
    label: "Free",
    description: "Let buyers claim the template at no cost. Great for audience growth and lead generation."
  },
  {
    value: "paid",
    label: "Paid",
    description: "Use one fixed price for every buyer. Best for premium templates and bundles."
  },
  {
    value: "pay_what_you_want",
    label: "Pay what you want",
    description: "Set a minimum amount and let buyers support with more if they want."
  }
] as const;

type UploadStepId = "template" | "content" | "details" | "thumbnail";
type TemplateType = (typeof TEMPLATE_TYPES)[number];

function getDefaultCategory(templateType: TemplateType) {
  return TEMPLATE_TYPE_CONTENT[templateType].categories[0];
}

function getDefaultDeliveryMode(templateType: TemplateType) {
  return templateType === "canva" ? "external_link" : templateType === "figma" ? "external_link" : "file";
}

export function UploadPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const [templateType, setTemplateType] = useState<TemplateType>("canva");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(getDefaultCategory("canva"));
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState("5");
  const [minimumPrice, setMinimumPrice] = useState("0");
  const [currency, setCurrency] = useState("GHS");
  const [pricingModel, setPricingModel] = useState<"free" | "paid" | "pay_what_you_want">("paid");
  const [deliveryMode, setDeliveryMode] = useState<"file" | "external_link">(getDefaultDeliveryMode("canva"));
  const [externalDeliveryUrl, setExternalDeliveryUrl] = useState("");
  const status: "published" = "published";
  const [mainFile, setMainFile] = useState<File[]>([]);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [activeStepId, setActiveStepId] = useState<UploadStepId>("template");

  const activeTemplate = TEMPLATE_TYPE_CONTENT[templateType];
  const categoryOptions = activeTemplate.categories as readonly string[];

  useEffect(() => {
    if (!categoryOptions.includes(category)) {
      setCategory(categoryOptions[0]);
    }

    const nextDeliveryMode = getDefaultDeliveryMode(templateType);
    if (templateType === "figma") {
      if (!["file", "external_link"].includes(deliveryMode)) {
        setDeliveryMode(nextDeliveryMode);
      }
    } else if (deliveryMode !== nextDeliveryMode) {
      setDeliveryMode(nextDeliveryMode);
    }

    if (templateType !== "figma" && nextDeliveryMode === "external_link") {
      setMainFile([]);
    }
    if (nextDeliveryMode === "file") {
      setExternalDeliveryUrl("");
    }
  }, [category, categoryOptions, deliveryMode, templateType]);

  const numericPrice = Number(price);
  const normalizedPrice = Number.isFinite(numericPrice) ? Math.max(numericPrice, 0) : 0;
  const numericMinimumPrice = Number(minimumPrice);
  const normalizedMinimumPrice = Number.isFinite(numericMinimumPrice) ? Math.max(numericMinimumPrice, 0) : 0;
  const estimatedBuyerSpend = pricingModel === "free" ? 0 : pricingModel === "pay_what_you_want" ? Math.max(normalizedPrice, normalizedMinimumPrice) : normalizedPrice;
  const estimatedCommission = estimatedBuyerSpend * PLATFORM_COMMISSION_RATE;
  const estimatedSellerNet = Math.max(estimatedBuyerSpend - estimatedCommission, 0);
  const requiresFile = deliveryMode === "file";
  const requiresLink = deliveryMode === "external_link";

  const steps = useMemo(
    () => [
      {
        id: "template" as const,
        title: "Template type",
        description: "Choose the design tool and delivery style for this listing.",
        done: Boolean(templateType && category && deliveryMode)
      },
      {
        id: "content" as const,
        title: "Content",
        description: "Paste the access link or upload the source file buyers should receive.",
        done: requiresLink ? Boolean(externalDeliveryUrl.trim()) : mainFile.length === 1
      },
      {
        id: "details" as const,
        title: "Metadata & pricing",
        description: "Add the title, story, pricing, and tags that sell the template.",
        done: Boolean(title.trim() && description.trim().length >= 10 && currency.trim())
      },
      {
        id: "thumbnail" as const,
        title: "Thumbnail",
        description: "Upload preview images so the listing looks strong in the marketplace.",
        done: previewFiles.length > 0
      }
    ],
    [category, currency, deliveryMode, description, externalDeliveryUrl, mainFile.length, previewFiles.length, templateType, title, requiresLink]
  );

  const activeStepIndex = steps.findIndex((step) => step.id === activeStepId);
  const safeActiveStepIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
  const activeStep = steps[safeActiveStepIndex];
  const isFirstStep = safeActiveStepIndex === 0;
  const isLastStep = safeActiveStepIndex === steps.length - 1;
  const controlToneClass =
    activeStep.id === "template"
      ? "upload-form-control upload-form-control-cobalt"
      : activeStep.id === "content"
        ? "upload-form-control upload-form-control-lagoon"
        : activeStep.id === "details"
          ? "upload-form-control upload-form-control-sunset"
          : "upload-form-control upload-form-control-cobalt";

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("You must be signed in");
      }

      if (requiresFile && mainFile.length !== 1) {
        throw new Error("Upload exactly one main template file for file-based delivery.");
      }

      if (requiresFile && mainFile[0].size > MAX_PRIMARY_ASSET_SIZE_BYTES) {
        throw new Error(
          `Primary file is too large (${formatFileSize(mainFile[0].size)}). Limit is ${formatFileSize(MAX_PRIMARY_ASSET_SIZE_BYTES)}.`
        );
      }

      if (previewFiles.length === 0) {
        throw new Error("Add at least one thumbnail or preview image before you publish.");
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
        template_type: templateType,
        category,
        tags,
        price,
        minimum_price: pricingModel === "paid" ? price : minimumPrice,
        currency,
        pricing_model: pricingModel,
        delivery_mode: deliveryMode,
        external_delivery_url: externalDeliveryUrl,
        status
      });

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid upload form");
      }

      return createAssetListing(user.id, parsed.data, requiresFile ? (mainFile[0] ?? null) : null, previewFiles);
    },
    onSuccess: ({ assetId }) => {
      pushToast("Template listing uploaded successfully", "success");
      navigate(`/asset/${assetId}`);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Upload failed", "error");
    }
  });

  function goToPreviousStep() {
    if (!isFirstStep) {
      setActiveStepId(steps[safeActiveStepIndex - 1].id);
    }
  }

  function goToNextStep() {
    if (!isLastStep) {
      setActiveStepId(steps[safeActiveStepIndex + 1].id);
    }
  }

  return (
    <div className="upload-shell space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Creator Studio</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">Upload Design Template</h1>
            <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
              Start with the template type, choose how buyers receive it, then finish the metadata and thumbnail before you publish.
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

        <section className="surface-card p-5 md:p-6">
          <div className="flex flex-col gap-2 border-b border-sand-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">{`Step ${safeActiveStepIndex + 1}`}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">{activeStep.title}</h2>
              <p className="mt-1 text-sm text-sand-600">{activeStep.description}</p>
            </div>

            <span className={`upload-step-state ${activeStep.done ? "upload-step-state-complete" : ""}`}>
              {activeStep.done ? "Ready" : "In progress"}
            </span>
          </div>

          <div className="mt-5 space-y-5">
            {activeStep.id === "template" ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {TEMPLATE_TYPES.map((option) => {
                    const config = TEMPLATE_TYPE_CONTENT[option];
                    return (
                      <ChoiceCard
                        key={option}
                        active={templateType === option}
                        label={config.label}
                        description={config.description}
                        onClick={() => setTemplateType(option)}
                      />
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),280px]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-700">Selected flow</p>
                      <h3 className="mt-2 font-display text-xl font-semibold text-ink">{activeTemplate.label} template setup</h3>
                      <p className="mt-2 text-sm text-sand-700">{activeTemplate.deliverySummary}</p>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-white bg-white/90 p-3">
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-sand-800">Marketplace lane</span>
                        <select
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          className={`w-full rounded-xl px-3 py-2 outline-none transition ${controlToneClass}`}
                        >
                          {categoryOptions.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>

                      {templateType === "figma" ? (
                        <div>
                          <p className="text-sm font-medium text-sand-800">Delivery style</p>
                          <div className="mt-2 grid gap-2">
                            <ChoiceCard
                              active={deliveryMode === "external_link"}
                              label="Figma file link"
                              description="Paste a shareable file link. Buyers open it after purchase."
                              onClick={() => {
                                setDeliveryMode("external_link");
                                setMainFile([]);
                              }}
                            />
                            <ChoiceCard
                              active={deliveryMode === "file"}
                              label="Upload .fig or ZIP"
                              description="Upload the file package directly for downloadable delivery."
                              onClick={() => {
                                setDeliveryMode("file");
                                setExternalDeliveryUrl("");
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-600">
                          Delivery is fixed to <span className="font-semibold text-ink">{deliveryMode === "external_link" ? "access link" : "file upload"}</span> for this template type.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {activeStep.id === "content" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-lagoon-100 bg-lagoon-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lagoon-700">Delivery setup</p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-ink">{activeTemplate.contentLabel}</h3>
                  <p className="mt-2 text-sm text-sand-700">{activeTemplate.contentHint}</p>
                </div>

                {requiresLink ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),260px]">
                    <Field
                      label={templateType === "canva" ? "Canva template link" : templateType === "figma" ? "Figma file link" : "Access link"}
                      value={externalDeliveryUrl}
                      onChange={setExternalDeliveryUrl}
                      type="url"
                      required
                      controlClassName={controlToneClass}
                    />
                    <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4 text-sm text-sand-700">
                      <p className="font-semibold text-ink">What buyers get</p>
                      <p className="mt-2">After checkout, buyers open the private link from their orders page instead of downloading a file package.</p>
                    </div>
                  </div>
                ) : (
                  <div className="upload-files-dropzone-card upload-files-dropzone-card-cobalt">
                    <UploadDropzone
                      label="Primary template file"
                      accept={PRIMARY_ASSET_ACCEPT}
                      files={mainFile}
                      onFilesChange={(files) => setMainFile(files.slice(0, 1))}
                      helperText={`One main file or ZIP package. Max ${formatFileSize(MAX_PRIMARY_ASSET_SIZE_BYTES)}.`}
                      badge="Required"
                      emptyStateHint="Attach the source file buyers receive after checkout."
                      tone="cobalt"
                    />
                  </div>
                )}
              </div>
            ) : null}

            {activeStep.id === "details" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Title" value={title} onChange={setTitle} required emphasizedLabel controlClassName={controlToneClass} />
                  <Field
                    label="Tags / use cases"
                    value={tags}
                    onChange={setTags}
                    controlClassName={controlToneClass}
                    helperText="Examples: flyer, church event, social media, business, wedding, fashion."
                  />
                </div>

                <Field label="Description" value={description} onChange={setDescription} multiline required controlClassName={controlToneClass} />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-sand-800">Monetization</p>
                    <p className="mt-1 text-xs text-sand-600">Choose whether this template is free, fixed-price, or pay-what-you-want.</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {PRICING_OPTIONS.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        active={pricingModel === option.value}
                        label={option.label}
                        description={option.description}
                        onClick={() => {
                          setPricingModel(option.value);
                          if (option.value === "free") {
                            setPrice("0");
                            setMinimumPrice("0");
                          }
                          if (option.value === "paid") {
                            setMinimumPrice(price || "0");
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field
                    label={pricingModel === "pay_what_you_want" ? "Suggested price" : "Price"}
                    type="number"
                    value={price}
                    onChange={(value) => {
                      setPrice(value);
                      if (pricingModel === "paid") {
                        setMinimumPrice(value);
                      }
                    }}
                    required
                    controlClassName={controlToneClass}
                    helperText={
                      pricingModel === "free"
                        ? "Set to 0 for free listings."
                        : pricingModel === "pay_what_you_want"
                          ? "This is the default amount buyers see first."
                          : "This is the fixed amount every buyer pays."
                    }
                  />

                  <Field
                    label="Minimum buyer amount"
                    type="number"
                    value={pricingModel === "paid" ? price : minimumPrice}
                    onChange={setMinimumPrice}
                    required
                    controlClassName={controlToneClass}
                    helperText={pricingModel === "paid" ? "For fixed pricing, this matches the listed price." : "Set the floor buyers must pay before checkout."}
                  />

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-sand-800">Currency</span>
                    <select
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className={`w-full rounded-xl px-3 py-2 outline-none transition ${controlToneClass}`}
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
                    At the current template price, Crib keeps a 10% marketplace commission on successful paid sales.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MetricTile label="Buyer pays" value={formatMajorCurrency(estimatedBuyerSpend, currency)} tone="cobalt" />
                    <MetricTile label="Platform fee" value={formatMajorCurrency(estimatedCommission, currency)} tone="sunset" />
                    <MetricTile label="You keep" value={formatMajorCurrency(estimatedSellerNet, currency)} tone="forest" />
                  </div>
                </div>
              </div>
            ) : null}

            {activeStep.id === "thumbnail" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-cobalt-100 bg-cobalt-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-700">Thumbnail first</p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-ink">Upload the visuals that sell the template</h3>
                  <p className="mt-2 text-sm text-sand-700">
                    Your first preview becomes the lead thumbnail buyers notice in the marketplace, so use your strongest mockup or cleanest cover image.
                  </p>
                </div>

                <div className="upload-files-dropzone-card upload-files-dropzone-card-lagoon">
                  <UploadDropzone
                    label="Thumbnail and preview images"
                    accept="image/*"
                    files={previewFiles}
                    onFilesChange={(files) => setPreviewFiles(files.slice(0, MAX_PREVIEW_FILES))}
                    multiple
                    helperText={`Required. Up to ${MAX_PREVIEW_FILES} images, ${formatFileSize(MAX_PREVIEW_FILE_SIZE_BYTES)} each.`}
                    badge="Required"
                    emptyStateHint="Upload the thumbnail buyers see first, then any extra previews that show pages, screens, or layers."
                    tone="lagoon"
                  />
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
                <button type="button" onClick={goToNextStep} className="upload-nav-button upload-nav-button-primary upload-nav-button-primary-template">
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="upload-nav-button upload-nav-button-primary upload-nav-button-primary-template disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadMutation.isPending ? "Saving..." : "Publish template"}
                </button>
              )}
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

function ChoiceCard({
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
    <button type="button" onClick={onClick} aria-pressed={active} className={`upload-status-card text-left ${active ? "upload-status-card-active" : ""}`}>
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
  controlClassName = "upload-form-control upload-form-control-cobalt",
  helperText
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  emphasizedLabel?: boolean;
  controlClassName?: string;
  helperText?: string;
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
      {helperText ? <p className="mt-2 text-xs text-sand-600">{helperText}</p> : null}
    </label>
  );
}


