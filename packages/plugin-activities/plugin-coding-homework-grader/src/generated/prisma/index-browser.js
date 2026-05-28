
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.PluginCodingHomeworkAssignmentScalarFieldEnum = {
  id: 'id',
  activityId: 'activityId',
  promptMarkdown: 'promptMarkdown',
  promptPdfAttachmentId: 'promptPdfAttachmentId',
  languageKey: 'languageKey',
  candidateLimit: 'candidateLimit',
  retrievedExampleCount: 'retrievedExampleCount',
  questionCount: 'questionCount',
  generationInstructions: 'generationInstructions',
  settings: 'settings',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginBankCodingHomeworkAssignmentScalarFieldEnum = {
  id: 'id',
  bankActivityId: 'bankActivityId',
  promptMarkdown: 'promptMarkdown',
  promptPdfAttachmentId: 'promptPdfAttachmentId',
  languageKey: 'languageKey',
  candidateLimit: 'candidateLimit',
  retrievedExampleCount: 'retrievedExampleCount',
  questionCount: 'questionCount',
  generationInstructions: 'generationInstructions',
  settings: 'settings',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum = {
  id: 'id',
  activityId: 'activityId',
  languageKey: 'languageKey',
  requirements: 'requirements',
  sourceAttachmentId: 'sourceAttachmentId',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum = {
  id: 'id',
  bankActivityId: 'bankActivityId',
  languageKey: 'languageKey',
  requirements: 'requirements',
  sourceAttachmentId: 'sourceAttachmentId',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginCodingHomeworkAttachmentScalarFieldEnum = {
  id: 'id',
  ownerKind: 'ownerKind',
  ownerId: 'ownerId',
  kind: 'kind',
  originalName: 'originalName',
  storedName: 'storedName',
  mimeType: 'mimeType',
  sizeBytes: 'sizeBytes',
  sha256: 'sha256',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum = {
  id: 'id',
  activityId: 'activityId',
  courseId: 'courseId',
  groupId: 'groupId',
  contentTreeAnchorItemId: 'contentTreeAnchorItemId',
  contentTreeFingerprint: 'contentTreeFingerprint',
  status: 'status',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginCodingHomeworkReferenceFunctionScalarFieldEnum = {
  id: 'id',
  snapshotId: 'snapshotId',
  contentResourceId: 'contentResourceId',
  sourceTitle: 'sourceTitle',
  sourceKind: 'sourceKind',
  languageKey: 'languageKey',
  functionName: 'functionName',
  functionCode: 'functionCode',
  astText: 'astText',
  embedding: 'embedding',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginCodingHomeworkSubmissionScalarFieldEnum = {
  id: 'id',
  activityId: 'activityId',
  groupId: 'groupId',
  userId: 'userId',
  coreAttemptId: 'coreAttemptId',
  documentationSnapshotId: 'documentationSnapshotId',
  zipAttachmentId: 'zipAttachmentId',
  kind: 'kind',
  status: 'status',
  structureValidationSummary: 'structureValidationSummary',
  processingError: 'processingError',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginCodingHomeworkSubmissionFileScalarFieldEnum = {
  id: 'id',
  submissionId: 'submissionId',
  path: 'path',
  languageKey: 'languageKey',
  sizeBytes: 'sizeBytes',
  sha256: 'sha256',
  storedName: 'storedName',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.PluginCodingHomeworkSubmissionFunctionScalarFieldEnum = {
  id: 'id',
  submissionId: 'submissionId',
  fileId: 'fileId',
  functionName: 'functionName',
  functionCode: 'functionCode',
  astText: 'astText',
  embedding: 'embedding',
  nearestExamples: 'nearestExamples',
  divergenceScore: 'divergenceScore',
  selectedForQuestion: 'selectedForQuestion',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginCodingHomeworkChallengeQuestionScalarFieldEnum = {
  id: 'id',
  submissionId: 'submissionId',
  submissionFunctionId: 'submissionFunctionId',
  orderIndex: 'orderIndex',
  questionText: 'questionText',
  studentAnswer: 'studentAnswer',
  answerSubmittedAt: 'answerSubmittedAt',
  generationModel: 'generationModel',
  generationPromptVersion: 'generationPromptVersion',
  nearestExamples: 'nearestExamples',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PluginCodingHomeworkReviewScalarFieldEnum = {
  id: 'id',
  submissionId: 'submissionId',
  reviewerUserId: 'reviewerUserId',
  score: 'score',
  maxScore: 'maxScore',
  feedback: 'feedback',
  rubric: 'rubric',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.PluginCodingHomeworkAttachmentOwnerKind = exports.$Enums.PluginCodingHomeworkAttachmentOwnerKind = {
  course_activity: 'course_activity',
  bank_activity: 'bank_activity',
  submission: 'submission'
};

exports.PluginCodingHomeworkAttachmentKind = exports.$Enums.PluginCodingHomeworkAttachmentKind = {
  assignment_pdf: 'assignment_pdf',
  requirements_upload: 'requirements_upload',
  submission_zip: 'submission_zip',
  extracted_source: 'extracted_source',
  extracted_non_source: 'extracted_non_source'
};

exports.PluginCodingHomeworkSnapshotStatus = exports.$Enums.PluginCodingHomeworkSnapshotStatus = {
  pending: 'pending',
  ready: 'ready',
  failed: 'failed'
};

exports.PluginCodingHomeworkSubmissionKind = exports.$Enums.PluginCodingHomeworkSubmissionKind = {
  preflight: 'preflight',
  final: 'final'
};

exports.PluginCodingHomeworkSubmissionStatus = exports.$Enums.PluginCodingHomeworkSubmissionStatus = {
  uploaded: 'uploaded',
  validating: 'validating',
  invalid_structure: 'invalid_structure',
  structure_valid: 'structure_valid',
  processing: 'processing',
  challenge_ready: 'challenge_ready',
  answered: 'answered',
  ready_for_grading: 'ready_for_grading',
  graded: 'graded',
  failed: 'failed'
};

exports.Prisma.ModelName = {
  PluginCodingHomeworkAssignment: 'PluginCodingHomeworkAssignment',
  PluginBankCodingHomeworkAssignment: 'PluginBankCodingHomeworkAssignment',
  PluginCodingHomeworkSubmissionRequirementSet: 'PluginCodingHomeworkSubmissionRequirementSet',
  PluginBankCodingHomeworkSubmissionRequirementSet: 'PluginBankCodingHomeworkSubmissionRequirementSet',
  PluginCodingHomeworkAttachment: 'PluginCodingHomeworkAttachment',
  PluginCodingHomeworkDocumentationSnapshot: 'PluginCodingHomeworkDocumentationSnapshot',
  PluginCodingHomeworkReferenceFunction: 'PluginCodingHomeworkReferenceFunction',
  PluginCodingHomeworkSubmission: 'PluginCodingHomeworkSubmission',
  PluginCodingHomeworkSubmissionFile: 'PluginCodingHomeworkSubmissionFile',
  PluginCodingHomeworkSubmissionFunction: 'PluginCodingHomeworkSubmissionFunction',
  PluginCodingHomeworkChallengeQuestion: 'PluginCodingHomeworkChallengeQuestion',
  PluginCodingHomeworkReview: 'PluginCodingHomeworkReview'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
