export type CodingExercisesLocale = "en" | "fr" | "zh";

type MessageKey =
  | "authoringTitle"
  | "title"
  | "description"
  | "language"
  | "prompt"
  | "generatePrompt"
  | "generatingPrompt"
  | "generatedPrompt"
  | "generatePromptDescriptionRequired"
  | "generatePromptError"
  | "replacePromptTitle"
  | "replacePromptMessage"
  | "keepCurrentPrompt"
  | "replaceCurrentPrompt"
  | "generateAssets"
  | "generatingAssets"
  | "generatedAssets"
  | "generateAssetsPromptRequired"
  | "generateAssetsError"
  | "replaceAssetsTitle"
  | "replaceAssetsMessage"
  | "keepCurrentAssets"
  | "replaceCurrentAssets"
  | "starterCode"
  | "referenceSolution"
  | "referenceSolutionHelp"
  | "templateSource"
  | "templateSourceHelp"
  | "templateSourceMissingMarker"
  | "templateTestCodeMissingMarker"
  | "templateVisibleLinesHelp"
  | "templateVisibleLine"
  | "lastValidationSummary"
  | "editorTimeLimit"
  | "visibleSampleTests"
  | "addSampleTest"
  | "remove"
  | "input"
  | "expectedOutput"
  | "testHarnessCode"
  | "testHarnessCodeHelp"
  | "visibleTestHarnessHelp"
  | "testTitle"
  | "hiddenTests"
  | "addHiddenTest"
  | "hiddenTestsHelp"
  | "name"
  | "stableId"
  | "enabled"
  | "weight"
  | "saving"
  | "saveCodingExercise"
  | "saved"
  | "sampleRun"
  | "sampleInput"
  | "runSampleTest"
  | "running"
  | "submitForGrading"
  | "submitting"
  | "latestSampleRun"
  | "latestSubmission"
  | "recentRuns"
  | "recentSubmissions"
  | "loadHiddenTestsError"
  | "loadHistoryError"
  | "saveError"
  | "runError"
  | "submitError"
  | "passed"
  | "failed"
  | "validationFailed"
  | "referenceSolutionFailedHiddenTest"
  | "compilerOutput"
  | "runtimeError"
  | "judgeMessage"
  | "programOutput"
  | "stdout"
  | "stderr"
  | "compileOutput"
  | "hiddenTestResults"
  | "test"
  | "statusPending"
  | "statusCompleted"
  | "statusFailed";

type MessageCatalog = Record<MessageKey, string>;

const messages: Record<CodingExercisesLocale, MessageCatalog> = {
  en: {
    authoringTitle: "Coding exercise authoring",
    title: "Title",
    description: "Description",
    language: "Language",
    prompt: "Prompt",
    generatePrompt: "Generate prompt automatically",
    generatingPrompt: "Generating prompt...",
    generatedPrompt: "Prompt generated.",
    generatePromptDescriptionRequired: "Add a more detailed description before generating a prompt.",
    generatePromptError: "Unable to generate a valid prompt right now.",
    replacePromptTitle: "Replace existing prompt?",
    replacePromptMessage: "Generating a new prompt will replace the current prompt.",
    keepCurrentPrompt: "Keep current prompt",
    replaceCurrentPrompt: "Replace prompt",
    generateAssets: "Generate solution and tests",
    generatingAssets: "Generating solution and tests...",
    generatedAssets: "Solution and tests generated.",
    generateAssetsPromptRequired: "Add a prompt before generating the solution and tests.",
    generateAssetsError: "Unable to generate a valid solution and tests right now.",
    replaceAssetsTitle: "Replace existing solution and tests?",
    replaceAssetsMessage: "Generating solution and tests will replace existing starter code, reference solution, template, visible tests, and hidden tests.",
    keepCurrentAssets: "Keep current content",
    replaceCurrentAssets: "Replace content",
    starterCode: "Starter code",
    referenceSolution: "Reference solution",
    referenceSolutionHelp: "Teacher-only answer key. Hidden tests are validated against this code before they are saved.",
    templateSource: "Template",
    templateSourceHelp: "Write the full scaffold here. Place {{ STUDENT_CODE }} where the student answer should be inserted, and optionally place {{ TEST_CODE }} where per-test harness code should run.",
    templateSourceMissingMarker: "The template must include {{ STUDENT_CODE }}.",
    templateTestCodeMissingMarker: "Add {{ TEST_CODE }} to the template before saving tests that include Test code.",
    templateVisibleLinesHelp: "Click the gutter markers to choose which scaffold lines stay visible and read-only for students. Unselected blocks are replaced with a hidden-code placeholder.",
    templateVisibleLine: "Toggle student-visible line {line}",
    lastValidationSummary: "Last validation: {passedCount}/{testCount} tests passed.",
    editorTimeLimit: "Editor time limit (seconds)",
    visibleSampleTests: "Visible sample tests",
    addSampleTest: "Add sample test",
    remove: "Remove",
    input: "Input",
    expectedOutput: "Expected output",
    testHarnessCode: "Test code",
    testHarnessCodeHelp: "Optional code for this test. If present, the template must include {{ TEST_CODE }}, and the code will be injected there.",
    visibleTestHarnessHelp: "Visible sample harness code. Students can inspect or adjust it for public sample runs.",
    testTitle: "Title",
    hiddenTests: "Hidden tests",
    addHiddenTest: "Add hidden test",
    hiddenTestsHelp: "Hidden tests are stored in plugin-owned tables and are not exposed to students.",
    name: "Name",
    stableId: "Stable id",
    enabled: "Enabled",
    weight: "Weight",
    saving: "Saving...",
    saveCodingExercise: "Save coding exercise",
    saved: "Coding exercise saved.",
    sampleRun: "Sample run",
    sampleInput: "Sample input",
    runSampleTest: "Run sample test",
    running: "Running...",
    submitForGrading: "Submit for grading",
    submitting: "Submitting...",
    latestSampleRun: "Latest sample run",
    latestSubmission: "Latest submission",
    recentRuns: "Recent runs",
    recentSubmissions: "Recent submissions",
    loadHiddenTestsError: "Unable to load hidden tests.",
    loadHistoryError: "Unable to load coding exercise history.",
    saveError: "Unable to save the coding exercise right now.",
    runError: "Unable to run code right now.",
    submitError: "Unable to submit code right now.",
    passed: "Passed",
    failed: "Failed",
    validationFailed: "Validation failed",
    referenceSolutionFailedHiddenTest: "The reference solution did not pass this test.",
    compilerOutput: "Compiler output",
    runtimeError: "Runtime error",
    judgeMessage: "Judge0 message",
    programOutput: "Program output",
    stdout: "Stdout",
    stderr: "Stderr",
    compileOutput: "Compile output",
    hiddenTestResults: "Hidden test results",
    test: "Test",
    statusPending: "pending",
    statusCompleted: "completed",
    statusFailed: "failed"
  },
  fr: {
    authoringTitle: "Configuration de l'exercice de programmation",
    title: "Titre",
    description: "Description",
    language: "Langage",
    prompt: "Consigne",
    generatePrompt: "Generer l'enonce automatiquement",
    generatingPrompt: "Generation de l'enonce...",
    generatedPrompt: "Enonce genere.",
    generatePromptDescriptionRequired: "Ajoutez une description plus detaillee avant de generer l'enonce.",
    generatePromptError: "Impossible de generer un enonce valide pour le moment.",
    replacePromptTitle: "Remplacer la consigne existante?",
    replacePromptMessage: "La generation d'une nouvelle consigne remplacera la consigne actuelle.",
    keepCurrentPrompt: "Conserver la consigne",
    replaceCurrentPrompt: "Remplacer la consigne",
    generateAssets: "Generer la solution et les tests",
    generatingAssets: "Generation de la solution et des tests...",
    generatedAssets: "Solution et tests generes.",
    generateAssetsPromptRequired: "Ajoutez une consigne avant de generer la solution et les tests.",
    generateAssetsError: "Impossible de generer une solution et des tests valides pour le moment.",
    replaceAssetsTitle: "Remplacer la solution et les tests existants?",
    replaceAssetsMessage: "La generation remplacera le code de depart, la solution de reference, le gabarit, les tests visibles et les tests caches existants.",
    keepCurrentAssets: "Conserver le contenu",
    replaceCurrentAssets: "Remplacer le contenu",
    starterCode: "Code de départ",
    referenceSolution: "Solution de référence",
    referenceSolutionHelp: "Corrigé réservé à l'enseignant. Les tests cachés sont validés avec ce code avant l'enregistrement.",
    templateSource: "Gabarit",
    templateSourceHelp: "Écrivez ici tout le gabarit. Placez {{ STUDENT_CODE }} là où la réponse étudiante doit être insérée et, au besoin, {{ TEST_CODE }} là où le code de harnais propre au test doit s’exécuter.",
    templateSourceMissingMarker: "Le gabarit doit contenir {{ STUDENT_CODE }}.",
    templateTestCodeMissingMarker: "Ajoutez {{ TEST_CODE }} au gabarit avant d’enregistrer des tests qui contiennent du code de test.",
    templateVisibleLinesHelp: "Cliquez sur les marqueurs dans la gouttière pour choisir quelles lignes du gabarit restent visibles et en lecture seule pour les étudiants. Les blocs non sélectionnés sont remplacés par un espace réservé de code caché.",
    templateVisibleLine: "Afficher ou masquer la ligne étudiante {line}",
    lastValidationSummary: "Dernière validation : {passedCount}/{testCount} tests réussis.",
    editorTimeLimit: "Limite de temps dans l'éditeur (secondes)",
    visibleSampleTests: "Tests d'exemple visibles",
    addSampleTest: "Ajouter un test d'exemple",
    remove: "Supprimer",
    input: "Entrée",
    expectedOutput: "Sortie attendue",
    testHarnessCode: "Code de test",
    testHarnessCodeHelp: "Code optionnel pour ce test. S’il est présent, le gabarit doit contenir {{ TEST_CODE }}, et ce code y sera injecté.",
    visibleTestHarnessHelp: "Code de harnais visible pour l'exemple. Les étudiants peuvent l'inspecter ou l'ajuster pour les exécutions publiques.",
    testTitle: "Titre",
    hiddenTests: "Tests cachés",
    addHiddenTest: "Ajouter un test caché",
    hiddenTestsHelp: "Les tests cachés sont stockés dans des tables propres au plugin et ne sont pas exposés aux étudiants.",
    name: "Nom",
    stableId: "Identifiant stable",
    enabled: "Activé",
    weight: "Poids",
    saving: "Enregistrement...",
    saveCodingExercise: "Enregistrer l'exercice",
    saved: "Exercice de programmation enregistré.",
    sampleRun: "Exécution d'exemple",
    sampleInput: "Entrée d'exemple",
    runSampleTest: "Exécuter le test d'exemple",
    running: "Exécution...",
    submitForGrading: "Soumettre pour évaluation",
    submitting: "Soumission...",
    latestSampleRun: "Dernière exécution d'exemple",
    latestSubmission: "Dernière soumission",
    recentRuns: "Exécutions récentes",
    recentSubmissions: "Soumissions récentes",
    loadHiddenTestsError: "Impossible de charger les tests cachés.",
    loadHistoryError: "Impossible de charger l'historique de l'exercice.",
    saveError: "Impossible d'enregistrer l'exercice pour le moment.",
    runError: "Impossible d'exécuter le code pour le moment.",
    submitError: "Impossible de soumettre le code pour le moment.",
    passed: "Réussi",
    failed: "Échoué",
    validationFailed: "Validation échouée",
    referenceSolutionFailedHiddenTest: "La solution de référence n'a pas réussi ce test.",
    compilerOutput: "Sortie du compilateur",
    runtimeError: "Erreur d'exécution",
    judgeMessage: "Message de Judge0",
    programOutput: "Sortie du programme",
    stdout: "Stdout",
    stderr: "Stderr",
    compileOutput: "Sortie de compilation",
    hiddenTestResults: "Résultats des tests cachés",
    test: "Test",
    statusPending: "en attente",
    statusCompleted: "terminé",
    statusFailed: "échoué"
  },
  zh: {
    authoringTitle: "编程练习设置",
    title: "标题",
    description: "说明",
    language: "语言",
    prompt: "题目",
    generatePrompt: "自动生成题目",
    generatingPrompt: "正在生成题目...",
    generatedPrompt: "题目已生成。",
    generatePromptDescriptionRequired: "请先添加更详细的说明再生成题目。",
    generatePromptError: "暂时无法生成有效题目。",
    replacePromptTitle: "替换现有题目？",
    replacePromptMessage: "生成新题目会替换当前题目。",
    keepCurrentPrompt: "保留当前题目",
    replaceCurrentPrompt: "替换题目",
    generateAssets: "生成答案和测试",
    generatingAssets: "正在生成答案和测试...",
    generatedAssets: "答案和测试已生成。",
    generateAssetsPromptRequired: "请先添加题目再生成答案和测试。",
    generateAssetsError: "暂时无法生成有效答案和测试。",
    replaceAssetsTitle: "替换现有答案和测试？",
    replaceAssetsMessage: "生成会替换现有起始代码、参考答案、模板、可见测试和隐藏测试。",
    keepCurrentAssets: "保留当前内容",
    replaceCurrentAssets: "替换内容",
    starterCode: "起始代码",
    referenceSolution: "参考答案",
    referenceSolutionHelp: "仅教师可见的答案。隐藏测试会先用这段代码验证，再保存。",
    templateSource: "模板",
    templateSourceHelp: "在这里编写完整脚手架。将 {{ STUDENT_CODE }} 放在应插入学生答案的位置，并可选地将 {{ TEST_CODE }} 放在每个测试脚手架代码应执行的位置。",
    templateSourceMissingMarker: "模板中必须包含 {{ STUDENT_CODE }}。",
    templateTestCodeMissingMarker: "如果测试包含测试代码，请先在模板中加入 {{ TEST_CODE }} 再保存。",
    templateVisibleLinesHelp: "点击左侧标记来选择哪些脚手架行会以只读方式显示给学生。未选中的连续代码块会被替换为隐藏代码占位符。",
    templateVisibleLine: "切换第 {line} 行是否对学生可见",
    lastValidationSummary: "最近一次验证：通过 {passedCount}/{testCount} 个测试。",
    editorTimeLimit: "编辑器时间限制（秒）",
    visibleSampleTests: "可见示例测试",
    addSampleTest: "添加示例测试",
    remove: "删除",
    input: "输入",
    expectedOutput: "期望输出",
    testHarnessCode: "测试代码",
    testHarnessCodeHelp: "此测试的可选代码。如需使用，模板必须包含 {{ TEST_CODE }}，并且该代码会注入到那里。",
    visibleTestHarnessHelp: "公开示例运行用的可见脚手架代码。学生可以查看或调整它。",
    testTitle: "标题",
    hiddenTests: "隐藏测试",
    addHiddenTest: "添加隐藏测试",
    hiddenTestsHelp: "隐藏测试保存在插件自有数据表中，不会暴露给学生。",
    name: "名称",
    stableId: "稳定标识",
    enabled: "启用",
    weight: "权重",
    saving: "保存中...",
    saveCodingExercise: "保存编程练习",
    saved: "编程练习已保存。",
    sampleRun: "示例运行",
    sampleInput: "示例输入",
    runSampleTest: "运行示例测试",
    running: "运行中...",
    submitForGrading: "提交评分",
    submitting: "提交中...",
    latestSampleRun: "最近一次示例运行",
    latestSubmission: "最近一次提交",
    recentRuns: "最近运行",
    recentSubmissions: "最近提交",
    loadHiddenTestsError: "无法加载隐藏测试。",
    loadHistoryError: "无法加载编程练习历史记录。",
    saveError: "暂时无法保存编程练习。",
    runError: "暂时无法运行代码。",
    submitError: "暂时无法提交代码。",
    passed: "通过",
    failed: "失败",
    validationFailed: "验证失败",
    referenceSolutionFailedHiddenTest: "参考答案未通过此测试。",
    compilerOutput: "编译输出",
    runtimeError: "运行时错误",
    judgeMessage: "Judge0 消息",
    programOutput: "程序输出",
    stdout: "标准输出",
    stderr: "标准错误",
    compileOutput: "编译输出",
    hiddenTestResults: "隐藏测试结果",
    test: "测试",
    statusPending: "进行中",
    statusCompleted: "已完成",
    statusFailed: "失败"
  }
};

export function normalizeCodingExercisesLocale(value?: string): CodingExercisesLocale {
  if (value === "fr" || value === "zh") {
    return value;
  }
  return "en";
}

export function formatCodingExercisesMessage(
  locale: CodingExercisesLocale,
  key: MessageKey,
  values?: Record<string, string | number>
) {
  let template = messages[locale][key];
  if (!values) {
    return template;
  }

  for (const [name, value] of Object.entries(values)) {
    template = template.replaceAll(`{${name}}`, String(value));
  }

  return template;
}
