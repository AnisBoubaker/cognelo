export const GENERIC_ACTIVITY_CATEGORY_ID = "generic";
export const ALL_ACTIVITY_CATEGORY_ID = "all";

export const ACTIVITY_CATEGORIES = [
  {
    id: GENERIC_ACTIVITY_CATEGORY_ID,
    labelKey: "activityCategories.generic"
  },
  {
    id: "programming",
    labelKey: "activityCategories.programming"
  },
  {
    id: "miscellaneous",
    labelKey: "activityCategories.miscellaneous"
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
