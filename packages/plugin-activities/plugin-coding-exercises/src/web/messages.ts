export type CodingExercisesLocale = "en" | "fr" | "zh" | "ar";
type CodingExercisesMessageLocale = Exclude<CodingExercisesLocale, "ar">;

type MessageKey =
  | "authoringTitle"
  | "title"
  | "description"
  | "language"
  | "chooseLanguage"
  | "languageRequired"
  | "loadLanguagesError"
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
  | "generateSolution"
  | "generatingSolution"
  | "generatedSolution"
  | "generateSolutionPromptRequired"
  | "generateSolutionError"
  | "replaceSolutionTitle"
  | "replaceSolutionMessage"
  | "keepCurrentSolution"
  | "replaceCurrentSolution"
  | "generateRubric"
  | "generatingRubric"
  | "generatedRubric"
  | "generateRubricRequirements"
  | "generateRubricError"
  | "replaceRubricTitle"
  | "replaceRubricMessage"
  | "keepCurrentRubric"
  | "replaceCurrentRubric"
  | "generateTests"
  | "generatingTests"
  | "generatedTests"
  | "generateTestsPromptRequired"
  | "generateTestsReferenceRequired"
  | "generateTestsError"
  | "generateTestsDialogTitle"
  | "generateTestsDialogMessage"
  | "visibleTestCount"
  | "hiddenTestCount"
  | "testCountLimit"
  | "cancelTestGeneration"
  | "confirmTestGeneration"
  | "replaceTestsTitle"
  | "replaceTestsMessage"
  | "keepCurrentTests"
  | "replaceCurrentTests"
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
  | "gradingTitle"
  | "gradingHelp"
  | "gradingSections"
  | "rubricSectionTab"
  | "testCasesSectionTab"
  | "rubricTitle"
  | "rubricHelp"
  | "aiFeedbackTitle"
  | "aiFeedbackHelp"
  | "aiFeedbackEnabled"
  | "aiGradingEnabled"
  | "feedbackInstructions"
  | "testWeightPercent"
  | "aiWeightPercent"
  | "rubricCriteria"
  | "addCriterion"
  | "criterionTitle"
  | "criterionDescription"
  | "criterionWeight"
  | "removeCriterion"
  | "aiFeedbackResult"
  | "aiFeedbackStrengths"
  | "aiFeedbackImprovements"
  | "aiFeedbackGenerationFailed"
  | "visibleSampleTests"
  | "addSampleTest"
  | "remove"
  | "input"
  | "expectedOutput"
  | "outputMatchMode"
  | "outputMatchExact"
  | "outputMatchContainsLines"
  | "outputMatchRegex"
  | "outputMatchExactHelp"
  | "outputMatchContainsLinesHelp"
  | "outputMatchRegexHelp"
  | "containsLinesRequireOrder"
  | "containsLinesAnyOrder"
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
  | "testSelection"
  | "personalizedTest"
  | "inputOnePerLine"
  | "outputMatchExactlyThis"
  | "runTest"
  | "testOutput"
  | "noOutput"
  | "fullScreen"
  | "exitFullScreen"
  | "resizeWorkspace"
  | "running"
  | "submitForGrading"
  | "submitting"
  | "latestSampleRun"
  | "latestSubmission"
  | "recentRuns"
  | "recentSubmissions"
  | "attemptNumber"
  | "submittedSolution"
  | "submissionResult"
  | "attemptRuns"
  | "runNumber"
  | "noAttemptRuns"
  | "submissionCompleteTitle"
  | "submissionRecordedMessage"
  | "submissionAttemptsRemaining"
  | "submissionNoAttemptsRemaining"
  | "confirmOk"
  | "runInput"
  | "noRunInput"
  | "loadHiddenTestsError"
  | "loadHistoryError"
  | "saveError"
  | "referenceSolutionValidationFailed"
  | "referenceSolutionGenericFailure"
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
  | "outputTruncated"
  | "hiddenTestResults"
  | "test"
  | "statusPending"
  | "statusCompleted"
  | "statusFailed"
  | "judgeStatusAccepted"
  | "judgeStatusWrongAnswer"
  | "judgeStatusCompilationError"
  | "judgeStatusRuntimeError"
  | "judgeStatusTimeLimitExceeded"
  | "gradingReportTitle"
  | "gradeRecapTitle"
  | "automaticTestsGrade"
  | "rubricGrade"
  | "totalGrade"
  | "teacherCommentsTitle"
  | "teacherComment"
  | "feedbackSummary"
  | "rubricDetailsTitle"
  | "rubricCriterion"
  | "rubricCriterionPoints"
  | "rubricCriterionPercent"
  | "gradedAttemptsTitle"
  | "selectedForFinalGrade"
  | "testResultsTitle"
  | "testTotalScore"
  | "testNumber"
  | "testScore"
  | "testScoreUnavailable"
  | "noTestDetails";

type MessageCatalog = Record<MessageKey, string>;

const messages: Record<CodingExercisesMessageLocale, MessageCatalog> = {
  en: {
    authoringTitle: "Coding exercise authoring",
    title: "Title",
    description: "Description",
    language: "Language",
    chooseLanguage: "--- Choose ---",
    languageRequired: "Choose a programming language before saving, generating content, or running tests.",
    loadLanguagesError: "Unable to load the programming languages available from Judge0.",
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
    generateSolution: "Generate solution automatically",
    generatingSolution: "Generating solution...",
    generatedSolution: "Reference solution generated.",
    generateSolutionPromptRequired: "Add a prompt before generating the solution.",
    generateSolutionError: "Unable to generate a valid solution right now.",
    replaceSolutionTitle: "Replace existing solution?",
    replaceSolutionMessage: "Generating a solution will clear starter code and replace the reference solution and template.",
    keepCurrentSolution: "Keep current solution",
    replaceCurrentSolution: "Replace solution",
    generateRubric: "Generate rubric automatically",
    generatingRubric: "Generating rubric...",
    generatedRubric: "Rubric generated.",
    generateRubricRequirements: "Add an activity title, a student prompt, and a reference solution before generating a rubric.",
    generateRubricError: "Unable to generate a valid rubric right now.",
    replaceRubricTitle: "Replace the existing rubric?",
    replaceRubricMessage: "Generating a rubric will replace all current rubric criteria.",
    keepCurrentRubric: "Keep current rubric",
    replaceCurrentRubric: "Replace rubric",
    generateTests: "Generate test cases automatically",
    generatingTests: "Generating test cases...",
    generatedTests: "Test cases generated.",
    generateTestsPromptRequired: "Add a prompt before generating test cases.",
    generateTestsReferenceRequired: "Add or generate a reference solution before generating test cases.",
    generateTestsError: "Unable to generate valid test cases right now.",
    generateTestsDialogTitle: "Generate test cases",
    generateTestsDialogMessage: "Choose how many visible and hidden tests to generate. Generated tests use Contains lines output matching.",
    visibleTestCount: "Visible tests",
    hiddenTestCount: "Hidden tests",
    testCountLimit: "Choose between 1 and 15 tests of each kind.",
    cancelTestGeneration: "Cancel",
    confirmTestGeneration: "Generate tests",
    replaceTestsTitle: "Replace existing test cases?",
    replaceTestsMessage: "Generating test cases will replace existing visible sample tests and hidden tests.",
    keepCurrentTests: "Keep current tests",
    replaceCurrentTests: "Replace tests",
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
    gradingTitle: "Grading",
    gradingHelp: "Configure deterministic tests and an optional rubric. Teachers can complete and edit rubric feedback even when automatic feedback is off.",
    gradingSections: "Grading sections",
    rubricSectionTab: "Rubric",
    testCasesSectionTab: "Test cases",
    rubricTitle: "Rubric",
    rubricHelp: "This rubric is available in teacher feedback review for every submitted answer. Automatic feedback may fill it when enabled.",
    aiFeedbackTitle: "Automatic feedback",
    aiFeedbackHelp: "Requires automatic assessment feedback and a model in the course settings. Formative feedback runs on submission; summative feedback is started by a teacher.",
    aiFeedbackEnabled: "Enable AI feedback",
    aiGradingEnabled: "Use the rubric score as part of the grade",
    feedbackInstructions: "Feedback instructions",
    testWeightPercent: "Deterministic tests (%)",
    aiWeightPercent: "Rubric (%)",
    rubricCriteria: "Rubric criteria",
    addCriterion: "Add criterion",
    criterionTitle: "Criterion title",
    criterionDescription: "Criterion description",
    criterionWeight: "Weight (%)",
    removeCriterion: "Remove criterion",
    aiFeedbackResult: "Feedback",
    aiFeedbackStrengths: "Strengths",
    aiFeedbackImprovements: "Improvements",
    aiFeedbackGenerationFailed: "The submission was recorded, but feedback could not be generated.",
    visibleSampleTests: "Visible sample tests",
    addSampleTest: "Add sample test",
    remove: "Remove",
    input: "Input",
    expectedOutput: "Expected output",
    outputMatchMode: "Output matching",
    outputMatchExact: "Exact",
    outputMatchContainsLines: "Contains lines",
    outputMatchRegex: "Regular expression",
    outputMatchExactHelp: "Judge0 compares the complete program output with this expected output.",
    outputMatchContainsLinesHelp: "Every non-empty expected line must occur as literal text within an output line. Trailing whitespace is ignored, and extra output is allowed.",
    outputMatchRegexHelp: "The safe RE2 pattern is searched anywhere in stdout. Backreferences and lookaround are not supported.",
    containsLinesRequireOrder: "Require lines in this order",
    containsLinesAnyOrder: "Lines may appear in any order",
    testHarnessCode: "Test code",
    testHarnessCodeHelp: "Optional code for this test. If present, the template must include {{ TEST_CODE }}, and the code will be injected there.",
    visibleTestHarnessHelp: "Optional sample harness code. It is applied automatically and is not shown to students.",
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
    testSelection: "Test",
    personalizedTest: "Personalized test",
    inputOnePerLine: "Input (one value per line)",
    outputMatchExactlyThis: "Exactly this",
    runTest: "Run test",
    testOutput: "Test output",
    noOutput: "No output.",
    fullScreen: "Full screen",
    exitFullScreen: "Exit full screen",
    resizeWorkspace: "Resize code editor and test runner",
    running: "Running...",
    submitForGrading: "Submit for grading",
    submitting: "Submitting...",
    latestSampleRun: "Latest sample run",
    latestSubmission: "Latest submission",
    recentRuns: "Recent runs",
    recentSubmissions: "Recent submissions",
    attemptNumber: "Attempt {number}",
    submittedSolution: "Submitted solution",
    submissionResult: "Submission result",
    attemptRuns: "Runs in this attempt",
    runNumber: "Run {number}",
    noAttemptRuns: "No runs were made before this submission.",
    submissionCompleteTitle: "Submission complete",
    submissionRecordedMessage: "Your submitted code and its runs are now available under Previous submissions.",
    submissionAttemptsRemaining: "You have {count} submission(s) remaining.",
    submissionNoAttemptsRemaining: "No submissions remain. Select OK to return to the course content.",
    confirmOk: "OK",
    runInput: "Input",
    noRunInput: "No input",
    loadHiddenTestsError: "Unable to load hidden tests.",
    loadHistoryError: "Unable to load coding exercise history.",
    saveError: "Unable to save the coding exercise right now.",
    referenceSolutionValidationFailed: "The reference solution failed test \"{testName}\": {reason}",
    referenceSolutionGenericFailure: "The reference solution did not pass one of the saved tests.",
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
    outputTruncated: "Only the beginning of the output was saved and shown.",
    hiddenTestResults: "Hidden test results",
    test: "Test",
    statusPending: "pending",
    statusCompleted: "completed",
    statusFailed: "failed",
    judgeStatusAccepted: "Accepted",
    judgeStatusWrongAnswer: "Wrong answer",
    judgeStatusCompilationError: "Compilation error",
    judgeStatusRuntimeError: "Runtime error",
    judgeStatusTimeLimitExceeded: "Time limit exceeded",
    gradingReportTitle: "Grading report",
    gradeRecapTitle: "Grade recap",
    automaticTestsGrade: "Automatic tests",
    rubricGrade: "Rubric",
    totalGrade: "Total",
    teacherCommentsTitle: "Teacher comments",
    teacherComment: "Comment",
    feedbackSummary: "Summary",
    rubricDetailsTitle: "Rubric details",
    rubricCriterion: "Criterion {number}",
    rubricCriterionPoints: "{score} / {max} points",
    rubricCriterionPercent: "{score}%",
    gradedAttemptsTitle: "Graded attempts",
    selectedForFinalGrade: "Selected for final grade",
    testResultsTitle: "Test details",
    testTotalScore: "{score} / {max} test points",
    testNumber: "Test {number}",
    testScore: "{score} / {max}",
    testScoreUnavailable: "Score unavailable",
    noTestDetails: "No test details are available for this attempt."
  },
  fr: {
    authoringTitle: "Configuration de l'exercice de programmation",
    title: "Titre",
    description: "Description",
    language: "Langage",
    chooseLanguage: "--- Choisir ---",
    languageRequired: "Choisissez un langage de programmation avant d’enregistrer, de générer du contenu ou d’exécuter des tests.",
    loadLanguagesError: "Impossible de charger les langages de programmation disponibles dans Judge0.",
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
    generateSolution: "Generer la solution automatiquement",
    generatingSolution: "Generation de la solution...",
    generatedSolution: "Solution de reference generee.",
    generateSolutionPromptRequired: "Ajoutez une consigne avant de generer la solution.",
    generateSolutionError: "Impossible de generer une solution valide pour le moment.",
    replaceSolutionTitle: "Remplacer la solution existante?",
    replaceSolutionMessage: "La generation effacera le code de depart et remplacera la solution de reference et le gabarit.",
    keepCurrentSolution: "Conserver la solution",
    replaceCurrentSolution: "Remplacer la solution",
    generateRubric: "Générer la grille automatiquement",
    generatingRubric: "Génération de la grille...",
    generatedRubric: "Grille générée.",
    generateRubricRequirements: "Ajoutez un titre d’activité, une consigne étudiante et une solution de référence avant de générer une grille.",
    generateRubricError: "Impossible de générer une grille valide pour le moment.",
    replaceRubricTitle: "Remplacer la grille existante?",
    replaceRubricMessage: "La génération remplacera tous les critères actuels de la grille.",
    keepCurrentRubric: "Conserver la grille actuelle",
    replaceCurrentRubric: "Remplacer la grille",
    generateTests: "Generer les cas de test automatiquement",
    generatingTests: "Generation des cas de test...",
    generatedTests: "Cas de test generes.",
    generateTestsPromptRequired: "Ajoutez une consigne avant de generer les cas de test.",
    generateTestsReferenceRequired: "Ajoutez ou generez une solution de reference avant de generer les cas de test.",
    generateTestsError: "Impossible de generer des cas de test valides pour le moment.",
    generateTestsDialogTitle: "Générer les cas de test",
    generateTestsDialogMessage: "Choisissez le nombre de tests visibles et cachés à générer. Les tests générés utilisent la comparaison « Contient les lignes ».",
    visibleTestCount: "Tests visibles",
    hiddenTestCount: "Tests cachés",
    testCountLimit: "Choisissez entre 1 et 15 tests de chaque type.",
    cancelTestGeneration: "Annuler",
    confirmTestGeneration: "Générer les tests",
    replaceTestsTitle: "Remplacer les cas de test existants?",
    replaceTestsMessage: "La generation remplacera les tests d'exemple visibles et les tests caches existants.",
    keepCurrentTests: "Conserver les tests",
    replaceCurrentTests: "Remplacer les tests",
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
    gradingTitle: "Évaluation",
    gradingHelp: "Configurez les tests déterministes et une grille facultative. L’enseignant peut remplir et modifier la rétroaction de la grille même si la rétroaction automatique est désactivée.",
    gradingSections: "Sections d’évaluation",
    rubricSectionTab: "Grille",
    testCasesSectionTab: "Cas de test",
    rubricTitle: "Grille d’évaluation",
    rubricHelp: "Cette grille est disponible dans la révision de la rétroaction pour chaque réponse soumise. La rétroaction automatique peut la remplir lorsqu’elle est activée.",
    aiFeedbackTitle: "Rétroaction automatique",
    aiFeedbackHelp: "Nécessite la rétroaction automatique et un modèle dans les paramètres du cours. La rétroaction formative démarre à la soumission; la rétroaction sommative est lancée par un enseignant.",
    aiFeedbackEnabled: "Activer la rétroaction IA",
    aiGradingEnabled: "Utiliser le résultat de la grille dans la note",
    feedbackInstructions: "Consignes de rétroaction",
    testWeightPercent: "Tests déterministes (%)",
    aiWeightPercent: "Grille (%)",
    rubricCriteria: "Critères de la grille",
    addCriterion: "Ajouter un critère",
    criterionTitle: "Titre du critère",
    criterionDescription: "Description du critère",
    criterionWeight: "Poids (%)",
    removeCriterion: "Supprimer le critère",
    aiFeedbackResult: "Rétroaction",
    aiFeedbackStrengths: "Points forts",
    aiFeedbackImprovements: "Améliorations",
    aiFeedbackGenerationFailed: "La soumission a été enregistrée, mais la rétroaction n’a pas pu être générée.",
    visibleSampleTests: "Tests d'exemple visibles",
    addSampleTest: "Ajouter un test d'exemple",
    remove: "Supprimer",
    input: "Entrée",
    expectedOutput: "Sortie attendue",
    outputMatchMode: "Comparaison de la sortie",
    outputMatchExact: "Exacte",
    outputMatchContainsLines: "Contient les lignes",
    outputMatchRegex: "Expression régulière",
    outputMatchExactHelp: "Judge0 compare toute la sortie du programme à cette sortie attendue.",
    outputMatchContainsLinesHelp: "Chaque ligne attendue non vide doit apparaître comme texte littéral dans une ligne de sortie. Les espaces de fin sont ignorés et les sorties supplémentaires sont permises.",
    outputMatchRegexHelp: "Le motif RE2 sécurisé est recherché partout dans stdout. Les références arrière et les assertions ne sont pas prises en charge.",
    containsLinesRequireOrder: "Exiger les lignes dans cet ordre",
    containsLinesAnyOrder: "Les lignes peuvent apparaître dans n’importe quel ordre",
    testHarnessCode: "Code de test",
    testHarnessCodeHelp: "Code optionnel pour ce test. S’il est présent, le gabarit doit contenir {{ TEST_CODE }}, et ce code y sera injecté.",
    visibleTestHarnessHelp: "Code de harnais optionnel pour l’exemple. Il est appliqué automatiquement et n’est pas montré aux étudiants.",
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
    testSelection: "Test",
    personalizedTest: "Test personnalisé",
    inputOnePerLine: "Entrée (une valeur par ligne)",
    outputMatchExactlyThis: "Exactement ceci",
    runTest: "Exécuter le test",
    testOutput: "Sortie du test",
    noOutput: "Aucune sortie.",
    fullScreen: "Plein écran",
    exitFullScreen: "Quitter le plein écran",
    resizeWorkspace: "Redimensionner l’éditeur de code et l’espace de test",
    running: "Exécution...",
    submitForGrading: "Soumettre pour évaluation",
    submitting: "Soumission...",
    latestSampleRun: "Dernière exécution d'exemple",
    latestSubmission: "Dernière soumission",
    recentRuns: "Exécutions récentes",
    recentSubmissions: "Soumissions récentes",
    attemptNumber: "Tentative {number}",
    submittedSolution: "Solution soumise",
    submissionResult: "Résultat de la soumission",
    attemptRuns: "Exécutions de cette tentative",
    runNumber: "Exécution {number}",
    noAttemptRuns: "Aucune exécution n’a été effectuée avant cette soumission.",
    submissionCompleteTitle: "Soumission terminée",
    submissionRecordedMessage: "Votre code soumis et ses exécutions sont maintenant accessibles sous Soumissions précédentes.",
    submissionAttemptsRemaining: "Il vous reste {count} soumission(s).",
    submissionNoAttemptsRemaining: "Il ne reste aucune soumission. Sélectionnez OK pour retourner au contenu du cours.",
    confirmOk: "OK",
    runInput: "Entrée",
    noRunInput: "Aucune entrée",
    loadHiddenTestsError: "Impossible de charger les tests cachés.",
    loadHistoryError: "Impossible de charger l'historique de l'exercice.",
    saveError: "Impossible d'enregistrer l'exercice pour le moment.",
    referenceSolutionValidationFailed: "La solution de référence a échoué au test « {testName} » : {reason}",
    referenceSolutionGenericFailure: "La solution de référence n’a pas réussi l’un des tests enregistrés.",
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
    outputTruncated: "Seul le début de la sortie a été enregistré et affiché.",
    hiddenTestResults: "Résultats des tests cachés",
    test: "Test",
    statusPending: "en attente",
    statusCompleted: "terminé",
    statusFailed: "échoué",
    judgeStatusAccepted: "Accepté",
    judgeStatusWrongAnswer: "Mauvaise réponse",
    judgeStatusCompilationError: "Erreur de compilation",
    judgeStatusRuntimeError: "Erreur à l’exécution",
    judgeStatusTimeLimitExceeded: "Temps limite dépassé",
    gradingReportTitle: "Rapport de correction",
    gradeRecapTitle: "Récapitulatif de la note",
    automaticTestsGrade: "Tests automatiques",
    rubricGrade: "Grille d’évaluation",
    totalGrade: "Total",
    teacherCommentsTitle: "Commentaires de l’enseignant",
    teacherComment: "Commentaire",
    feedbackSummary: "Résumé",
    rubricDetailsTitle: "Détails de la grille d’évaluation",
    rubricCriterion: "Critère {number}",
    rubricCriterionPoints: "{score} / {max} points",
    rubricCriterionPercent: "{score} %",
    gradedAttemptsTitle: "Tentatives corrigées",
    selectedForFinalGrade: "Retenue pour la note finale",
    testResultsTitle: "Détails des tests",
    testTotalScore: "{score} / {max} points de test",
    testNumber: "Test {number}",
    testScore: "{score} / {max}",
    testScoreUnavailable: "Note non disponible",
    noTestDetails: "Aucun détail de test n’est disponible pour cette tentative."
  },
  zh: {
    authoringTitle: "编程练习设置",
    title: "标题",
    description: "说明",
    language: "语言",
    chooseLanguage: "--- 请选择 ---",
    languageRequired: "请先选择编程语言，再保存、生成内容或运行测试。",
    loadLanguagesError: "无法加载 Judge0 提供的编程语言。",
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
    generateSolution: "自动生成答案",
    generatingSolution: "正在生成答案...",
    generatedSolution: "参考答案已生成。",
    generateSolutionPromptRequired: "请先添加题目再生成答案。",
    generateSolutionError: "暂时无法生成有效答案。",
    replaceSolutionTitle: "替换现有答案？",
    replaceSolutionMessage: "生成答案会清空起始代码，并替换参考答案和模板。",
    keepCurrentSolution: "保留当前答案",
    replaceCurrentSolution: "替换答案",
    generateRubric: "自动生成量规",
    generatingRubric: "正在生成量规...",
    generatedRubric: "量规已生成。",
    generateRubricRequirements: "请先添加活动标题、学生题目和参考答案，再生成量规。",
    generateRubricError: "暂时无法生成有效量规。",
    replaceRubricTitle: "替换现有量规？",
    replaceRubricMessage: "生成量规会替换当前所有量规标准。",
    keepCurrentRubric: "保留当前量规",
    replaceCurrentRubric: "替换量规",
    generateTests: "自动生成测试用例",
    generatingTests: "正在生成测试用例...",
    generatedTests: "测试用例已生成。",
    generateTestsPromptRequired: "请先添加题目再生成测试用例。",
    generateTestsReferenceRequired: "请先添加或生成参考答案，再生成测试用例。",
    generateTestsError: "暂时无法生成有效测试用例。",
    generateTestsDialogTitle: "生成测试用例",
    generateTestsDialogMessage: "选择要生成的可见测试和隐藏测试数量。生成的测试使用“包含指定行”输出匹配。",
    visibleTestCount: "可见测试",
    hiddenTestCount: "隐藏测试",
    testCountLimit: "每种测试请选择 1 到 15 个。",
    cancelTestGeneration: "取消",
    confirmTestGeneration: "生成测试",
    replaceTestsTitle: "替换现有测试用例？",
    replaceTestsMessage: "生成测试用例会替换现有可见示例测试和隐藏测试。",
    keepCurrentTests: "保留当前测试",
    replaceCurrentTests: "替换测试",
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
    gradingTitle: "评分",
    gradingHelp: "配置确定性测试和可选量规。即使关闭自动反馈，教师也可以填写和编辑量规反馈。",
    gradingSections: "评分区域",
    rubricSectionTab: "量规",
    testCasesSectionTab: "测试用例",
    rubricTitle: "量规",
    rubricHelp: "每份已提交答案都可在教师反馈审阅中使用此量规；启用自动反馈后可由系统填写。",
    aiFeedbackTitle: "自动反馈",
    aiFeedbackHelp: "需要在课程设置中启用自动评估反馈并选择模型。形成性反馈在提交时运行；总结性反馈由教师启动。",
    aiFeedbackEnabled: "启用 AI 反馈",
    aiGradingEnabled: "将量规分数计入成绩",
    feedbackInstructions: "反馈说明",
    testWeightPercent: "确定性测试（%）",
    aiWeightPercent: "量规（%）",
    rubricCriteria: "量规标准",
    addCriterion: "添加标准",
    criterionTitle: "标准标题",
    criterionDescription: "标准说明",
    criterionWeight: "权重（%）",
    removeCriterion: "删除标准",
    aiFeedbackResult: "反馈",
    aiFeedbackStrengths: "优点",
    aiFeedbackImprovements: "改进建议",
    aiFeedbackGenerationFailed: "提交已记录，但无法生成反馈。",
    visibleSampleTests: "可见示例测试",
    addSampleTest: "添加示例测试",
    remove: "删除",
    input: "输入",
    expectedOutput: "期望输出",
    outputMatchMode: "输出匹配方式",
    outputMatchExact: "精确匹配",
    outputMatchContainsLines: "包含指定行",
    outputMatchRegex: "正则表达式",
    outputMatchExactHelp: "Judge0 会将程序的完整输出与此期望输出进行比较。",
    outputMatchContainsLinesHelp: "每个非空期望行都必须作为文字出现在某个输出行中；忽略行尾空白，并允许额外输出。",
    outputMatchRegexHelp: "安全的 RE2 模式会在 stdout 的任意位置查找；不支持反向引用和前后查找。",
    containsLinesRequireOrder: "要求各行按此顺序出现",
    containsLinesAnyOrder: "各行可以按任意顺序出现",
    testHarnessCode: "测试代码",
    testHarnessCodeHelp: "此测试的可选代码。如需使用，模板必须包含 {{ TEST_CODE }}，并且该代码会注入到那里。",
    visibleTestHarnessHelp: "用于示例运行的可选脚手架代码。它会自动应用，且不会向学生显示。",
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
    testSelection: "测试",
    personalizedTest: "个性化测试",
    inputOnePerLine: "输入（每行一个值）",
    outputMatchExactlyThis: "完全一致",
    runTest: "运行测试",
    testOutput: "测试输出",
    noOutput: "无输出。",
    fullScreen: "全屏",
    exitFullScreen: "退出全屏",
    resizeWorkspace: "调整代码编辑器和测试面板的大小",
    running: "运行中...",
    submitForGrading: "提交评分",
    submitting: "提交中...",
    latestSampleRun: "最近一次示例运行",
    latestSubmission: "最近一次提交",
    recentRuns: "最近运行",
    recentSubmissions: "最近提交",
    attemptNumber: "第 {number} 次尝试",
    submittedSolution: "已提交的答案",
    submissionResult: "提交结果",
    attemptRuns: "本次尝试的运行记录",
    runNumber: "第 {number} 次运行",
    noAttemptRuns: "此提交之前没有运行记录。",
    submissionCompleteTitle: "提交完成",
    submissionRecordedMessage: "你提交的代码及其运行记录现已保存在“以前的提交”中。",
    submissionAttemptsRemaining: "你还可以提交 {count} 次。",
    submissionNoAttemptsRemaining: "已无剩余提交次数。选择“确定”返回课程内容。",
    confirmOk: "确定",
    runInput: "输入",
    noRunInput: "无输入",
    loadHiddenTestsError: "无法加载隐藏测试。",
    loadHistoryError: "无法加载编程练习历史记录。",
    saveError: "暂时无法保存编程练习。",
    referenceSolutionValidationFailed: "参考答案未通过测试“{testName}”：{reason}",
    referenceSolutionGenericFailure: "参考答案未通过某个已保存的测试。",
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
    outputTruncated: "仅保存并显示了输出的开头。",
    hiddenTestResults: "隐藏测试结果",
    test: "测试",
    statusPending: "进行中",
    statusCompleted: "已完成",
    statusFailed: "失败",
    judgeStatusAccepted: "通过",
    judgeStatusWrongAnswer: "答案错误",
    judgeStatusCompilationError: "编译错误",
    judgeStatusRuntimeError: "运行时错误",
    judgeStatusTimeLimitExceeded: "超过时间限制",
    gradingReportTitle: "评分报告",
    gradeRecapTitle: "成绩汇总",
    automaticTestsGrade: "自动测试",
    rubricGrade: "评分量规",
    totalGrade: "总分",
    teacherCommentsTitle: "教师评语",
    teacherComment: "评语",
    feedbackSummary: "总结",
    rubricDetailsTitle: "评分量规详情",
    rubricCriterion: "标准 {number}",
    rubricCriterionPoints: "{score} / {max} 分",
    rubricCriterionPercent: "{score}%",
    gradedAttemptsTitle: "已评分的尝试",
    selectedForFinalGrade: "计入最终成绩",
    testResultsTitle: "测试详情",
    testTotalScore: "测试得分 {score} / {max}",
    testNumber: "测试 {number}",
    testScore: "{score} / {max}",
    testScoreUnavailable: "分数不可用",
    noTestDetails: "此尝试没有可用的测试详情。"
  }
};

export function normalizeCodingExercisesLocale(value?: string): CodingExercisesLocale {
  if (value === "fr" || value === "zh" || value === "ar") {
    return value;
  }
  return "en";
}

export function formatCodingExercisesMessage(
  locale: CodingExercisesLocale,
  key: MessageKey,
  values?: Record<string, string | number>
) {
  let template = messages[locale === "ar" ? "en" : locale][key];
  if (!values) {
    return template;
  }

  for (const [name, value] of Object.entries(values)) {
    template = template.replaceAll(`{${name}}`, String(value));
  }

  return template;
}
