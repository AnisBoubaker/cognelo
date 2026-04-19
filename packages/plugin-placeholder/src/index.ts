import type { ActivityPlugin } from "@cognara/activity-sdk";

export const placeholderPlugin: ActivityPlugin = {
  key: "placeholder",
  name: "Placeholder activity",
  db: {
    namespace: "plugin_placeholder",
    tables: [],
    notes: ["This plugin currently relies only on core activity records and does not need plugin-owned tables."]
  },
  activities: [
    {
      key: "placeholder",
      name: "Placeholder activity",
      description: "A generic shell used while a pedagogical activity is being designed.",
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
