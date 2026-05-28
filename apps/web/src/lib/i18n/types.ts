export const locales = ["en", "fr", "zh", "ar"] as const;
export type Locale = (typeof locales)[number];

export type MessageTree = {
  [key: string]: string | MessageTree;
};
