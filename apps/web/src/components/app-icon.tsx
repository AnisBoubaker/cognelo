import {
  IconBrandGithub,
  IconBrowser,
  IconChecklist,
  IconClipboardCheck,
  IconCode,
  IconFile,
  IconFileCheck,
  IconFileCode,
  IconFileText,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypePpt,
  IconFileTypeXls,
  IconFileZip,
  IconFolder,
  IconFolderOpen,
  IconLink,
  IconListCheck,
  IconMusic,
  IconPhoto,
  IconRoute,
  IconSquare,
  IconTextSize,
  IconTornado,
  IconVideo,
  type IconProps,
} from "@tabler/icons-react";
import type { ActivityIconName } from "@cognelo/activity-sdk";
import type { ContentTypeIconName } from "@cognelo/content-type-sdk";
import React, { type ComponentType } from "react";

export { ActionIcon as AppIcon, type ActionIconName as AppIconName } from "@cognelo/activity-ui";

export function DisclosureIndicator({ expanded }: { expanded: boolean }) {
  return <span className="disclosure-indicator" aria-hidden="true">{expanded ? "▾" : "▸"}</span>;
}

const activityIcons = {
  "browser-code": IconBrowser,
  checklist: IconChecklist,
  "clipboard-check": IconClipboardCheck,
  code: IconCode,
  "document-check": IconFileCheck,
  "file-code": IconFileCode,
  "list-check": IconListCheck,
  placeholder: IconSquare,
  tornado: IconTornado
} satisfies Record<ActivityIconName, ComponentType<IconProps>>;

export function ActivityTypeIcon({ iconName }: { iconName: ActivityIconName }) {
  const Icon = activityIcons[iconName] ?? IconSquare;
  return <span className="activity-type-icon" aria-hidden="true"><Icon size={28} stroke={1.8} /></span>;
}

const contentTypeIcons = {
  document: IconFile,
  file: IconFile,
  github: IconBrandGithub,
  link: IconLink,
  placeholder: IconSquare,
  text: IconTextSize
} satisfies Record<ContentTypeIconName, ComponentType<IconProps>>;

type FileMimeIconKind = "archive" | "audio" | "code" | "document" | "file" | "image" | "pdf" | "presentation" | "spreadsheet" | "text" | "video";

const fileMimeIcons = {
  archive: IconFileZip,
  audio: IconMusic,
  code: IconFileCode,
  document: IconFileTypeDoc,
  file: IconFile,
  image: IconPhoto,
  pdf: IconFileTypePdf,
  presentation: IconFileTypePpt,
  spreadsheet: IconFileTypeXls,
  text: IconFileText,
  video: IconVideo
} satisfies Record<FileMimeIconKind, ComponentType<IconProps>>;

export function fileIconKindForMimeType(mimeType?: string | null): FileMimeIconKind {
  const mime = mimeType?.toLowerCase().split(";", 1)[0].trim() ?? "";
  if (!mime || mime === "application/octet-stream") return "file";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("word") || mime.includes("opendocument.text") || mime === "application/rtf") return "document";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("opendocument.spreadsheet") || mime === "text/csv") return "spreadsheet";
  if (mime.includes("presentation") || mime.includes("powerpoint") || mime.includes("opendocument.presentation")) return "presentation";
  if (["application/zip", "application/gzip", "application/x-7z-compressed", "application/x-rar-compressed", "application/x-tar"].includes(mime)) return "archive";
  if (["application/json", "application/javascript", "application/typescript", "application/xml", "text/html", "text/css", "text/javascript"].includes(mime)) return "code";
  if (mime.startsWith("text/")) return "text";
  return "file";
}

export function ContentTypeIcon({ iconName, mimeType }: { iconName: ContentTypeIconName; mimeType?: string | null }) {
  const Icon = iconName === "file" ? fileMimeIcons[fileIconKindForMimeType(mimeType)] : contentTypeIcons[iconName] ?? IconFile;
  return <span className="activity-type-icon" aria-hidden="true"><Icon size={28} stroke={1.8} /></span>;
}

export function ActivityContentIcon() {
  return <span className="activity-type-icon activity-content-icon" aria-hidden="true"><IconRoute size={28} stroke={1.8} /></span>;
}

export function FolderContentIcon({ collapsed }: { collapsed: boolean }) {
  const Icon = collapsed ? IconFolder : IconFolderOpen;
  return <span className="activity-type-icon folder-content-icon" aria-hidden="true"><Icon size={28} stroke={1.8} /></span>;
}
