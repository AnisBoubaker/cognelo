import type { CodingHomeworkLocale } from "./messages";
const en = {
  title: "How to complete this homework", twoStages: "This homework has two stages. Submit your program files first, then answer challenge questions about your work. Your homework is complete only after both stages are submitted.",
  filesOnly: "Submit your program files to complete this homework. No challenge questions are required.", files: "Submit your work", questions: "Answer challenge questions", complete: "Both stages have been submitted. Your homework is complete.",
  available: "Available", submitted: "Submitted", waiting: "Waiting for teacher", next: "After you submit your work", generating: "Preparing questions", ready: "Ready to answer", active: "Answering in progress", done: "Done", closed: "Deadline passed", team: "Join a team first", failed: "Needs attention",
  fileHelp: "Upload your files, check your submission, then submit your work. Checking files alone does not submit them.",
  questionsHelp: "Answer the questions about the files you submitted, then submit your answers.",
  timeAllowed: "Time allowed", upTo: "Up to {duration}", fileStarts: "The file-submission time limit starts with your first upload while this stage is active. An earlier deadline still applies.",
  fileStartsOnActivation: "For files already prepared, this time limit starts when your teacher activates the stage; otherwise it starts with your first upload after activation.",
  fileStarted: "Your file-submission time limit has started. Submit before the closing time shown.",
  timerStarts: "Your answering timer starts only when you choose “Answer challenge questions”. Waiting for questions uses none of this time. An earlier deadline still applies.",
  timerRunning: "Your answering timer is already running. Returning to this page does not restart it.", answersDue: "Submit answers by", fileCloses: "Submit files no later than",
  sebRequired: "Safe Exam Browser is required for the answering stage.", continue: "Continue answering",
  frozenTwoStages: "Once submitted, the work cannot be changed. You must also answer challenge questions when they become available.",
  frozenFilesOnly: "Once submitted, the work cannot be changed. This completes your submission; no challenge questions are required."
};
const fr: typeof en = {
  title: "Comment terminer ce devoir", twoStages: "Ce devoir comporte deux étapes. Remettez d’abord vos fichiers de programme, puis répondez aux questions de vérification sur votre travail. Le devoir est terminé seulement après la remise des deux étapes.",
  filesOnly: "Remettez vos fichiers de programme pour terminer ce devoir. Aucune question de vérification n’est requise.", files: "Remettre votre travail", questions: "Répondre aux questions de vérification", complete: "Les deux étapes ont été remises. Votre devoir est terminé.",
  available: "Disponible", submitted: "Remis", waiting: "En attente de l’enseignant", next: "Après la remise de votre travail", generating: "Préparation des questions", ready: "Prêt à répondre", active: "Réponses en cours", done: "Terminé", closed: "Échéance dépassée", team: "Rejoignez d’abord une équipe", failed: "Intervention nécessaire",
  fileHelp: "Téléversez vos fichiers, vérifiez la remise, puis remettez votre travail. Vérifier les fichiers ne les remet pas.", questionsHelp: "Répondez aux questions sur les fichiers remis, puis remettez vos réponses.",
  timeAllowed: "Temps accordé", upTo: "Au maximum {duration}", fileStarts: "Le temps de remise des fichiers commence au premier téléversement lorsque cette étape est active. Une échéance plus rapprochée reste prioritaire.",
  fileStartsOnActivation: "Si des fichiers sont déjà préparés, le temps commence à l’activation de l’étape par l’enseignant; sinon, au premier téléversement après l’activation.", fileStarted: "Le temps de remise des fichiers a commencé. Remettez-les avant la fermeture indiquée.",
  timerStarts: "Le temps de réponse commence seulement lorsque vous choisissez « Répondre aux questions de vérification ». L’attente des questions ne consomme pas ce temps. Une échéance plus rapprochée reste prioritaire.", timerRunning: "Votre temps de réponse est déjà commencé. Revenir sur cette page ne le remet pas à zéro.", answersDue: "Remettre les réponses avant le", fileCloses: "Remettre les fichiers au plus tard le",
  sebRequired: "Safe Exam Browser est requis pour l’étape de réponse aux questions.", continue: "Continuer à répondre",
  frozenTwoStages: "Une fois remis, le travail ne pourra plus être modifié. Vous devrez aussi répondre aux questions de vérification lorsqu’elles seront disponibles.", frozenFilesOnly: "Une fois remis, le travail ne pourra plus être modifié. Cette remise termine votre devoir; aucune question de vérification n’est requise."
};
const zh: typeof en = {
  title: "如何完成此作业", twoStages: "此作业包含两个阶段：先提交程序文件，再回答有关你所提交作业的验证问题。提交两个阶段后，作业才算完成。", filesOnly: "提交程序文件即可完成此作业。无需回答验证问题。", files: "提交作业", questions: "回答验证问题", complete: "两个阶段均已提交。作业已完成。",
  available: "可提交", submitted: "已提交", waiting: "等待教师开放", next: "提交作业后进行", generating: "正在准备问题", ready: "可以开始作答", active: "正在作答", done: "已完成", closed: "截止时间已过", team: "请先加入团队", failed: "需要处理",
  fileHelp: "上传文件，检查提交，然后提交作业。仅检查文件不会提交作业。", questionsHelp: "回答有关已提交文件的问题，然后提交答案。", timeAllowed: "允许的时长", upTo: "最多 {duration}", fileStarts: "此阶段开放后，首次上传文件时开始计时。如有更早的截止时间，以其为准。", fileStartsOnActivation: "如果已准备好文件，教师开放此阶段时开始计时；否则，在开放后首次上传时开始计时。", fileStarted: "文件提交已开始计时。请在所示的关闭时间前提交。",
  timerStarts: "仅在选择“回答验证问题”后开始作答计时。等待问题不会消耗作答时间。如有更早的截止时间，以其为准。", timerRunning: "作答已经开始计时。返回此页面不会重新计时。", answersDue: "答案提交截止时间", fileCloses: "最晚文件提交时间", sebRequired: "作答阶段必须使用 Safe Exam Browser。", continue: "继续作答", frozenTwoStages: "提交后无法修改作业。问题可用时，你还必须回答验证问题。", frozenFilesOnly: "提交后无法修改作业。本次提交即完成作业，无需回答验证问题。"
};
const ar: typeof en = {
  title: "كيفية إكمال هذا الواجب", twoStages: "يتكون هذا الواجب من مرحلتين. سلّم ملفات برنامجك أولاً، ثم أجب عن أسئلة التحقق المتعلقة بعملك. يكتمل الواجب بعد تسليم المرحلتين.", filesOnly: "سلّم ملفات برنامجك لإكمال هذا الواجب. لا توجد أسئلة تحقق مطلوبة.", files: "تسليم عملك", questions: "الإجابة عن أسئلة التحقق", complete: "تم تسليم المرحلتين. اكتمل واجبك.",
  available: "متاح", submitted: "تم التسليم", waiting: "بانتظار المعلم", next: "بعد تسليم عملك", generating: "جارٍ تحضير الأسئلة", ready: "جاهز للإجابة", active: "الإجابة جارية", done: "مكتمل", closed: "انقضى الموعد النهائي", team: "انضم إلى فريق أولاً", failed: "تحتاج إلى متابعة",
  fileHelp: "ارفع ملفاتك وافحص التسليم ثم سلّم عملك. فحص الملفات وحده لا يسلّمها.", questionsHelp: "أجب عن الأسئلة المتعلقة بالملفات المسلّمة، ثم سلّم إجاباتك.", timeAllowed: "الوقت المتاح", upTo: "بحد أقصى {duration}", fileStarts: "يبدأ وقت تسليم الملفات عند أول رفع أثناء تفعيل المرحلة. يظل أي موعد نهائي أقرب سارياً.", fileStartsOnActivation: "إذا كانت الملفات جاهزة، يبدأ الوقت عندما يفعّل المعلم المرحلة؛ وإلا يبدأ عند أول رفع بعد التفعيل.", fileStarted: "بدأ وقت تسليم الملفات. سلّم قبل وقت الإغلاق المعروض.", timerStarts: "يبدأ وقت الإجابة فقط عند اختيار «الإجابة عن أسئلة التحقق». انتظار الأسئلة لا يستهلك هذا الوقت. يظل أي موعد نهائي أقرب سارياً.", timerRunning: "وقت الإجابة جارٍ بالفعل. العودة إلى هذه الصفحة لا تعيد تشغيله.", answersDue: "تسليم الإجابات قبل", fileCloses: "آخر وقت لتسليم الملفات", sebRequired: "يلزم Safe Exam Browser لمرحلة الإجابة.", continue: "متابعة الإجابة", frozenTwoStages: "لا يمكن تعديل العمل بعد تسليمه. يجب أيضاً الإجابة عن أسئلة التحقق عندما تصبح متاحة.", frozenFilesOnly: "لا يمكن تعديل العمل بعد تسليمه. يُكمل هذا التسليم واجبك؛ لا توجد أسئلة تحقق مطلوبة."
};
export const submissionGuideCopy = (locale: CodingHomeworkLocale) => ({ en, fr, zh, ar })[locale] ?? en;
