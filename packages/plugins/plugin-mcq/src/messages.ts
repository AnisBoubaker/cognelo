export type McqLocale = "en" | "fr" | "zh" | "ar";

const mcqManualGradingMessages = {
  en: {
    question: "Question {number}",
    studentAnswer: "Student answer",
    points: "Points: {score} / {max}",
    correct: "Correct",
    incorrect: "Incorrect",
    missedCorrectAnswer: "Missed correct answer",
    invalidQuestionScore: "Enter a valid score for each question."
  },
  fr: {
    question: "Question {number}",
    studentAnswer: "Réponse de l'étudiant",
    points: "Points : {score} / {max}",
    correct: "Correct",
    incorrect: "Incorrect",
    missedCorrectAnswer: "Réponse correcte manquée",
    invalidQuestionScore: "Entrez une note valide pour chaque question."
  },
  zh: {
    question: "第 {number} 题",
    studentAnswer: "学生答案",
    points: "得分：{score} / {max}",
    correct: "正确",
    incorrect: "错误",
    missedCorrectAnswer: "漏选的正确答案",
    invalidQuestionScore: "请为每道题输入有效分数。"
  },
  ar: {
    question: "السؤال {number}",
    studentAnswer: "إجابة الطالب",
    points: "النقاط: {score} / {max}",
    correct: "صحيح",
    incorrect: "غير صحيح",
    missedCorrectAnswer: "إجابة صحيحة فائتة",
    invalidQuestionScore: "أدخل درجة صالحة لكل سؤال."
  }
} as const;

export function getMcqManualGradingCopy(locale: McqLocale = "en") {
  return mcqManualGradingMessages[locale] ?? mcqManualGradingMessages.en;
}

