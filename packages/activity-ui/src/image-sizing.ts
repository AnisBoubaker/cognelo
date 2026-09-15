export type MarkdownImageSizeMode = "pixels" | "original-percent" | "container-percent";

export type MarkdownImageSize = {
  mode: MarkdownImageSizeMode;
  originalWidth: number | null;
  value: number;
};

const imageSizeFragmentKey = "cognelo-size";

export function readMarkdownImageSize(source: string): MarkdownImageSize | null {
  const fragment = source.slice(Math.max(0, source.indexOf("#") + 1));
  if (!source.includes("#") || !fragment) return null;
  const encoded = new URLSearchParams(fragment).get(imageSizeFragmentKey);
  if (!encoded) return null;
  const [kind, rawValue, rawOriginalWidth] = encoded.split(":");
  const value = Number(rawValue);
  const originalWidth = Number(rawOriginalWidth);

  if (kind === "px" && Number.isInteger(value) && value >= 1 && value <= 10000) {
    return { mode: "pixels", originalWidth: null, value };
  }
  if (kind === "original" && value >= 1 && value <= 500 && Number.isInteger(originalWidth) && originalWidth >= 1) {
    return { mode: "original-percent", originalWidth, value };
  }
  if (kind === "container" && value >= 1 && value <= 100) {
    return { mode: "container-percent", originalWidth: null, value };
  }
  return null;
}

export function writeMarkdownImageSize(source: string, size: MarkdownImageSize) {
  const hashIndex = source.indexOf("#");
  const base = hashIndex >= 0 ? source.slice(0, hashIndex) : source;
  const fragment = hashIndex >= 0 ? source.slice(hashIndex + 1) : "";
  const params = new URLSearchParams(fragment);
  params.set(imageSizeFragmentKey, serializeImageSize(size));
  return `${base}#${params.toString().replace(/%3A/gi, ":")}`;
}

export function markdownImageWidth(size: MarkdownImageSize | null) {
  if (!size) return null;
  if (size.mode === "pixels") return `${size.value}px`;
  if (size.mode === "container-percent") return `${size.value}%`;
  if (!size.originalWidth) return null;
  return `${Math.max(1, Math.round(size.originalWidth * size.value / 100))}px`;
}

function serializeImageSize(size: MarkdownImageSize) {
  if (size.mode === "pixels") return `px:${Math.round(size.value)}`;
  if (size.mode === "container-percent") return `container:${normalizedDecimal(size.value)}`;
  if (!size.originalWidth) throw new Error("The original image width is required for relative sizing.");
  return `original:${normalizedDecimal(size.value)}:${Math.round(size.originalWidth)}`;
}

function normalizedDecimal(value: number) {
  return String(Math.round(value * 10) / 10);
}
