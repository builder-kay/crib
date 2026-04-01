import type { Asset } from "@/lib/types";

type AssetCatalogInput = Pick<Asset, "category" | "files">;

const EXTENSION_LABELS: Record<string, string> = {
  fig: "FIG",
  figjam: "FIGJAM",
  psd: "PSD",
  psb: "PSB",
  psdt: "PSDT",
  ai: "AI",
  eps: "EPS",
  ait: "AIT",
  indd: "INDD",
  indt: "INDT",
  idml: "IDML",
  xmp: "XMP",
  lrtemplate: "LRTEMPLATE",
  lrcat: "LRCAT",
  aep: "AEP",
  aet: "AET",
  mogrt: "MOGRT",
  prproj: "PRPROJ",
  prfpset: "PRFPSET",
  sketch: "SKETCH",
  xd: "XD",
  svg: "SVG",
  zip: "ZIP",
  pdf: "PDF"
};

export function getAssetPrimaryFilename(asset: Pick<Asset, "files">) {
  return asset.files?.[0]?.original_name ?? "";
}

export function getAssetFileExtension(filename: string) {
  const normalized = filename.trim().toLowerCase();
  const match = /\.([a-z0-9]+)$/.exec(normalized);
  return match?.[1] ?? "";
}

export function getAssetFormatKey(asset: AssetCatalogInput) {
  const category = asset.category.toLowerCase();
  const extension = getAssetFileExtension(getAssetPrimaryFilename(asset));
  const fileType = asset.files?.[0]?.file_type?.toLowerCase() ?? "";

  if (["fig", "figjam"].includes(extension) || category.includes("figma")) {
    return "figma";
  }

  if (["sketch", "xd"].includes(extension) || category.includes("canva")) {
    return "canva";
  }

  if (["psd", "psb", "psdt"].includes(extension) || category.includes("photoshop")) {
    return "photoshop";
  }

  if (["ai", "eps", "ait"].includes(extension) || category.includes("illustrator")) {
    return "illustrator";
  }

  if (["indd", "indt", "idml"].includes(extension) || category.includes("indesign")) {
    return "indesign";
  }

  if (["xmp", "lrtemplate", "lrcat", "dng"].includes(extension) || category.includes("lightroom")) {
    return "lightroom";
  }

  if (
    ["aep", "aet", "mogrt", "prproj", "prfpset"].includes(extension) ||
    category.includes("after effects") ||
    category.includes("premiere")
  ) {
    return "motion";
  }

  if (["zip", "pdf"].includes(extension) || fileType.includes("zip") || fileType.includes("pdf") || category.includes("bundle")) {
    return "bundle";
  }

  return "all";
}

export function getAssetFilterFileType(asset: AssetCatalogInput) {
  const category = asset.category.toLowerCase();
  const extension = getAssetFileExtension(getAssetPrimaryFilename(asset));
  const fileType = asset.files?.[0]?.file_type?.toLowerCase() ?? "";

  if (
    ["fig", "figjam", "psd", "psb", "psdt", "ai", "eps", "ait", "indd", "indt", "idml", "xmp", "lrtemplate", "lrcat", "sketch", "xd"].includes(
      extension
    ) ||
    category.includes("figma") ||
    category.includes("canva") ||
    category.includes("photoshop") ||
    category.includes("illustrator") ||
    category.includes("indesign") ||
    category.includes("lightroom")
  ) {
    return "editable";
  }

  if (
    ["aep", "aet", "mogrt", "prproj", "prfpset", "mp4", "mov"].includes(extension) ||
    category.includes("after effects") ||
    category.includes("premiere")
  ) {
    return "motion";
  }

  if (["zip"].includes(extension) || fileType.includes("zip") || category.includes("bundle")) {
    return "bundle";
  }

  if (["pdf", "doc", "docx", "ppt", "pptx"].includes(extension) || fileType.includes("pdf")) {
    return "document";
  }

  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(extension) || fileType.startsWith("image/")) {
    return "image";
  }

  return "all";
}

export function getAssetAppLabel(asset: AssetCatalogInput) {
  const key = getAssetFormatKey(asset);
  const category = asset.category.toLowerCase();

  if (key === "figma") {
    return "Figma";
  }

  if (key === "canva") {
    return "Canva";
  }

  if (key === "photoshop") {
    return "Photoshop";
  }

  if (key === "illustrator") {
    return "Illustrator";
  }

  if (key === "indesign") {
    return "InDesign";
  }

  if (key === "lightroom") {
    return "Lightroom";
  }

  if (category.includes("premiere")) {
    return "Premiere Pro";
  }

  if (category.includes("after effects")) {
    return "After Effects";
  }

  if (key === "motion") {
    return "Premiere Pro / After Effects";
  }

  if (key === "bundle") {
    return "Template Bundle";
  }

  return "Creative App";
}

export function getAssetFormatLabel(asset: AssetCatalogInput) {
  const extension = getAssetFileExtension(getAssetPrimaryFilename(asset));

  if (extension && EXTENSION_LABELS[extension]) {
    return EXTENSION_LABELS[extension];
  }

  const key = getAssetFormatKey(asset);

  if (key === "figma") {
    return "FIG / FIGJAM";
  }

  if (key === "canva") {
    return "Canva / editable design";
  }

  if (key === "photoshop") {
    return "PSD / PSB / PSDT";
  }

  if (key === "illustrator") {
    return "AI / EPS / AIT";
  }

  if (key === "indesign") {
    return "INDD / IDML / INDT";
  }

  if (key === "lightroom") {
    return "XMP / LRTEMPLATE";
  }

  if (key === "motion") {
    return "AEP / PRPROJ / MOGRT";
  }

  if (key === "bundle") {
    return "ZIP / PDF";
  }

  return "Template files";
}

export function getAssetDeliveryLabel(asset: AssetCatalogInput) {
  const extension = getAssetFileExtension(getAssetPrimaryFilename(asset));

  if (extension === "zip") {
    return "ZIP package";
  }

  if (extension === "pdf") {
    return "PDF download";
  }

  if (extension && EXTENSION_LABELS[extension]) {
    return `${EXTENSION_LABELS[extension]} source file`;
  }

  if (getAssetFormatKey(asset) === "figma") {
    return "Figma source file";
  }

  if (getAssetFormatKey(asset) === "canva") {
    return "Editable template";
  }

  if (getAssetFormatKey(asset) === "bundle") {
    return "Multi-file bundle";
  }

  return "Instant download";
}
