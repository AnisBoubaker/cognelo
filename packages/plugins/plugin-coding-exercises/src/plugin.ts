import type { ActivityPlugin } from "@cognelo/activity-sdk";
import { codingExerciseConfigSchema } from "./coding-exercises";
import { codingExercisesDatabaseModule } from "./db";

export const codingExercisesPlugin: ActivityPlugin = {
  key: "coding-exercises",
  name: "Coding exercises",
  db: codingExercisesDatabaseModule,
  activities: [
    {
      key: "coding-exercise",
      name: "Coding exercise",
      description: "Students write a program from a prompt and run or submit it through a sandboxed remote execution service.",
      i18n: {
        en: {
          name: "Coding exercise",
          description: "Students write a program from a prompt and run or submit it through a sandboxed remote execution service.",
          defaultTitle: "Coding exercise"
        },
        fr: {
          name: "Exercice de programmation",
          description: "Les étudiants écrivent un programme à partir d'une consigne et l'exécutent ou le soumettent via un service d'exécution distant sandboxé.",
          defaultTitle: "Exercice de programmation"
        },
        zh: {
          name: "编程练习",
          description: "学生根据题目要求编写程序，并通过受沙箱保护的远程执行服务运行或提交。",
          defaultTitle: "编程练习"
        }
      },
      defaultConfig: {
        prompt: "Write a program that reads a name and prints `Hello, <name>!`.",
        language: "python",
        starterCode: "name = input().strip()\n# Write your solution below\n",
        sampleTests: [
          {
            id: "sample-1",
            input: "Ada",
            output: "Hello, Ada!",
            explanation: "The program should greet the provided name."
          }
        ],
        maxEditorSeconds: 1800
      },
      configSchema: codingExerciseConfigSchema
    }
  ]
};
