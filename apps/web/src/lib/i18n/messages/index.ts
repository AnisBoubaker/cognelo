import type { Locale, MessageTree } from "../types";
import { arMessages } from "./ar";
import { enMessages } from "./en";
import { frMessages } from "./fr";
import { zhMessages } from "./zh";

export const messages: Record<Locale, MessageTree> = {
  en: enMessages,
  fr: frMessages,
  zh: zhMessages,
  ar: arMessages
};
