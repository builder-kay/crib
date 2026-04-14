export const MAX_PRIMARY_ASSET_SIZE_BYTES = 512 * 1024 * 1024; // 512 MB
export const MAX_PREVIEW_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_PROFILE_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PREVIEW_FILES = 8;
export const MAX_AUDIO_PREVIEW_FILE_SIZE_BYTES = MAX_PREVIEW_FILE_SIZE_BYTES; // 20 MB public preview copy
export const MAX_AUDIO_WAV_FILE_SIZE_BYTES = MAX_PRIMARY_ASSET_SIZE_BYTES; // 512 MB
export const MAX_AUDIO_BUNDLE_FILE_SIZE_BYTES = MAX_PRIMARY_ASSET_SIZE_BYTES; // 512 MB
export const MAX_AUDIO_EXTRA_FILE_SIZE_BYTES = MAX_PRIMARY_ASSET_SIZE_BYTES; // 512 MB

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function looksLikeUploadSizeError(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("exceeded upload size") ||
    normalized.includes("exceeded the maximum allowed size") ||
    normalized.includes("maximum allowed size") ||
    normalized.includes("request body is too large") ||
    normalized.includes("payload too large") ||
    normalized.includes("entity too large") ||
    normalized.includes("file too large") ||
    normalized.includes("status code 413") ||
    normalized.includes("413")
  );
}
