export type PluginLocale = "en" | "fr" | "zh" | "ar";

export const GENERIC_ACTIVITY_CATEGORY_ID = "generic";
export const ALL_ACTIVITY_CATEGORY_ID = "all";

export const ACTIVITY_CATEGORIES = [
  {
    id: GENERIC_ACTIVITY_CATEGORY_ID,
    i18n: {
      en: "Generic",
      fr: "Générique",
      zh: "通用",
      ar: "عام"
    }
  },
  {
    id: "programming",
    i18n: {
      en: "Programming",
      fr: "Programmation",
      zh: "编程",
      ar: "برمجة"
    }
  },
  {
    id: "miscellaneous",
    i18n: {
      en: "Miscellaneous",
      fr: "Divers",
      zh: "其他",
      ar: "متفرقات"
    }
  }
] as const;

export type ActivityCategoryId = (typeof ACTIVITY_CATEGORIES)[number]["id"];
export type ActivityCategoryAssignment = readonly string[];

type ActivityCategoryOwner = {
  defaultCategoryIds?: ActivityCategoryAssignment;
};

export function listActivityCategories() {
  return [...ACTIVITY_CATEGORIES];
}

export function getActivityCategoryMessages(category: { i18n: Partial<Record<PluginLocale, string>> }, locale: PluginLocale) {
  return category.i18n[locale] ?? category.i18n.en ?? "";
}

export function isKnownActivityCategoryId(categoryId: string): categoryId is ActivityCategoryId {
  return ACTIVITY_CATEGORIES.some((category) => category.id === categoryId);
}

export function hasAllActivityCategoryAssignment(definition?: ActivityCategoryOwner) {
  return definition?.defaultCategoryIds?.includes(ALL_ACTIVITY_CATEGORY_ID) ?? false;
}

export function getActivityHomeCategoryIds(definition?: ActivityCategoryOwner): ActivityCategoryId[] {
  const explicitCategoryIds = definition?.defaultCategoryIds?.filter((categoryId) => categoryId !== ALL_ACTIVITY_CATEGORY_ID) ?? [];
  const knownCategoryIds = explicitCategoryIds.filter(isKnownActivityCategoryId);
  return knownCategoryIds.length ? knownCategoryIds : [GENERIC_ACTIVITY_CATEGORY_ID];
}

export function activityDefinitionCreatesCategory(definition: ActivityCategoryOwner | undefined, categoryId: ActivityCategoryId) {
  return getActivityHomeCategoryIds(definition).includes(categoryId);
}

export function activityDefinitionBelongsToCategory(definition: ActivityCategoryOwner | undefined, categoryId: ActivityCategoryId) {
  return activityDefinitionCreatesCategory(definition, categoryId) || hasAllActivityCategoryAssignment(definition);
}
