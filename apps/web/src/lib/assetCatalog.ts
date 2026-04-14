import type { Asset, AssetFile, AssetFileRole } from "@/lib/types";

type AssetCatalogInput = Pick<Asset, "category" | "files" | "delivery_mode">;
type AssetCatalogFile = Pick<AssetFile, "file_role" | "sort_order" | "original_name" | "file_type">;

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
  pdf: "PDF",
  mp3: "MP3",
  wav: "WAV",
  flp: "FLP",
  als: "ALS",
  logicx: "LOGICX",
  mus: "MUS",
  musx: "MUSX",
  mid: "MIDI",
  midi: "MIDI",
  cpr: "CPR",
  rpp: "RPP",
  ptx: "PTX",
  song: "SONG"
};

const FILE_ROLE_PRIORITY: Record<AssetFileRole, number> = {
  source_zip: 0,
  primary: 1,
  source_wav: 2,
  audio_preview: 3,
  project_file: 4,
  midi: 5,
  supporting: 6
};

const AUDIO_PROJECT_EXTENSIONS = ["flp", "als", "logicx", "mus", "musx", "cpr", "rpp", "ptx", "song"];

export function getAssetFileExtension(filename: string) {
  const normalized = filename.trim().toLowerCase();
  const match = /\.([a-z0-9]+)$/.exec(normalized);
  return match?.[1] ?? "";
}

export function isAudioAssetCategory(category: string) {
  return category.trim().toLowerCase() === "audio / beats";
}

export function isAudioAsset(asset: Pick<Asset, "category">) {
  return isAudioAssetCategory(asset.category);
}

export function sortAssetFiles<T extends { file_role?: AssetFileRole; sort_order?: number; original_name: string }>(files: readonly T[] = []) {
  return [...files].sort((left, right) => {
    const leftPriority = FILE_ROLE_PRIORITY[left.file_role ?? "primary"] ?? FILE_ROLE_PRIORITY.primary;
    const rightPriority = FILE_ROLE_PRIORITY[right.file_role ?? "primary"] ?? FILE_ROLE_PRIORITY.primary;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.original_name.localeCompare(right.original_name);
  });
}

function getPrimaryAssetFile(asset: Pick<Asset, "files">) {
  return sortAssetFiles(asset.files ?? [])[0];
}

export function getAssetPrimaryFilename(asset: Pick<Asset, "files">) {
  return getPrimaryAssetFile(asset)?.original_name ?? "";
}

export function getAssetFormatKey(asset: AssetCatalogInput) {
  const category = asset.category.toLowerCase();
  const extension = getAssetFileExtension(getAssetPrimaryFilename(asset));
  const fileType = getPrimaryAssetFile(asset)?.file_type?.toLowerCase() ?? "";

  if (
    isAudioAssetCategory(asset.category) ||
    ["mp3", "wav", "mid", "midi"].includes(extension) ||
    AUDIO_PROJECT_EXTENSIONS.includes(extension) ||
    fileType.startsWith("audio/")
  ) {
    return "audio";
  }

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
  if (asset.delivery_mode === "external_link") {
    return "link";
  }

  if (isAudioAssetCategory(asset.category) || getAssetFormatKey(asset) === "audio") {
    return "audio";
  }

  const category = asset.category.toLowerCase();
  const extension = getAssetFileExtension(getAssetPrimaryFilename(asset));
  const fileType = getPrimaryAssetFile(asset)?.file_type?.toLowerCase() ?? "";

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

  if (key === "audio") {
    return "FL Studio / Ableton / Logic";
  }

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

  if (key === "audio") {
    return "MP3 / WAV / STEMS";
  }

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
  if (asset.delivery_mode === "external_link") {
    const category = asset.category.toLowerCase();

    if (category.includes("figma")) {
      return "Figma file link";
    }

    if (category.includes("canva")) {
      return "Canva template link";
    }

    return "Private access link";
  }

  if (isAudioAssetCategory(asset.category)) {
    const sortedFiles = sortAssetFiles(asset.files ?? []);
    if (sortedFiles.some((file) => file.file_role === "source_zip")) {
      return "Audio bundle + downloads";
    }
    return "Multi-file audio pack";
  }

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

export function getAssetFileRoleLabel(file: AssetCatalogFile) {
  const extension = getAssetFileExtension(file.original_name);

  if (file.file_role === "audio_preview") {
    return "Audio Preview";
  }

  if (file.file_role === "source_wav") {
    return "WAV File";
  }

  if (file.file_role === "source_zip") {
    return "STEMS / Project ZIP";
  }

  if (file.file_role === "midi") {
    return "MIDI File";
  }

  if (file.file_role === "project_file") {
    if (extension === "flp") {
      return "FL Studio Project";
    }
    if (extension === "als") {
      return "Ableton Live Project";
    }
    if (extension === "logicx") {
      return "Logic Pro Project";
    }
    if (extension === "mus" || extension === "musx") {
      return "Finale Project";
    }
    if (extension && EXTENSION_LABELS[extension]) {
      return `${EXTENSION_LABELS[extension]} Project`;
    }
    return "Project File";
  }

  if (extension && EXTENSION_LABELS[extension]) {
    return EXTENSION_LABELS[extension];
  }

  return "Source File";
}
