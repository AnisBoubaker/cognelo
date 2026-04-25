import type { ActivityPlugin } from "@cognelo/activity-sdk";
import { webDesignCodingExercisesDatabaseModule } from "./db";
import { defaultWebDesignExerciseConfig, webDesignExerciseConfigSchema } from "./web-design-coding-exercises";

export const webDesignCodingExercisesPlugin: ActivityPlugin = {
  key: "web-design-coding-exercises",
  name: "Web design coding exercises",
  db: webDesignCodingExercisesDatabaseModule,
  activities: [
    {
      key: "web-design-coding-exercise",
      name: "Web design coding exercise",
      description: "Students edit HTML, CSS, and JavaScript files with a live sandboxed browser preview.",
      i18n: {
        en: {
          name: "Web design coding exercise",
          description: "Students edit HTML, CSS, and JavaScript files with a live sandboxed browser preview.",
          defaultTitle: "Web design coding exercise"
        },
        fr: {
          name: "Exercice de conception web",
          description: "Les etudiants modifient des fichiers HTML, CSS et JavaScript avec un apercu navigateur sandboxe en direct.",
          defaultTitle: "Exercice de conception web"
        },
        zh: {
          name: "网页设计编程练习",
          description: "学生编辑 HTML、CSS 和 JavaScript 文件，并在受沙箱保护的浏览器预览中即时查看结果。",
          defaultTitle: "网页设计编程练习"
        }
      },
      defaultConfig: defaultWebDesignExerciseConfig,
      configSchema: webDesignExerciseConfigSchema
    }
  ]
};
