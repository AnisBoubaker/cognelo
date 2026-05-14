import type { ActivityPlugin } from "@cognelo/activity-sdk";
import { placeholderDatabaseModule } from "./db";

export const placeholderPlugin: ActivityPlugin = {
  key: "placeholder",
  packageName: "@cognelo/plugin-placeholder",
  name: "Placeholder activity",
  db: placeholderDatabaseModule,
  activities: [
    {
      key: "placeholder",
      name: "Placeholder activity",
      description: "A generic shell used while a pedagogical activity is being designed.",
      defaultCategoryIds: ["miscellaneous"],
      icon: "placeholder",
      i18n: {
        en: {
          name: "Placeholder activity",
          description: "A generic shell used while a pedagogical activity is being designed.",
          defaultTitle: "Placeholder activity"
        },
        fr: {
          name: "Activité provisoire",
          description: "Une structure générique utilisée pendant la conception d'une activité pédagogique.",
          defaultTitle: "Activité provisoire"
        },
        zh: {
          name: "占位活动",
          description: "用于设计教学活动时的通用占位结构。",
          defaultTitle: "占位活动"
        }
      },
      defaultConfig: {}
    }
  ]
};
