export const codingHomeworkChallengePromptVersion = "coding-homework-grader.challenge-question.v1";

export const prototypePipelineSteps = [
  {
    prototypeScript: "0_data_cleanup.py",
    serviceArea: "source-normalization",
    targetModule: "source-normalization"
  },
  {
    prototypeScript: "1_parse_code.py",
    serviceArea: "parser-adapter",
    targetModule: "parsers"
  },
  {
    prototypeScript: "2_generate_corpus_embeddings.py",
    serviceArea: "reference-indexing",
    targetModule: "reference-index"
  },
  {
    prototypeScript: "3_compute_similarities.py",
    serviceArea: "similarity-search",
    targetModule: "similarity"
  },
  {
    prototypeScript: "4_select_candidates.py",
    serviceArea: "candidate-selection",
    targetModule: "candidate-selection"
  },
  {
    prototypeScript: "5_generate_questions.py",
    serviceArea: "question-generation",
    targetModule: "question-generation"
  }
] as const;

export type CodingHomeworkLanguageKey = "c" | (string & {});

export type CodingHomeworkSourceFile = {
  content: string;
  languageKey: CodingHomeworkLanguageKey;
  path: string;
};

export type CodingHomeworkPathRequirement = {
  description?: string;
  path: string;
};

export type CodingHomeworkFunctionRequirement = {
  description?: string;
  filePath?: string;
  name: string;
  required?: boolean;
};

export type CodingHomeworkSubmissionRequirements = {
  allowedExtensions?: string[];
  ignoredPaths?: string[];
  languageKey: CodingHomeworkLanguageKey;
  maxArchiveBytes?: number;
  maxFileCount?: number;
  requiredFiles?: CodingHomeworkPathRequirement[];
  requiredFolders?: CodingHomeworkPathRequirement[];
  requiredFunctions?: CodingHomeworkFunctionRequirement[];
};

export type CodingHomeworkValidationIssue = {
  code:
    | "archive_too_large"
    | "file_count_exceeded"
    | "forbidden_path"
    | "missing_file"
    | "missing_folder"
    | "missing_function"
    | "parser_error"
    | "unsupported_extension"
    | "unexpected_file";
  functionName?: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
};

export type CodingHomeworkStructureValidationSummary = {
  fileCount: number;
  issues: CodingHomeworkValidationIssue[];
  isValid: boolean;
  matchedFunctions: Array<{
    filePath: string;
    functionName: string;
  }>;
};

export type CodingHomeworkParserDiagnostic = {
  code: string;
  endLine?: number;
  line?: number;
  message: string;
  path: string;
  severity: "error" | "warning";
};

export type CodingHomeworkParsedFunction = {
  astText: string;
  endLine?: number;
  functionCode: string;
  functionName: string;
  languageKey: CodingHomeworkLanguageKey;
  sourcePath: string;
  startLine?: number;
};

export type CodingHomeworkParseResult = {
  diagnostics: CodingHomeworkParserDiagnostic[];
  functions: CodingHomeworkParsedFunction[];
};

export type CodingHomeworkParserAdapter = {
  languageKey: CodingHomeworkLanguageKey;
  parse(files: CodingHomeworkSourceFile[]): Promise<CodingHomeworkParseResult>;
};

export type CodingHomeworkEmbeddingProvider = {
  embedAst(input: {
    astText: string;
    languageKey: CodingHomeworkLanguageKey;
  }): Promise<number[]>;
};

export type CodingHomeworkReferenceFunction = CodingHomeworkParsedFunction & {
  contentResourceId?: string;
  embedding: number[];
  referenceId: string;
  sourceTitle: string;
};

export type CodingHomeworkSubmittedFunction = CodingHomeworkParsedFunction & {
  embedding: number[];
  submittedFunctionId: string;
};

export type CodingHomeworkSimilarFunction = {
  distance: number;
  functionCode: string;
  functionName: string;
  referenceId: string;
  sourceTitle: string;
};

export type CodingHomeworkCandidateFunction = CodingHomeworkSubmittedFunction & {
  divergenceScore: number;
  nearestExamples: CodingHomeworkSimilarFunction[];
};

export type CodingHomeworkQuestionGenerationInput = {
  candidate: CodingHomeworkCandidateFunction;
  extraInstructions?: string;
  nearestExampleCount: number;
  promptVersion: typeof codingHomeworkChallengePromptVersion;
};

export type CodingHomeworkGeneratedQuestion = {
  generationModel: string;
  promptVersion: typeof codingHomeworkChallengePromptVersion;
  questionText: string;
};
