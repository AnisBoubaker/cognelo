import type { MaterialKind } from "./api";

export type PickerMaterialKind = Extract<MaterialKind, "file" | "github_repo" | "text">;
export type MaterialTypeIconName = "file" | "github" | "text";
export type MaterialEmbeddingSource = "file_upload" | "text_body" | "external_url";

export type MaterialTypeDefinition = {
  kind: PickerMaterialKind;
  labelKey: string;
  descriptionKey: string;
  defaultTitleKey: string;
  icon: MaterialTypeIconName;
  createMode: "shell" | "upload";
  embeddingSource: MaterialEmbeddingSource;
};

export const materialTypeDefinitions: MaterialTypeDefinition[] = [
  {
    kind: "github_repo",
    labelKey: "materialKinds.github_repo",
    descriptionKey: "courseDetail.materialTypeGithubDescription",
    defaultTitleKey: "courseDetail.defaultRepoTitle",
    icon: "github",
    createMode: "shell",
    embeddingSource: "external_url"
  },
  {
    kind: "file",
    labelKey: "materialKinds.file",
    descriptionKey: "courseDetail.materialTypeFileDescription",
    defaultTitleKey: "courseDetail.defaultFileTitle",
    icon: "file",
    createMode: "upload",
    embeddingSource: "file_upload"
  },
  {
    kind: "text",
    labelKey: "materialKinds.text",
    descriptionKey: "courseDetail.materialTypeTextDescription",
    defaultTitleKey: "courseDetail.defaultTextTitle",
    icon: "text",
    createMode: "shell",
    embeddingSource: "text_body"
  }
];

export function materialTypeByKind(kind: MaterialKind | null | undefined) {
  return materialTypeDefinitions.find((definition) => definition.kind === kind) ?? null;
}

export function materialIconName(kind: MaterialKind | string | null | undefined): MaterialTypeIconName {
  return materialTypeByKind(kind as MaterialKind | null | undefined)?.icon ?? "file";
}
