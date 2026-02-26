const POPULAR_AUDIO_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".aac",
  ".wav",
  ".flac",
  ".ogg",
  ".opus",
  ".mp4",
  ".aif",
  ".aiff",
  ".alac",
  ".wma",
] as const;

const FALLBACK_MIME_TYPES_WITH_EXTENSION_CHECK = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "video/mp4",
]);

const POPULAR_AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-aac",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "audio/aiff",
  "audio/x-aiff",
  "audio/wma",
  "audio/x-ms-wma",
]);

const POPULAR_AUDIO_EXTENSION_SET = new Set<string>(POPULAR_AUDIO_EXTENSIONS);

function getLowerCaseExtension(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex < 0) {
    return "";
  }

  return fileName.slice(extensionIndex).toLowerCase();
}

export function isSupportedAudioUploadType(file: {
  name: string;
  type: string;
}): boolean {
  const mimeType = file.type.trim().toLowerCase();
  const extension = getLowerCaseExtension(file.name);
  const hasSupportedExtension = POPULAR_AUDIO_EXTENSION_SET.has(extension);

  if (POPULAR_AUDIO_MIME_TYPES.has(mimeType) || mimeType.startsWith("audio/")) {
    return true;
  }

  if (!hasSupportedExtension) {
    return false;
  }

  if (!mimeType) {
    return true;
  }

  return FALLBACK_MIME_TYPES_WITH_EXTENSION_CHECK.has(mimeType);
}

export const SUPPORTED_AUDIO_UPLOAD_EXTENSIONS = [...POPULAR_AUDIO_EXTENSIONS];

export const SUPPORTED_AUDIO_UPLOAD_FORMATS_LABEL =
  SUPPORTED_AUDIO_UPLOAD_EXTENSIONS.map((extension) =>
    extension.slice(1).toUpperCase(),
  ).join(", ");

export const AUDIO_UPLOAD_ACCEPT = [
  "audio/*",
  ...POPULAR_AUDIO_EXTENSIONS,
].join(",");
