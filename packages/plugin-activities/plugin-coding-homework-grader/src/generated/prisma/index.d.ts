
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model PluginCodingHomeworkAssignment
 * 
 */
export type PluginCodingHomeworkAssignment = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkAssignmentPayload>
/**
 * Model PluginBankCodingHomeworkAssignment
 * 
 */
export type PluginBankCodingHomeworkAssignment = $Result.DefaultSelection<Prisma.$PluginBankCodingHomeworkAssignmentPayload>
/**
 * Model PluginCodingHomeworkSubmissionRequirementSet
 * 
 */
export type PluginCodingHomeworkSubmissionRequirementSet = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>
/**
 * Model PluginBankCodingHomeworkSubmissionRequirementSet
 * 
 */
export type PluginBankCodingHomeworkSubmissionRequirementSet = $Result.DefaultSelection<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>
/**
 * Model PluginCodingHomeworkAttachment
 * 
 */
export type PluginCodingHomeworkAttachment = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkAttachmentPayload>
/**
 * Model PluginCodingHomeworkDocumentationSnapshot
 * 
 */
export type PluginCodingHomeworkDocumentationSnapshot = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>
/**
 * Model PluginCodingHomeworkReferenceFunction
 * 
 */
export type PluginCodingHomeworkReferenceFunction = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>
/**
 * Model PluginCodingHomeworkSubmission
 * 
 */
export type PluginCodingHomeworkSubmission = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkSubmissionPayload>
/**
 * Model PluginCodingHomeworkSubmissionFile
 * 
 */
export type PluginCodingHomeworkSubmissionFile = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkSubmissionFilePayload>
/**
 * Model PluginCodingHomeworkSubmissionFunction
 * 
 */
export type PluginCodingHomeworkSubmissionFunction = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>
/**
 * Model PluginCodingHomeworkChallengeQuestion
 * 
 */
export type PluginCodingHomeworkChallengeQuestion = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>
/**
 * Model PluginCodingHomeworkReview
 * 
 */
export type PluginCodingHomeworkReview = $Result.DefaultSelection<Prisma.$PluginCodingHomeworkReviewPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const PluginCodingHomeworkAttachmentOwnerKind: {
  course_activity: 'course_activity',
  bank_activity: 'bank_activity',
  submission: 'submission'
};

export type PluginCodingHomeworkAttachmentOwnerKind = (typeof PluginCodingHomeworkAttachmentOwnerKind)[keyof typeof PluginCodingHomeworkAttachmentOwnerKind]


export const PluginCodingHomeworkAttachmentKind: {
  assignment_pdf: 'assignment_pdf',
  provided_file: 'provided_file',
  requirements_upload: 'requirements_upload',
  submission_zip: 'submission_zip',
  extracted_source: 'extracted_source',
  extracted_non_source: 'extracted_non_source'
};

export type PluginCodingHomeworkAttachmentKind = (typeof PluginCodingHomeworkAttachmentKind)[keyof typeof PluginCodingHomeworkAttachmentKind]


export const PluginCodingHomeworkSnapshotStatus: {
  pending: 'pending',
  ready: 'ready',
  failed: 'failed'
};

export type PluginCodingHomeworkSnapshotStatus = (typeof PluginCodingHomeworkSnapshotStatus)[keyof typeof PluginCodingHomeworkSnapshotStatus]


export const PluginCodingHomeworkSubmissionKind: {
  preflight: 'preflight',
  final: 'final'
};

export type PluginCodingHomeworkSubmissionKind = (typeof PluginCodingHomeworkSubmissionKind)[keyof typeof PluginCodingHomeworkSubmissionKind]


export const PluginCodingHomeworkSubmissionStatus: {
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

export type PluginCodingHomeworkSubmissionStatus = (typeof PluginCodingHomeworkSubmissionStatus)[keyof typeof PluginCodingHomeworkSubmissionStatus]

}

export type PluginCodingHomeworkAttachmentOwnerKind = $Enums.PluginCodingHomeworkAttachmentOwnerKind

export const PluginCodingHomeworkAttachmentOwnerKind: typeof $Enums.PluginCodingHomeworkAttachmentOwnerKind

export type PluginCodingHomeworkAttachmentKind = $Enums.PluginCodingHomeworkAttachmentKind

export const PluginCodingHomeworkAttachmentKind: typeof $Enums.PluginCodingHomeworkAttachmentKind

export type PluginCodingHomeworkSnapshotStatus = $Enums.PluginCodingHomeworkSnapshotStatus

export const PluginCodingHomeworkSnapshotStatus: typeof $Enums.PluginCodingHomeworkSnapshotStatus

export type PluginCodingHomeworkSubmissionKind = $Enums.PluginCodingHomeworkSubmissionKind

export const PluginCodingHomeworkSubmissionKind: typeof $Enums.PluginCodingHomeworkSubmissionKind

export type PluginCodingHomeworkSubmissionStatus = $Enums.PluginCodingHomeworkSubmissionStatus

export const PluginCodingHomeworkSubmissionStatus: typeof $Enums.PluginCodingHomeworkSubmissionStatus

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more PluginCodingHomeworkAssignments
 * const pluginCodingHomeworkAssignments = await prisma.pluginCodingHomeworkAssignment.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more PluginCodingHomeworkAssignments
   * const pluginCodingHomeworkAssignments = await prisma.pluginCodingHomeworkAssignment.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.pluginCodingHomeworkAssignment`: Exposes CRUD operations for the **PluginCodingHomeworkAssignment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkAssignments
    * const pluginCodingHomeworkAssignments = await prisma.pluginCodingHomeworkAssignment.findMany()
    * ```
    */
  get pluginCodingHomeworkAssignment(): Prisma.PluginCodingHomeworkAssignmentDelegate<ExtArgs>;

  /**
   * `prisma.pluginBankCodingHomeworkAssignment`: Exposes CRUD operations for the **PluginBankCodingHomeworkAssignment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginBankCodingHomeworkAssignments
    * const pluginBankCodingHomeworkAssignments = await prisma.pluginBankCodingHomeworkAssignment.findMany()
    * ```
    */
  get pluginBankCodingHomeworkAssignment(): Prisma.PluginBankCodingHomeworkAssignmentDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkSubmissionRequirementSet`: Exposes CRUD operations for the **PluginCodingHomeworkSubmissionRequirementSet** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkSubmissionRequirementSets
    * const pluginCodingHomeworkSubmissionRequirementSets = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findMany()
    * ```
    */
  get pluginCodingHomeworkSubmissionRequirementSet(): Prisma.PluginCodingHomeworkSubmissionRequirementSetDelegate<ExtArgs>;

  /**
   * `prisma.pluginBankCodingHomeworkSubmissionRequirementSet`: Exposes CRUD operations for the **PluginBankCodingHomeworkSubmissionRequirementSet** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginBankCodingHomeworkSubmissionRequirementSets
    * const pluginBankCodingHomeworkSubmissionRequirementSets = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findMany()
    * ```
    */
  get pluginBankCodingHomeworkSubmissionRequirementSet(): Prisma.PluginBankCodingHomeworkSubmissionRequirementSetDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkAttachment`: Exposes CRUD operations for the **PluginCodingHomeworkAttachment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkAttachments
    * const pluginCodingHomeworkAttachments = await prisma.pluginCodingHomeworkAttachment.findMany()
    * ```
    */
  get pluginCodingHomeworkAttachment(): Prisma.PluginCodingHomeworkAttachmentDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkDocumentationSnapshot`: Exposes CRUD operations for the **PluginCodingHomeworkDocumentationSnapshot** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkDocumentationSnapshots
    * const pluginCodingHomeworkDocumentationSnapshots = await prisma.pluginCodingHomeworkDocumentationSnapshot.findMany()
    * ```
    */
  get pluginCodingHomeworkDocumentationSnapshot(): Prisma.PluginCodingHomeworkDocumentationSnapshotDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkReferenceFunction`: Exposes CRUD operations for the **PluginCodingHomeworkReferenceFunction** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkReferenceFunctions
    * const pluginCodingHomeworkReferenceFunctions = await prisma.pluginCodingHomeworkReferenceFunction.findMany()
    * ```
    */
  get pluginCodingHomeworkReferenceFunction(): Prisma.PluginCodingHomeworkReferenceFunctionDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkSubmission`: Exposes CRUD operations for the **PluginCodingHomeworkSubmission** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkSubmissions
    * const pluginCodingHomeworkSubmissions = await prisma.pluginCodingHomeworkSubmission.findMany()
    * ```
    */
  get pluginCodingHomeworkSubmission(): Prisma.PluginCodingHomeworkSubmissionDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkSubmissionFile`: Exposes CRUD operations for the **PluginCodingHomeworkSubmissionFile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkSubmissionFiles
    * const pluginCodingHomeworkSubmissionFiles = await prisma.pluginCodingHomeworkSubmissionFile.findMany()
    * ```
    */
  get pluginCodingHomeworkSubmissionFile(): Prisma.PluginCodingHomeworkSubmissionFileDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkSubmissionFunction`: Exposes CRUD operations for the **PluginCodingHomeworkSubmissionFunction** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkSubmissionFunctions
    * const pluginCodingHomeworkSubmissionFunctions = await prisma.pluginCodingHomeworkSubmissionFunction.findMany()
    * ```
    */
  get pluginCodingHomeworkSubmissionFunction(): Prisma.PluginCodingHomeworkSubmissionFunctionDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkChallengeQuestion`: Exposes CRUD operations for the **PluginCodingHomeworkChallengeQuestion** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkChallengeQuestions
    * const pluginCodingHomeworkChallengeQuestions = await prisma.pluginCodingHomeworkChallengeQuestion.findMany()
    * ```
    */
  get pluginCodingHomeworkChallengeQuestion(): Prisma.PluginCodingHomeworkChallengeQuestionDelegate<ExtArgs>;

  /**
   * `prisma.pluginCodingHomeworkReview`: Exposes CRUD operations for the **PluginCodingHomeworkReview** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PluginCodingHomeworkReviews
    * const pluginCodingHomeworkReviews = await prisma.pluginCodingHomeworkReview.findMany()
    * ```
    */
  get pluginCodingHomeworkReview(): Prisma.PluginCodingHomeworkReviewDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
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

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "pluginCodingHomeworkAssignment" | "pluginBankCodingHomeworkAssignment" | "pluginCodingHomeworkSubmissionRequirementSet" | "pluginBankCodingHomeworkSubmissionRequirementSet" | "pluginCodingHomeworkAttachment" | "pluginCodingHomeworkDocumentationSnapshot" | "pluginCodingHomeworkReferenceFunction" | "pluginCodingHomeworkSubmission" | "pluginCodingHomeworkSubmissionFile" | "pluginCodingHomeworkSubmissionFunction" | "pluginCodingHomeworkChallengeQuestion" | "pluginCodingHomeworkReview"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      PluginCodingHomeworkAssignment: {
        payload: Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkAssignmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkAssignmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkAssignmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkAssignmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkAssignmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkAssignmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkAssignmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkAssignmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkAssignmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkAssignmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkAssignmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkAssignmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkAssignmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkAssignmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAssignmentPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkAssignmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkAssignment>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkAssignmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkAssignmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkAssignmentCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkAssignmentCountAggregateOutputType> | number
          }
        }
      }
      PluginBankCodingHomeworkAssignment: {
        payload: Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>
        fields: Prisma.PluginBankCodingHomeworkAssignmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginBankCodingHomeworkAssignmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginBankCodingHomeworkAssignmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload>
          }
          findFirst: {
            args: Prisma.PluginBankCodingHomeworkAssignmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginBankCodingHomeworkAssignmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload>
          }
          findMany: {
            args: Prisma.PluginBankCodingHomeworkAssignmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload>[]
          }
          create: {
            args: Prisma.PluginBankCodingHomeworkAssignmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload>
          }
          createMany: {
            args: Prisma.PluginBankCodingHomeworkAssignmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginBankCodingHomeworkAssignmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload>[]
          }
          delete: {
            args: Prisma.PluginBankCodingHomeworkAssignmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload>
          }
          update: {
            args: Prisma.PluginBankCodingHomeworkAssignmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload>
          }
          deleteMany: {
            args: Prisma.PluginBankCodingHomeworkAssignmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginBankCodingHomeworkAssignmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginBankCodingHomeworkAssignmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload>
          }
          aggregate: {
            args: Prisma.PluginBankCodingHomeworkAssignmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginBankCodingHomeworkAssignment>
          }
          groupBy: {
            args: Prisma.PluginBankCodingHomeworkAssignmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginBankCodingHomeworkAssignmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginBankCodingHomeworkAssignmentCountArgs<ExtArgs>
            result: $Utils.Optional<PluginBankCodingHomeworkAssignmentCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkSubmissionRequirementSet: {
        payload: Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkSubmissionRequirementSetFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkSubmissionRequirementSet>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkSubmissionRequirementSetGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkSubmissionRequirementSetCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkSubmissionRequirementSetCountAggregateOutputType> | number
          }
        }
      }
      PluginBankCodingHomeworkSubmissionRequirementSet: {
        payload: Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>
        fields: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>
          }
          findFirst: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>
          }
          findMany: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>[]
          }
          create: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>
          }
          createMany: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>[]
          }
          delete: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>
          }
          update: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>
          }
          deleteMany: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload>
          }
          aggregate: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginBankCodingHomeworkSubmissionRequirementSet>
          }
          groupBy: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginBankCodingHomeworkSubmissionRequirementSetGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginBankCodingHomeworkSubmissionRequirementSetCountArgs<ExtArgs>
            result: $Utils.Optional<PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkAttachment: {
        payload: Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkAttachmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkAttachmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkAttachmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkAttachmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkAttachmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkAttachmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkAttachmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkAttachmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkAttachmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkAttachmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkAttachmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkAttachmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkAttachmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkAttachmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkAttachmentPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkAttachmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkAttachment>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkAttachmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkAttachmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkAttachmentCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkAttachmentCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkDocumentationSnapshot: {
        payload: Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkDocumentationSnapshotFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkDocumentationSnapshot>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkDocumentationSnapshotGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkDocumentationSnapshotCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkDocumentationSnapshotCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkReferenceFunction: {
        payload: Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkReferenceFunctionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkReferenceFunction>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkReferenceFunctionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkReferenceFunctionCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkReferenceFunctionCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkSubmission: {
        payload: Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkSubmissionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkSubmissionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkSubmissionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkSubmissionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkSubmissionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkSubmissionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkSubmissionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkSubmissionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkSubmissionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkSubmissionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkSubmissionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkSubmissionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkSubmissionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkSubmissionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkSubmission>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkSubmissionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkSubmissionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkSubmissionCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkSubmissionCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkSubmissionFile: {
        payload: Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkSubmissionFileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkSubmissionFileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkSubmissionFileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkSubmissionFileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkSubmissionFileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkSubmissionFileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkSubmissionFileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkSubmissionFileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkSubmissionFileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkSubmissionFileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkSubmissionFileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkSubmissionFile>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkSubmissionFileGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkSubmissionFileGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkSubmissionFileCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkSubmissionFileCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkSubmissionFunction: {
        payload: Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkSubmissionFunctionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkSubmissionFunction>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkSubmissionFunctionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkSubmissionFunctionCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkSubmissionFunctionCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkChallengeQuestion: {
        payload: Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkChallengeQuestionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkChallengeQuestion>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkChallengeQuestionGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkChallengeQuestionCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkChallengeQuestionCountAggregateOutputType> | number
          }
        }
      }
      PluginCodingHomeworkReview: {
        payload: Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>
        fields: Prisma.PluginCodingHomeworkReviewFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PluginCodingHomeworkReviewFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PluginCodingHomeworkReviewFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload>
          }
          findFirst: {
            args: Prisma.PluginCodingHomeworkReviewFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PluginCodingHomeworkReviewFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload>
          }
          findMany: {
            args: Prisma.PluginCodingHomeworkReviewFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload>[]
          }
          create: {
            args: Prisma.PluginCodingHomeworkReviewCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload>
          }
          createMany: {
            args: Prisma.PluginCodingHomeworkReviewCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PluginCodingHomeworkReviewCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload>[]
          }
          delete: {
            args: Prisma.PluginCodingHomeworkReviewDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload>
          }
          update: {
            args: Prisma.PluginCodingHomeworkReviewUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload>
          }
          deleteMany: {
            args: Prisma.PluginCodingHomeworkReviewDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PluginCodingHomeworkReviewUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PluginCodingHomeworkReviewUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PluginCodingHomeworkReviewPayload>
          }
          aggregate: {
            args: Prisma.PluginCodingHomeworkReviewAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePluginCodingHomeworkReview>
          }
          groupBy: {
            args: Prisma.PluginCodingHomeworkReviewGroupByArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkReviewGroupByOutputType>[]
          }
          count: {
            args: Prisma.PluginCodingHomeworkReviewCountArgs<ExtArgs>
            result: $Utils.Optional<PluginCodingHomeworkReviewCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type PluginCodingHomeworkDocumentationSnapshotCountOutputType
   */

  export type PluginCodingHomeworkDocumentationSnapshotCountOutputType = {
    referenceFunctions: number
    submissions: number
  }

  export type PluginCodingHomeworkDocumentationSnapshotCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    referenceFunctions?: boolean | PluginCodingHomeworkDocumentationSnapshotCountOutputTypeCountReferenceFunctionsArgs
    submissions?: boolean | PluginCodingHomeworkDocumentationSnapshotCountOutputTypeCountSubmissionsArgs
  }

  // Custom InputTypes
  /**
   * PluginCodingHomeworkDocumentationSnapshotCountOutputType without action
   */
  export type PluginCodingHomeworkDocumentationSnapshotCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshotCountOutputType
     */
    select?: PluginCodingHomeworkDocumentationSnapshotCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshotCountOutputType without action
   */
  export type PluginCodingHomeworkDocumentationSnapshotCountOutputTypeCountReferenceFunctionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshotCountOutputType without action
   */
  export type PluginCodingHomeworkDocumentationSnapshotCountOutputTypeCountSubmissionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkSubmissionWhereInput
  }


  /**
   * Count Type PluginCodingHomeworkSubmissionCountOutputType
   */

  export type PluginCodingHomeworkSubmissionCountOutputType = {
    files: number
    functions: number
    questions: number
    reviews: number
  }

  export type PluginCodingHomeworkSubmissionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    files?: boolean | PluginCodingHomeworkSubmissionCountOutputTypeCountFilesArgs
    functions?: boolean | PluginCodingHomeworkSubmissionCountOutputTypeCountFunctionsArgs
    questions?: boolean | PluginCodingHomeworkSubmissionCountOutputTypeCountQuestionsArgs
    reviews?: boolean | PluginCodingHomeworkSubmissionCountOutputTypeCountReviewsArgs
  }

  // Custom InputTypes
  /**
   * PluginCodingHomeworkSubmissionCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionCountOutputType
     */
    select?: PluginCodingHomeworkSubmissionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkSubmissionCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionCountOutputTypeCountFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkSubmissionFileWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionCountOutputTypeCountFunctionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionCountOutputTypeCountQuestionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionCountOutputTypeCountReviewsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkReviewWhereInput
  }


  /**
   * Count Type PluginCodingHomeworkSubmissionFileCountOutputType
   */

  export type PluginCodingHomeworkSubmissionFileCountOutputType = {
    functions: number
  }

  export type PluginCodingHomeworkSubmissionFileCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    functions?: boolean | PluginCodingHomeworkSubmissionFileCountOutputTypeCountFunctionsArgs
  }

  // Custom InputTypes
  /**
   * PluginCodingHomeworkSubmissionFileCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionFileCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFileCountOutputType
     */
    select?: PluginCodingHomeworkSubmissionFileCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkSubmissionFileCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionFileCountOutputTypeCountFunctionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
  }


  /**
   * Count Type PluginCodingHomeworkSubmissionFunctionCountOutputType
   */

  export type PluginCodingHomeworkSubmissionFunctionCountOutputType = {
    questions: number
  }

  export type PluginCodingHomeworkSubmissionFunctionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    questions?: boolean | PluginCodingHomeworkSubmissionFunctionCountOutputTypeCountQuestionsArgs
  }

  // Custom InputTypes
  /**
   * PluginCodingHomeworkSubmissionFunctionCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionFunctionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunctionCountOutputType
     */
    select?: PluginCodingHomeworkSubmissionFunctionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkSubmissionFunctionCountOutputType without action
   */
  export type PluginCodingHomeworkSubmissionFunctionCountOutputTypeCountQuestionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model PluginCodingHomeworkAssignment
   */

  export type AggregatePluginCodingHomeworkAssignment = {
    _count: PluginCodingHomeworkAssignmentCountAggregateOutputType | null
    _avg: PluginCodingHomeworkAssignmentAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkAssignmentSumAggregateOutputType | null
    _min: PluginCodingHomeworkAssignmentMinAggregateOutputType | null
    _max: PluginCodingHomeworkAssignmentMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkAssignmentAvgAggregateOutputType = {
    candidateLimit: number | null
    retrievedExampleCount: number | null
    questionCount: number | null
  }

  export type PluginCodingHomeworkAssignmentSumAggregateOutputType = {
    candidateLimit: number | null
    retrievedExampleCount: number | null
    questionCount: number | null
  }

  export type PluginCodingHomeworkAssignmentMinAggregateOutputType = {
    id: string | null
    activityId: string | null
    promptMarkdown: string | null
    promptPdfAttachmentId: string | null
    languageKey: string | null
    candidateLimit: number | null
    retrievedExampleCount: number | null
    questionCount: number | null
    generationInstructions: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkAssignmentMaxAggregateOutputType = {
    id: string | null
    activityId: string | null
    promptMarkdown: string | null
    promptPdfAttachmentId: string | null
    languageKey: string | null
    candidateLimit: number | null
    retrievedExampleCount: number | null
    questionCount: number | null
    generationInstructions: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkAssignmentCountAggregateOutputType = {
    id: number
    activityId: number
    promptMarkdown: number
    promptPdfAttachmentId: number
    languageKey: number
    candidateLimit: number
    retrievedExampleCount: number
    questionCount: number
    generationInstructions: number
    settings: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkAssignmentAvgAggregateInputType = {
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
  }

  export type PluginCodingHomeworkAssignmentSumAggregateInputType = {
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
  }

  export type PluginCodingHomeworkAssignmentMinAggregateInputType = {
    id?: true
    activityId?: true
    promptMarkdown?: true
    promptPdfAttachmentId?: true
    languageKey?: true
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
    generationInstructions?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkAssignmentMaxAggregateInputType = {
    id?: true
    activityId?: true
    promptMarkdown?: true
    promptPdfAttachmentId?: true
    languageKey?: true
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
    generationInstructions?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkAssignmentCountAggregateInputType = {
    id?: true
    activityId?: true
    promptMarkdown?: true
    promptPdfAttachmentId?: true
    languageKey?: true
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
    generationInstructions?: true
    settings?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkAssignmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkAssignment to aggregate.
     */
    where?: PluginCodingHomeworkAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkAssignments to fetch.
     */
    orderBy?: PluginCodingHomeworkAssignmentOrderByWithRelationInput | PluginCodingHomeworkAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkAssignments
    **/
    _count?: true | PluginCodingHomeworkAssignmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PluginCodingHomeworkAssignmentAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PluginCodingHomeworkAssignmentSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkAssignmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkAssignmentMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkAssignmentAggregateType<T extends PluginCodingHomeworkAssignmentAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkAssignment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkAssignment[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkAssignment[P]>
  }




  export type PluginCodingHomeworkAssignmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkAssignmentWhereInput
    orderBy?: PluginCodingHomeworkAssignmentOrderByWithAggregationInput | PluginCodingHomeworkAssignmentOrderByWithAggregationInput[]
    by: PluginCodingHomeworkAssignmentScalarFieldEnum[] | PluginCodingHomeworkAssignmentScalarFieldEnum
    having?: PluginCodingHomeworkAssignmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkAssignmentCountAggregateInputType | true
    _avg?: PluginCodingHomeworkAssignmentAvgAggregateInputType
    _sum?: PluginCodingHomeworkAssignmentSumAggregateInputType
    _min?: PluginCodingHomeworkAssignmentMinAggregateInputType
    _max?: PluginCodingHomeworkAssignmentMaxAggregateInputType
  }

  export type PluginCodingHomeworkAssignmentGroupByOutputType = {
    id: string
    activityId: string
    promptMarkdown: string
    promptPdfAttachmentId: string | null
    languageKey: string
    candidateLimit: number
    retrievedExampleCount: number
    questionCount: number
    generationInstructions: string
    settings: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkAssignmentCountAggregateOutputType | null
    _avg: PluginCodingHomeworkAssignmentAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkAssignmentSumAggregateOutputType | null
    _min: PluginCodingHomeworkAssignmentMinAggregateOutputType | null
    _max: PluginCodingHomeworkAssignmentMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkAssignmentGroupByPayload<T extends PluginCodingHomeworkAssignmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkAssignmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkAssignmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkAssignmentGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkAssignmentGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkAssignmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    activityId?: boolean
    promptMarkdown?: boolean
    promptPdfAttachmentId?: boolean
    languageKey?: boolean
    candidateLimit?: boolean
    retrievedExampleCount?: boolean
    questionCount?: boolean
    generationInstructions?: boolean
    settings?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginCodingHomeworkAssignment"]>

  export type PluginCodingHomeworkAssignmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    activityId?: boolean
    promptMarkdown?: boolean
    promptPdfAttachmentId?: boolean
    languageKey?: boolean
    candidateLimit?: boolean
    retrievedExampleCount?: boolean
    questionCount?: boolean
    generationInstructions?: boolean
    settings?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginCodingHomeworkAssignment"]>

  export type PluginCodingHomeworkAssignmentSelectScalar = {
    id?: boolean
    activityId?: boolean
    promptMarkdown?: boolean
    promptPdfAttachmentId?: boolean
    languageKey?: boolean
    candidateLimit?: boolean
    retrievedExampleCount?: boolean
    questionCount?: boolean
    generationInstructions?: boolean
    settings?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }


  export type $PluginCodingHomeworkAssignmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkAssignment"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      activityId: string
      promptMarkdown: string
      promptPdfAttachmentId: string | null
      languageKey: string
      candidateLimit: number
      retrievedExampleCount: number
      questionCount: number
      generationInstructions: string
      settings: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkAssignment"]>
    composites: {}
  }

  type PluginCodingHomeworkAssignmentGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkAssignmentDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload, S>

  type PluginCodingHomeworkAssignmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkAssignmentFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkAssignmentCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkAssignmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkAssignment'], meta: { name: 'PluginCodingHomeworkAssignment' } }
    /**
     * Find zero or one PluginCodingHomeworkAssignment that matches the filter.
     * @param {PluginCodingHomeworkAssignmentFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkAssignment
     * @example
     * // Get one PluginCodingHomeworkAssignment
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkAssignmentFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkAssignmentFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkAssignment that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkAssignmentFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkAssignment
     * @example
     * // Get one PluginCodingHomeworkAssignment
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkAssignmentFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkAssignmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkAssignment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAssignmentFindFirstArgs} args - Arguments to find a PluginCodingHomeworkAssignment
     * @example
     * // Get one PluginCodingHomeworkAssignment
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkAssignmentFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkAssignmentFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkAssignment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAssignmentFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkAssignment
     * @example
     * // Get one PluginCodingHomeworkAssignment
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkAssignmentFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkAssignmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkAssignments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAssignmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkAssignments
     * const pluginCodingHomeworkAssignments = await prisma.pluginCodingHomeworkAssignment.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkAssignments
     * const pluginCodingHomeworkAssignments = await prisma.pluginCodingHomeworkAssignment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkAssignmentWithIdOnly = await prisma.pluginCodingHomeworkAssignment.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkAssignmentFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkAssignmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkAssignment.
     * @param {PluginCodingHomeworkAssignmentCreateArgs} args - Arguments to create a PluginCodingHomeworkAssignment.
     * @example
     * // Create one PluginCodingHomeworkAssignment
     * const PluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkAssignment
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkAssignmentCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkAssignmentCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkAssignments.
     * @param {PluginCodingHomeworkAssignmentCreateManyArgs} args - Arguments to create many PluginCodingHomeworkAssignments.
     * @example
     * // Create many PluginCodingHomeworkAssignments
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkAssignmentCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkAssignmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkAssignments and returns the data saved in the database.
     * @param {PluginCodingHomeworkAssignmentCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkAssignments.
     * @example
     * // Create many PluginCodingHomeworkAssignments
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkAssignments and only return the `id`
     * const pluginCodingHomeworkAssignmentWithIdOnly = await prisma.pluginCodingHomeworkAssignment.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkAssignmentCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkAssignmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkAssignment.
     * @param {PluginCodingHomeworkAssignmentDeleteArgs} args - Arguments to delete one PluginCodingHomeworkAssignment.
     * @example
     * // Delete one PluginCodingHomeworkAssignment
     * const PluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkAssignment
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkAssignmentDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkAssignmentDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkAssignment.
     * @param {PluginCodingHomeworkAssignmentUpdateArgs} args - Arguments to update one PluginCodingHomeworkAssignment.
     * @example
     * // Update one PluginCodingHomeworkAssignment
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkAssignmentUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkAssignmentUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkAssignments.
     * @param {PluginCodingHomeworkAssignmentDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkAssignments to delete.
     * @example
     * // Delete a few PluginCodingHomeworkAssignments
     * const { count } = await prisma.pluginCodingHomeworkAssignment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkAssignmentDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkAssignmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkAssignments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAssignmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkAssignments
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkAssignmentUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkAssignmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkAssignment.
     * @param {PluginCodingHomeworkAssignmentUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkAssignment.
     * @example
     * // Update or create a PluginCodingHomeworkAssignment
     * const pluginCodingHomeworkAssignment = await prisma.pluginCodingHomeworkAssignment.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkAssignment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkAssignment we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkAssignmentUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkAssignmentUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAssignmentPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkAssignments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAssignmentCountArgs} args - Arguments to filter PluginCodingHomeworkAssignments to count.
     * @example
     * // Count the number of PluginCodingHomeworkAssignments
     * const count = await prisma.pluginCodingHomeworkAssignment.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkAssignments we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkAssignmentCountArgs>(
      args?: Subset<T, PluginCodingHomeworkAssignmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkAssignmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkAssignment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAssignmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkAssignmentAggregateArgs>(args: Subset<T, PluginCodingHomeworkAssignmentAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkAssignmentAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkAssignment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAssignmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkAssignmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkAssignmentGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkAssignmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkAssignmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkAssignmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkAssignment model
   */
  readonly fields: PluginCodingHomeworkAssignmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkAssignment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkAssignmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkAssignment model
   */ 
  interface PluginCodingHomeworkAssignmentFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkAssignment", 'String'>
    readonly activityId: FieldRef<"PluginCodingHomeworkAssignment", 'String'>
    readonly promptMarkdown: FieldRef<"PluginCodingHomeworkAssignment", 'String'>
    readonly promptPdfAttachmentId: FieldRef<"PluginCodingHomeworkAssignment", 'String'>
    readonly languageKey: FieldRef<"PluginCodingHomeworkAssignment", 'String'>
    readonly candidateLimit: FieldRef<"PluginCodingHomeworkAssignment", 'Int'>
    readonly retrievedExampleCount: FieldRef<"PluginCodingHomeworkAssignment", 'Int'>
    readonly questionCount: FieldRef<"PluginCodingHomeworkAssignment", 'Int'>
    readonly generationInstructions: FieldRef<"PluginCodingHomeworkAssignment", 'String'>
    readonly settings: FieldRef<"PluginCodingHomeworkAssignment", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkAssignment", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkAssignment", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkAssignment findUnique
   */
  export type PluginCodingHomeworkAssignmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAssignment to fetch.
     */
    where: PluginCodingHomeworkAssignmentWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkAssignment findUniqueOrThrow
   */
  export type PluginCodingHomeworkAssignmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAssignment to fetch.
     */
    where: PluginCodingHomeworkAssignmentWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkAssignment findFirst
   */
  export type PluginCodingHomeworkAssignmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAssignment to fetch.
     */
    where?: PluginCodingHomeworkAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkAssignments to fetch.
     */
    orderBy?: PluginCodingHomeworkAssignmentOrderByWithRelationInput | PluginCodingHomeworkAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkAssignments.
     */
    cursor?: PluginCodingHomeworkAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkAssignments.
     */
    distinct?: PluginCodingHomeworkAssignmentScalarFieldEnum | PluginCodingHomeworkAssignmentScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkAssignment findFirstOrThrow
   */
  export type PluginCodingHomeworkAssignmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAssignment to fetch.
     */
    where?: PluginCodingHomeworkAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkAssignments to fetch.
     */
    orderBy?: PluginCodingHomeworkAssignmentOrderByWithRelationInput | PluginCodingHomeworkAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkAssignments.
     */
    cursor?: PluginCodingHomeworkAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkAssignments.
     */
    distinct?: PluginCodingHomeworkAssignmentScalarFieldEnum | PluginCodingHomeworkAssignmentScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkAssignment findMany
   */
  export type PluginCodingHomeworkAssignmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAssignments to fetch.
     */
    where?: PluginCodingHomeworkAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkAssignments to fetch.
     */
    orderBy?: PluginCodingHomeworkAssignmentOrderByWithRelationInput | PluginCodingHomeworkAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkAssignments.
     */
    cursor?: PluginCodingHomeworkAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkAssignments.
     */
    skip?: number
    distinct?: PluginCodingHomeworkAssignmentScalarFieldEnum | PluginCodingHomeworkAssignmentScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkAssignment create
   */
  export type PluginCodingHomeworkAssignmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkAssignment.
     */
    data: XOR<PluginCodingHomeworkAssignmentCreateInput, PluginCodingHomeworkAssignmentUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkAssignment createMany
   */
  export type PluginCodingHomeworkAssignmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkAssignments.
     */
    data: PluginCodingHomeworkAssignmentCreateManyInput | PluginCodingHomeworkAssignmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkAssignment createManyAndReturn
   */
  export type PluginCodingHomeworkAssignmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkAssignments.
     */
    data: PluginCodingHomeworkAssignmentCreateManyInput | PluginCodingHomeworkAssignmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkAssignment update
   */
  export type PluginCodingHomeworkAssignmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkAssignment.
     */
    data: XOR<PluginCodingHomeworkAssignmentUpdateInput, PluginCodingHomeworkAssignmentUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkAssignment to update.
     */
    where: PluginCodingHomeworkAssignmentWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkAssignment updateMany
   */
  export type PluginCodingHomeworkAssignmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkAssignments.
     */
    data: XOR<PluginCodingHomeworkAssignmentUpdateManyMutationInput, PluginCodingHomeworkAssignmentUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkAssignments to update
     */
    where?: PluginCodingHomeworkAssignmentWhereInput
  }

  /**
   * PluginCodingHomeworkAssignment upsert
   */
  export type PluginCodingHomeworkAssignmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkAssignment to update in case it exists.
     */
    where: PluginCodingHomeworkAssignmentWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkAssignment found by the `where` argument doesn't exist, create a new PluginCodingHomeworkAssignment with this data.
     */
    create: XOR<PluginCodingHomeworkAssignmentCreateInput, PluginCodingHomeworkAssignmentUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkAssignment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkAssignmentUpdateInput, PluginCodingHomeworkAssignmentUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkAssignment delete
   */
  export type PluginCodingHomeworkAssignmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkAssignment to delete.
     */
    where: PluginCodingHomeworkAssignmentWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkAssignment deleteMany
   */
  export type PluginCodingHomeworkAssignmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkAssignments to delete
     */
    where?: PluginCodingHomeworkAssignmentWhereInput
  }

  /**
   * PluginCodingHomeworkAssignment without action
   */
  export type PluginCodingHomeworkAssignmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAssignment
     */
    select?: PluginCodingHomeworkAssignmentSelect<ExtArgs> | null
  }


  /**
   * Model PluginBankCodingHomeworkAssignment
   */

  export type AggregatePluginBankCodingHomeworkAssignment = {
    _count: PluginBankCodingHomeworkAssignmentCountAggregateOutputType | null
    _avg: PluginBankCodingHomeworkAssignmentAvgAggregateOutputType | null
    _sum: PluginBankCodingHomeworkAssignmentSumAggregateOutputType | null
    _min: PluginBankCodingHomeworkAssignmentMinAggregateOutputType | null
    _max: PluginBankCodingHomeworkAssignmentMaxAggregateOutputType | null
  }

  export type PluginBankCodingHomeworkAssignmentAvgAggregateOutputType = {
    candidateLimit: number | null
    retrievedExampleCount: number | null
    questionCount: number | null
  }

  export type PluginBankCodingHomeworkAssignmentSumAggregateOutputType = {
    candidateLimit: number | null
    retrievedExampleCount: number | null
    questionCount: number | null
  }

  export type PluginBankCodingHomeworkAssignmentMinAggregateOutputType = {
    id: string | null
    bankActivityId: string | null
    promptMarkdown: string | null
    promptPdfAttachmentId: string | null
    languageKey: string | null
    candidateLimit: number | null
    retrievedExampleCount: number | null
    questionCount: number | null
    generationInstructions: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginBankCodingHomeworkAssignmentMaxAggregateOutputType = {
    id: string | null
    bankActivityId: string | null
    promptMarkdown: string | null
    promptPdfAttachmentId: string | null
    languageKey: string | null
    candidateLimit: number | null
    retrievedExampleCount: number | null
    questionCount: number | null
    generationInstructions: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginBankCodingHomeworkAssignmentCountAggregateOutputType = {
    id: number
    bankActivityId: number
    promptMarkdown: number
    promptPdfAttachmentId: number
    languageKey: number
    candidateLimit: number
    retrievedExampleCount: number
    questionCount: number
    generationInstructions: number
    settings: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginBankCodingHomeworkAssignmentAvgAggregateInputType = {
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
  }

  export type PluginBankCodingHomeworkAssignmentSumAggregateInputType = {
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
  }

  export type PluginBankCodingHomeworkAssignmentMinAggregateInputType = {
    id?: true
    bankActivityId?: true
    promptMarkdown?: true
    promptPdfAttachmentId?: true
    languageKey?: true
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
    generationInstructions?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginBankCodingHomeworkAssignmentMaxAggregateInputType = {
    id?: true
    bankActivityId?: true
    promptMarkdown?: true
    promptPdfAttachmentId?: true
    languageKey?: true
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
    generationInstructions?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginBankCodingHomeworkAssignmentCountAggregateInputType = {
    id?: true
    bankActivityId?: true
    promptMarkdown?: true
    promptPdfAttachmentId?: true
    languageKey?: true
    candidateLimit?: true
    retrievedExampleCount?: true
    questionCount?: true
    generationInstructions?: true
    settings?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginBankCodingHomeworkAssignmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginBankCodingHomeworkAssignment to aggregate.
     */
    where?: PluginBankCodingHomeworkAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginBankCodingHomeworkAssignments to fetch.
     */
    orderBy?: PluginBankCodingHomeworkAssignmentOrderByWithRelationInput | PluginBankCodingHomeworkAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginBankCodingHomeworkAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginBankCodingHomeworkAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginBankCodingHomeworkAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginBankCodingHomeworkAssignments
    **/
    _count?: true | PluginBankCodingHomeworkAssignmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PluginBankCodingHomeworkAssignmentAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PluginBankCodingHomeworkAssignmentSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginBankCodingHomeworkAssignmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginBankCodingHomeworkAssignmentMaxAggregateInputType
  }

  export type GetPluginBankCodingHomeworkAssignmentAggregateType<T extends PluginBankCodingHomeworkAssignmentAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginBankCodingHomeworkAssignment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginBankCodingHomeworkAssignment[P]>
      : GetScalarType<T[P], AggregatePluginBankCodingHomeworkAssignment[P]>
  }




  export type PluginBankCodingHomeworkAssignmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginBankCodingHomeworkAssignmentWhereInput
    orderBy?: PluginBankCodingHomeworkAssignmentOrderByWithAggregationInput | PluginBankCodingHomeworkAssignmentOrderByWithAggregationInput[]
    by: PluginBankCodingHomeworkAssignmentScalarFieldEnum[] | PluginBankCodingHomeworkAssignmentScalarFieldEnum
    having?: PluginBankCodingHomeworkAssignmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginBankCodingHomeworkAssignmentCountAggregateInputType | true
    _avg?: PluginBankCodingHomeworkAssignmentAvgAggregateInputType
    _sum?: PluginBankCodingHomeworkAssignmentSumAggregateInputType
    _min?: PluginBankCodingHomeworkAssignmentMinAggregateInputType
    _max?: PluginBankCodingHomeworkAssignmentMaxAggregateInputType
  }

  export type PluginBankCodingHomeworkAssignmentGroupByOutputType = {
    id: string
    bankActivityId: string
    promptMarkdown: string
    promptPdfAttachmentId: string | null
    languageKey: string
    candidateLimit: number
    retrievedExampleCount: number
    questionCount: number
    generationInstructions: string
    settings: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginBankCodingHomeworkAssignmentCountAggregateOutputType | null
    _avg: PluginBankCodingHomeworkAssignmentAvgAggregateOutputType | null
    _sum: PluginBankCodingHomeworkAssignmentSumAggregateOutputType | null
    _min: PluginBankCodingHomeworkAssignmentMinAggregateOutputType | null
    _max: PluginBankCodingHomeworkAssignmentMaxAggregateOutputType | null
  }

  type GetPluginBankCodingHomeworkAssignmentGroupByPayload<T extends PluginBankCodingHomeworkAssignmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginBankCodingHomeworkAssignmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginBankCodingHomeworkAssignmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginBankCodingHomeworkAssignmentGroupByOutputType[P]>
            : GetScalarType<T[P], PluginBankCodingHomeworkAssignmentGroupByOutputType[P]>
        }
      >
    >


  export type PluginBankCodingHomeworkAssignmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bankActivityId?: boolean
    promptMarkdown?: boolean
    promptPdfAttachmentId?: boolean
    languageKey?: boolean
    candidateLimit?: boolean
    retrievedExampleCount?: boolean
    questionCount?: boolean
    generationInstructions?: boolean
    settings?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginBankCodingHomeworkAssignment"]>

  export type PluginBankCodingHomeworkAssignmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bankActivityId?: boolean
    promptMarkdown?: boolean
    promptPdfAttachmentId?: boolean
    languageKey?: boolean
    candidateLimit?: boolean
    retrievedExampleCount?: boolean
    questionCount?: boolean
    generationInstructions?: boolean
    settings?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginBankCodingHomeworkAssignment"]>

  export type PluginBankCodingHomeworkAssignmentSelectScalar = {
    id?: boolean
    bankActivityId?: boolean
    promptMarkdown?: boolean
    promptPdfAttachmentId?: boolean
    languageKey?: boolean
    candidateLimit?: boolean
    retrievedExampleCount?: boolean
    questionCount?: boolean
    generationInstructions?: boolean
    settings?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }


  export type $PluginBankCodingHomeworkAssignmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginBankCodingHomeworkAssignment"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bankActivityId: string
      promptMarkdown: string
      promptPdfAttachmentId: string | null
      languageKey: string
      candidateLimit: number
      retrievedExampleCount: number
      questionCount: number
      generationInstructions: string
      settings: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginBankCodingHomeworkAssignment"]>
    composites: {}
  }

  type PluginBankCodingHomeworkAssignmentGetPayload<S extends boolean | null | undefined | PluginBankCodingHomeworkAssignmentDefaultArgs> = $Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload, S>

  type PluginBankCodingHomeworkAssignmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginBankCodingHomeworkAssignmentFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginBankCodingHomeworkAssignmentCountAggregateInputType | true
    }

  export interface PluginBankCodingHomeworkAssignmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginBankCodingHomeworkAssignment'], meta: { name: 'PluginBankCodingHomeworkAssignment' } }
    /**
     * Find zero or one PluginBankCodingHomeworkAssignment that matches the filter.
     * @param {PluginBankCodingHomeworkAssignmentFindUniqueArgs} args - Arguments to find a PluginBankCodingHomeworkAssignment
     * @example
     * // Get one PluginBankCodingHomeworkAssignment
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginBankCodingHomeworkAssignmentFindUniqueArgs>(args: SelectSubset<T, PluginBankCodingHomeworkAssignmentFindUniqueArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginBankCodingHomeworkAssignment that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginBankCodingHomeworkAssignmentFindUniqueOrThrowArgs} args - Arguments to find a PluginBankCodingHomeworkAssignment
     * @example
     * // Get one PluginBankCodingHomeworkAssignment
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginBankCodingHomeworkAssignmentFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginBankCodingHomeworkAssignmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginBankCodingHomeworkAssignment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkAssignmentFindFirstArgs} args - Arguments to find a PluginBankCodingHomeworkAssignment
     * @example
     * // Get one PluginBankCodingHomeworkAssignment
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginBankCodingHomeworkAssignmentFindFirstArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkAssignmentFindFirstArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginBankCodingHomeworkAssignment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkAssignmentFindFirstOrThrowArgs} args - Arguments to find a PluginBankCodingHomeworkAssignment
     * @example
     * // Get one PluginBankCodingHomeworkAssignment
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginBankCodingHomeworkAssignmentFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkAssignmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginBankCodingHomeworkAssignments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkAssignmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginBankCodingHomeworkAssignments
     * const pluginBankCodingHomeworkAssignments = await prisma.pluginBankCodingHomeworkAssignment.findMany()
     * 
     * // Get first 10 PluginBankCodingHomeworkAssignments
     * const pluginBankCodingHomeworkAssignments = await prisma.pluginBankCodingHomeworkAssignment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginBankCodingHomeworkAssignmentWithIdOnly = await prisma.pluginBankCodingHomeworkAssignment.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginBankCodingHomeworkAssignmentFindManyArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkAssignmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginBankCodingHomeworkAssignment.
     * @param {PluginBankCodingHomeworkAssignmentCreateArgs} args - Arguments to create a PluginBankCodingHomeworkAssignment.
     * @example
     * // Create one PluginBankCodingHomeworkAssignment
     * const PluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.create({
     *   data: {
     *     // ... data to create a PluginBankCodingHomeworkAssignment
     *   }
     * })
     * 
     */
    create<T extends PluginBankCodingHomeworkAssignmentCreateArgs>(args: SelectSubset<T, PluginBankCodingHomeworkAssignmentCreateArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginBankCodingHomeworkAssignments.
     * @param {PluginBankCodingHomeworkAssignmentCreateManyArgs} args - Arguments to create many PluginBankCodingHomeworkAssignments.
     * @example
     * // Create many PluginBankCodingHomeworkAssignments
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginBankCodingHomeworkAssignmentCreateManyArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkAssignmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginBankCodingHomeworkAssignments and returns the data saved in the database.
     * @param {PluginBankCodingHomeworkAssignmentCreateManyAndReturnArgs} args - Arguments to create many PluginBankCodingHomeworkAssignments.
     * @example
     * // Create many PluginBankCodingHomeworkAssignments
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginBankCodingHomeworkAssignments and only return the `id`
     * const pluginBankCodingHomeworkAssignmentWithIdOnly = await prisma.pluginBankCodingHomeworkAssignment.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginBankCodingHomeworkAssignmentCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkAssignmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginBankCodingHomeworkAssignment.
     * @param {PluginBankCodingHomeworkAssignmentDeleteArgs} args - Arguments to delete one PluginBankCodingHomeworkAssignment.
     * @example
     * // Delete one PluginBankCodingHomeworkAssignment
     * const PluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.delete({
     *   where: {
     *     // ... filter to delete one PluginBankCodingHomeworkAssignment
     *   }
     * })
     * 
     */
    delete<T extends PluginBankCodingHomeworkAssignmentDeleteArgs>(args: SelectSubset<T, PluginBankCodingHomeworkAssignmentDeleteArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginBankCodingHomeworkAssignment.
     * @param {PluginBankCodingHomeworkAssignmentUpdateArgs} args - Arguments to update one PluginBankCodingHomeworkAssignment.
     * @example
     * // Update one PluginBankCodingHomeworkAssignment
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginBankCodingHomeworkAssignmentUpdateArgs>(args: SelectSubset<T, PluginBankCodingHomeworkAssignmentUpdateArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginBankCodingHomeworkAssignments.
     * @param {PluginBankCodingHomeworkAssignmentDeleteManyArgs} args - Arguments to filter PluginBankCodingHomeworkAssignments to delete.
     * @example
     * // Delete a few PluginBankCodingHomeworkAssignments
     * const { count } = await prisma.pluginBankCodingHomeworkAssignment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginBankCodingHomeworkAssignmentDeleteManyArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkAssignmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginBankCodingHomeworkAssignments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkAssignmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginBankCodingHomeworkAssignments
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginBankCodingHomeworkAssignmentUpdateManyArgs>(args: SelectSubset<T, PluginBankCodingHomeworkAssignmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginBankCodingHomeworkAssignment.
     * @param {PluginBankCodingHomeworkAssignmentUpsertArgs} args - Arguments to update or create a PluginBankCodingHomeworkAssignment.
     * @example
     * // Update or create a PluginBankCodingHomeworkAssignment
     * const pluginBankCodingHomeworkAssignment = await prisma.pluginBankCodingHomeworkAssignment.upsert({
     *   create: {
     *     // ... data to create a PluginBankCodingHomeworkAssignment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginBankCodingHomeworkAssignment we want to update
     *   }
     * })
     */
    upsert<T extends PluginBankCodingHomeworkAssignmentUpsertArgs>(args: SelectSubset<T, PluginBankCodingHomeworkAssignmentUpsertArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkAssignmentClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkAssignmentPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginBankCodingHomeworkAssignments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkAssignmentCountArgs} args - Arguments to filter PluginBankCodingHomeworkAssignments to count.
     * @example
     * // Count the number of PluginBankCodingHomeworkAssignments
     * const count = await prisma.pluginBankCodingHomeworkAssignment.count({
     *   where: {
     *     // ... the filter for the PluginBankCodingHomeworkAssignments we want to count
     *   }
     * })
    **/
    count<T extends PluginBankCodingHomeworkAssignmentCountArgs>(
      args?: Subset<T, PluginBankCodingHomeworkAssignmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginBankCodingHomeworkAssignmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginBankCodingHomeworkAssignment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkAssignmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginBankCodingHomeworkAssignmentAggregateArgs>(args: Subset<T, PluginBankCodingHomeworkAssignmentAggregateArgs>): Prisma.PrismaPromise<GetPluginBankCodingHomeworkAssignmentAggregateType<T>>

    /**
     * Group by PluginBankCodingHomeworkAssignment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkAssignmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginBankCodingHomeworkAssignmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginBankCodingHomeworkAssignmentGroupByArgs['orderBy'] }
        : { orderBy?: PluginBankCodingHomeworkAssignmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginBankCodingHomeworkAssignmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginBankCodingHomeworkAssignmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginBankCodingHomeworkAssignment model
   */
  readonly fields: PluginBankCodingHomeworkAssignmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginBankCodingHomeworkAssignment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginBankCodingHomeworkAssignmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginBankCodingHomeworkAssignment model
   */ 
  interface PluginBankCodingHomeworkAssignmentFieldRefs {
    readonly id: FieldRef<"PluginBankCodingHomeworkAssignment", 'String'>
    readonly bankActivityId: FieldRef<"PluginBankCodingHomeworkAssignment", 'String'>
    readonly promptMarkdown: FieldRef<"PluginBankCodingHomeworkAssignment", 'String'>
    readonly promptPdfAttachmentId: FieldRef<"PluginBankCodingHomeworkAssignment", 'String'>
    readonly languageKey: FieldRef<"PluginBankCodingHomeworkAssignment", 'String'>
    readonly candidateLimit: FieldRef<"PluginBankCodingHomeworkAssignment", 'Int'>
    readonly retrievedExampleCount: FieldRef<"PluginBankCodingHomeworkAssignment", 'Int'>
    readonly questionCount: FieldRef<"PluginBankCodingHomeworkAssignment", 'Int'>
    readonly generationInstructions: FieldRef<"PluginBankCodingHomeworkAssignment", 'String'>
    readonly settings: FieldRef<"PluginBankCodingHomeworkAssignment", 'Json'>
    readonly createdAt: FieldRef<"PluginBankCodingHomeworkAssignment", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginBankCodingHomeworkAssignment", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginBankCodingHomeworkAssignment findUnique
   */
  export type PluginBankCodingHomeworkAssignmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkAssignment to fetch.
     */
    where: PluginBankCodingHomeworkAssignmentWhereUniqueInput
  }

  /**
   * PluginBankCodingHomeworkAssignment findUniqueOrThrow
   */
  export type PluginBankCodingHomeworkAssignmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkAssignment to fetch.
     */
    where: PluginBankCodingHomeworkAssignmentWhereUniqueInput
  }

  /**
   * PluginBankCodingHomeworkAssignment findFirst
   */
  export type PluginBankCodingHomeworkAssignmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkAssignment to fetch.
     */
    where?: PluginBankCodingHomeworkAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginBankCodingHomeworkAssignments to fetch.
     */
    orderBy?: PluginBankCodingHomeworkAssignmentOrderByWithRelationInput | PluginBankCodingHomeworkAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginBankCodingHomeworkAssignments.
     */
    cursor?: PluginBankCodingHomeworkAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginBankCodingHomeworkAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginBankCodingHomeworkAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginBankCodingHomeworkAssignments.
     */
    distinct?: PluginBankCodingHomeworkAssignmentScalarFieldEnum | PluginBankCodingHomeworkAssignmentScalarFieldEnum[]
  }

  /**
   * PluginBankCodingHomeworkAssignment findFirstOrThrow
   */
  export type PluginBankCodingHomeworkAssignmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkAssignment to fetch.
     */
    where?: PluginBankCodingHomeworkAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginBankCodingHomeworkAssignments to fetch.
     */
    orderBy?: PluginBankCodingHomeworkAssignmentOrderByWithRelationInput | PluginBankCodingHomeworkAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginBankCodingHomeworkAssignments.
     */
    cursor?: PluginBankCodingHomeworkAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginBankCodingHomeworkAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginBankCodingHomeworkAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginBankCodingHomeworkAssignments.
     */
    distinct?: PluginBankCodingHomeworkAssignmentScalarFieldEnum | PluginBankCodingHomeworkAssignmentScalarFieldEnum[]
  }

  /**
   * PluginBankCodingHomeworkAssignment findMany
   */
  export type PluginBankCodingHomeworkAssignmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkAssignments to fetch.
     */
    where?: PluginBankCodingHomeworkAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginBankCodingHomeworkAssignments to fetch.
     */
    orderBy?: PluginBankCodingHomeworkAssignmentOrderByWithRelationInput | PluginBankCodingHomeworkAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginBankCodingHomeworkAssignments.
     */
    cursor?: PluginBankCodingHomeworkAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginBankCodingHomeworkAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginBankCodingHomeworkAssignments.
     */
    skip?: number
    distinct?: PluginBankCodingHomeworkAssignmentScalarFieldEnum | PluginBankCodingHomeworkAssignmentScalarFieldEnum[]
  }

  /**
   * PluginBankCodingHomeworkAssignment create
   */
  export type PluginBankCodingHomeworkAssignmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * The data needed to create a PluginBankCodingHomeworkAssignment.
     */
    data: XOR<PluginBankCodingHomeworkAssignmentCreateInput, PluginBankCodingHomeworkAssignmentUncheckedCreateInput>
  }

  /**
   * PluginBankCodingHomeworkAssignment createMany
   */
  export type PluginBankCodingHomeworkAssignmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginBankCodingHomeworkAssignments.
     */
    data: PluginBankCodingHomeworkAssignmentCreateManyInput | PluginBankCodingHomeworkAssignmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginBankCodingHomeworkAssignment createManyAndReturn
   */
  export type PluginBankCodingHomeworkAssignmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginBankCodingHomeworkAssignments.
     */
    data: PluginBankCodingHomeworkAssignmentCreateManyInput | PluginBankCodingHomeworkAssignmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginBankCodingHomeworkAssignment update
   */
  export type PluginBankCodingHomeworkAssignmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * The data needed to update a PluginBankCodingHomeworkAssignment.
     */
    data: XOR<PluginBankCodingHomeworkAssignmentUpdateInput, PluginBankCodingHomeworkAssignmentUncheckedUpdateInput>
    /**
     * Choose, which PluginBankCodingHomeworkAssignment to update.
     */
    where: PluginBankCodingHomeworkAssignmentWhereUniqueInput
  }

  /**
   * PluginBankCodingHomeworkAssignment updateMany
   */
  export type PluginBankCodingHomeworkAssignmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginBankCodingHomeworkAssignments.
     */
    data: XOR<PluginBankCodingHomeworkAssignmentUpdateManyMutationInput, PluginBankCodingHomeworkAssignmentUncheckedUpdateManyInput>
    /**
     * Filter which PluginBankCodingHomeworkAssignments to update
     */
    where?: PluginBankCodingHomeworkAssignmentWhereInput
  }

  /**
   * PluginBankCodingHomeworkAssignment upsert
   */
  export type PluginBankCodingHomeworkAssignmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * The filter to search for the PluginBankCodingHomeworkAssignment to update in case it exists.
     */
    where: PluginBankCodingHomeworkAssignmentWhereUniqueInput
    /**
     * In case the PluginBankCodingHomeworkAssignment found by the `where` argument doesn't exist, create a new PluginBankCodingHomeworkAssignment with this data.
     */
    create: XOR<PluginBankCodingHomeworkAssignmentCreateInput, PluginBankCodingHomeworkAssignmentUncheckedCreateInput>
    /**
     * In case the PluginBankCodingHomeworkAssignment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginBankCodingHomeworkAssignmentUpdateInput, PluginBankCodingHomeworkAssignmentUncheckedUpdateInput>
  }

  /**
   * PluginBankCodingHomeworkAssignment delete
   */
  export type PluginBankCodingHomeworkAssignmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
    /**
     * Filter which PluginBankCodingHomeworkAssignment to delete.
     */
    where: PluginBankCodingHomeworkAssignmentWhereUniqueInput
  }

  /**
   * PluginBankCodingHomeworkAssignment deleteMany
   */
  export type PluginBankCodingHomeworkAssignmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginBankCodingHomeworkAssignments to delete
     */
    where?: PluginBankCodingHomeworkAssignmentWhereInput
  }

  /**
   * PluginBankCodingHomeworkAssignment without action
   */
  export type PluginBankCodingHomeworkAssignmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkAssignment
     */
    select?: PluginBankCodingHomeworkAssignmentSelect<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkSubmissionRequirementSet
   */

  export type AggregatePluginCodingHomeworkSubmissionRequirementSet = {
    _count: PluginCodingHomeworkSubmissionRequirementSetCountAggregateOutputType | null
    _min: PluginCodingHomeworkSubmissionRequirementSetMinAggregateOutputType | null
    _max: PluginCodingHomeworkSubmissionRequirementSetMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkSubmissionRequirementSetMinAggregateOutputType = {
    id: string | null
    activityId: string | null
    languageKey: string | null
    sourceAttachmentId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkSubmissionRequirementSetMaxAggregateOutputType = {
    id: string | null
    activityId: string | null
    languageKey: string | null
    sourceAttachmentId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkSubmissionRequirementSetCountAggregateOutputType = {
    id: number
    activityId: number
    languageKey: number
    requirements: number
    sourceAttachmentId: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkSubmissionRequirementSetMinAggregateInputType = {
    id?: true
    activityId?: true
    languageKey?: true
    sourceAttachmentId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkSubmissionRequirementSetMaxAggregateInputType = {
    id?: true
    activityId?: true
    languageKey?: true
    sourceAttachmentId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkSubmissionRequirementSetCountAggregateInputType = {
    id?: true
    activityId?: true
    languageKey?: true
    requirements?: true
    sourceAttachmentId?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkSubmissionRequirementSetAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkSubmissionRequirementSet to aggregate.
     */
    where?: PluginCodingHomeworkSubmissionRequirementSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionRequirementSets to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput | PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionRequirementSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionRequirementSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkSubmissionRequirementSets
    **/
    _count?: true | PluginCodingHomeworkSubmissionRequirementSetCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkSubmissionRequirementSetMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkSubmissionRequirementSetMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkSubmissionRequirementSetAggregateType<T extends PluginCodingHomeworkSubmissionRequirementSetAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkSubmissionRequirementSet]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkSubmissionRequirementSet[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkSubmissionRequirementSet[P]>
  }




  export type PluginCodingHomeworkSubmissionRequirementSetGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkSubmissionRequirementSetWhereInput
    orderBy?: PluginCodingHomeworkSubmissionRequirementSetOrderByWithAggregationInput | PluginCodingHomeworkSubmissionRequirementSetOrderByWithAggregationInput[]
    by: PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum[] | PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum
    having?: PluginCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkSubmissionRequirementSetCountAggregateInputType | true
    _min?: PluginCodingHomeworkSubmissionRequirementSetMinAggregateInputType
    _max?: PluginCodingHomeworkSubmissionRequirementSetMaxAggregateInputType
  }

  export type PluginCodingHomeworkSubmissionRequirementSetGroupByOutputType = {
    id: string
    activityId: string
    languageKey: string
    requirements: JsonValue
    sourceAttachmentId: string | null
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkSubmissionRequirementSetCountAggregateOutputType | null
    _min: PluginCodingHomeworkSubmissionRequirementSetMinAggregateOutputType | null
    _max: PluginCodingHomeworkSubmissionRequirementSetMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkSubmissionRequirementSetGroupByPayload<T extends PluginCodingHomeworkSubmissionRequirementSetGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkSubmissionRequirementSetGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkSubmissionRequirementSetGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkSubmissionRequirementSetGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkSubmissionRequirementSetGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    activityId?: boolean
    languageKey?: boolean
    requirements?: boolean
    sourceAttachmentId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginCodingHomeworkSubmissionRequirementSet"]>

  export type PluginCodingHomeworkSubmissionRequirementSetSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    activityId?: boolean
    languageKey?: boolean
    requirements?: boolean
    sourceAttachmentId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginCodingHomeworkSubmissionRequirementSet"]>

  export type PluginCodingHomeworkSubmissionRequirementSetSelectScalar = {
    id?: boolean
    activityId?: boolean
    languageKey?: boolean
    requirements?: boolean
    sourceAttachmentId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }


  export type $PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkSubmissionRequirementSet"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      activityId: string
      languageKey: string
      requirements: Prisma.JsonValue
      sourceAttachmentId: string | null
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkSubmissionRequirementSet"]>
    composites: {}
  }

  type PluginCodingHomeworkSubmissionRequirementSetGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkSubmissionRequirementSetDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload, S>

  type PluginCodingHomeworkSubmissionRequirementSetCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkSubmissionRequirementSetFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkSubmissionRequirementSetCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkSubmissionRequirementSetDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkSubmissionRequirementSet'], meta: { name: 'PluginCodingHomeworkSubmissionRequirementSet' } }
    /**
     * Find zero or one PluginCodingHomeworkSubmissionRequirementSet that matches the filter.
     * @param {PluginCodingHomeworkSubmissionRequirementSetFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkSubmissionRequirementSet
     * @example
     * // Get one PluginCodingHomeworkSubmissionRequirementSet
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkSubmissionRequirementSetFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkSubmissionRequirementSet that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkSubmissionRequirementSet
     * @example
     * // Get one PluginCodingHomeworkSubmissionRequirementSet
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkSubmissionRequirementSet that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionRequirementSetFindFirstArgs} args - Arguments to find a PluginCodingHomeworkSubmissionRequirementSet
     * @example
     * // Get one PluginCodingHomeworkSubmissionRequirementSet
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkSubmissionRequirementSetFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkSubmissionRequirementSet that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkSubmissionRequirementSet
     * @example
     * // Get one PluginCodingHomeworkSubmissionRequirementSet
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkSubmissionRequirementSets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionRequirementSetFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkSubmissionRequirementSets
     * const pluginCodingHomeworkSubmissionRequirementSets = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkSubmissionRequirementSets
     * const pluginCodingHomeworkSubmissionRequirementSets = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkSubmissionRequirementSetWithIdOnly = await prisma.pluginCodingHomeworkSubmissionRequirementSet.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkSubmissionRequirementSetFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkSubmissionRequirementSet.
     * @param {PluginCodingHomeworkSubmissionRequirementSetCreateArgs} args - Arguments to create a PluginCodingHomeworkSubmissionRequirementSet.
     * @example
     * // Create one PluginCodingHomeworkSubmissionRequirementSet
     * const PluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkSubmissionRequirementSet
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkSubmissionRequirementSetCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkSubmissionRequirementSets.
     * @param {PluginCodingHomeworkSubmissionRequirementSetCreateManyArgs} args - Arguments to create many PluginCodingHomeworkSubmissionRequirementSets.
     * @example
     * // Create many PluginCodingHomeworkSubmissionRequirementSets
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkSubmissionRequirementSetCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkSubmissionRequirementSets and returns the data saved in the database.
     * @param {PluginCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkSubmissionRequirementSets.
     * @example
     * // Create many PluginCodingHomeworkSubmissionRequirementSets
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkSubmissionRequirementSets and only return the `id`
     * const pluginCodingHomeworkSubmissionRequirementSetWithIdOnly = await prisma.pluginCodingHomeworkSubmissionRequirementSet.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkSubmissionRequirementSet.
     * @param {PluginCodingHomeworkSubmissionRequirementSetDeleteArgs} args - Arguments to delete one PluginCodingHomeworkSubmissionRequirementSet.
     * @example
     * // Delete one PluginCodingHomeworkSubmissionRequirementSet
     * const PluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkSubmissionRequirementSet
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkSubmissionRequirementSetDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkSubmissionRequirementSet.
     * @param {PluginCodingHomeworkSubmissionRequirementSetUpdateArgs} args - Arguments to update one PluginCodingHomeworkSubmissionRequirementSet.
     * @example
     * // Update one PluginCodingHomeworkSubmissionRequirementSet
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkSubmissionRequirementSetUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkSubmissionRequirementSets.
     * @param {PluginCodingHomeworkSubmissionRequirementSetDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkSubmissionRequirementSets to delete.
     * @example
     * // Delete a few PluginCodingHomeworkSubmissionRequirementSets
     * const { count } = await prisma.pluginCodingHomeworkSubmissionRequirementSet.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkSubmissionRequirementSetDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkSubmissionRequirementSets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionRequirementSetUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkSubmissionRequirementSets
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkSubmissionRequirementSetUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkSubmissionRequirementSet.
     * @param {PluginCodingHomeworkSubmissionRequirementSetUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkSubmissionRequirementSet.
     * @example
     * // Update or create a PluginCodingHomeworkSubmissionRequirementSet
     * const pluginCodingHomeworkSubmissionRequirementSet = await prisma.pluginCodingHomeworkSubmissionRequirementSet.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkSubmissionRequirementSet
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkSubmissionRequirementSet we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkSubmissionRequirementSetUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionRequirementSetUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkSubmissionRequirementSets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionRequirementSetCountArgs} args - Arguments to filter PluginCodingHomeworkSubmissionRequirementSets to count.
     * @example
     * // Count the number of PluginCodingHomeworkSubmissionRequirementSets
     * const count = await prisma.pluginCodingHomeworkSubmissionRequirementSet.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkSubmissionRequirementSets we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkSubmissionRequirementSetCountArgs>(
      args?: Subset<T, PluginCodingHomeworkSubmissionRequirementSetCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkSubmissionRequirementSetCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkSubmissionRequirementSet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionRequirementSetAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkSubmissionRequirementSetAggregateArgs>(args: Subset<T, PluginCodingHomeworkSubmissionRequirementSetAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkSubmissionRequirementSetAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkSubmissionRequirementSet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionRequirementSetGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkSubmissionRequirementSetGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkSubmissionRequirementSetGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkSubmissionRequirementSetGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkSubmissionRequirementSetGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkSubmissionRequirementSetGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkSubmissionRequirementSet model
   */
  readonly fields: PluginCodingHomeworkSubmissionRequirementSetFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkSubmissionRequirementSet.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkSubmissionRequirementSetClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkSubmissionRequirementSet model
   */ 
  interface PluginCodingHomeworkSubmissionRequirementSetFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkSubmissionRequirementSet", 'String'>
    readonly activityId: FieldRef<"PluginCodingHomeworkSubmissionRequirementSet", 'String'>
    readonly languageKey: FieldRef<"PluginCodingHomeworkSubmissionRequirementSet", 'String'>
    readonly requirements: FieldRef<"PluginCodingHomeworkSubmissionRequirementSet", 'Json'>
    readonly sourceAttachmentId: FieldRef<"PluginCodingHomeworkSubmissionRequirementSet", 'String'>
    readonly metadata: FieldRef<"PluginCodingHomeworkSubmissionRequirementSet", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkSubmissionRequirementSet", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkSubmissionRequirementSet", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkSubmissionRequirementSet findUnique
   */
  export type PluginCodingHomeworkSubmissionRequirementSetFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionRequirementSet to fetch.
     */
    where: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet findUniqueOrThrow
   */
  export type PluginCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionRequirementSet to fetch.
     */
    where: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet findFirst
   */
  export type PluginCodingHomeworkSubmissionRequirementSetFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionRequirementSet to fetch.
     */
    where?: PluginCodingHomeworkSubmissionRequirementSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionRequirementSets to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput | PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkSubmissionRequirementSets.
     */
    cursor?: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionRequirementSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionRequirementSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkSubmissionRequirementSets.
     */
    distinct?: PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum | PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet findFirstOrThrow
   */
  export type PluginCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionRequirementSet to fetch.
     */
    where?: PluginCodingHomeworkSubmissionRequirementSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionRequirementSets to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput | PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkSubmissionRequirementSets.
     */
    cursor?: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionRequirementSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionRequirementSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkSubmissionRequirementSets.
     */
    distinct?: PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum | PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet findMany
   */
  export type PluginCodingHomeworkSubmissionRequirementSetFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionRequirementSets to fetch.
     */
    where?: PluginCodingHomeworkSubmissionRequirementSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionRequirementSets to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput | PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkSubmissionRequirementSets.
     */
    cursor?: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionRequirementSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionRequirementSets.
     */
    skip?: number
    distinct?: PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum | PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet create
   */
  export type PluginCodingHomeworkSubmissionRequirementSetCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkSubmissionRequirementSet.
     */
    data: XOR<PluginCodingHomeworkSubmissionRequirementSetCreateInput, PluginCodingHomeworkSubmissionRequirementSetUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet createMany
   */
  export type PluginCodingHomeworkSubmissionRequirementSetCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkSubmissionRequirementSets.
     */
    data: PluginCodingHomeworkSubmissionRequirementSetCreateManyInput | PluginCodingHomeworkSubmissionRequirementSetCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet createManyAndReturn
   */
  export type PluginCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkSubmissionRequirementSets.
     */
    data: PluginCodingHomeworkSubmissionRequirementSetCreateManyInput | PluginCodingHomeworkSubmissionRequirementSetCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet update
   */
  export type PluginCodingHomeworkSubmissionRequirementSetUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkSubmissionRequirementSet.
     */
    data: XOR<PluginCodingHomeworkSubmissionRequirementSetUpdateInput, PluginCodingHomeworkSubmissionRequirementSetUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkSubmissionRequirementSet to update.
     */
    where: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet updateMany
   */
  export type PluginCodingHomeworkSubmissionRequirementSetUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkSubmissionRequirementSets.
     */
    data: XOR<PluginCodingHomeworkSubmissionRequirementSetUpdateManyMutationInput, PluginCodingHomeworkSubmissionRequirementSetUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkSubmissionRequirementSets to update
     */
    where?: PluginCodingHomeworkSubmissionRequirementSetWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet upsert
   */
  export type PluginCodingHomeworkSubmissionRequirementSetUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkSubmissionRequirementSet to update in case it exists.
     */
    where: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkSubmissionRequirementSet found by the `where` argument doesn't exist, create a new PluginCodingHomeworkSubmissionRequirementSet with this data.
     */
    create: XOR<PluginCodingHomeworkSubmissionRequirementSetCreateInput, PluginCodingHomeworkSubmissionRequirementSetUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkSubmissionRequirementSet was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkSubmissionRequirementSetUpdateInput, PluginCodingHomeworkSubmissionRequirementSetUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet delete
   */
  export type PluginCodingHomeworkSubmissionRequirementSetDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkSubmissionRequirementSet to delete.
     */
    where: PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet deleteMany
   */
  export type PluginCodingHomeworkSubmissionRequirementSetDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkSubmissionRequirementSets to delete
     */
    where?: PluginCodingHomeworkSubmissionRequirementSetWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionRequirementSet without action
   */
  export type PluginCodingHomeworkSubmissionRequirementSetDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
  }


  /**
   * Model PluginBankCodingHomeworkSubmissionRequirementSet
   */

  export type AggregatePluginBankCodingHomeworkSubmissionRequirementSet = {
    _count: PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateOutputType | null
    _min: PluginBankCodingHomeworkSubmissionRequirementSetMinAggregateOutputType | null
    _max: PluginBankCodingHomeworkSubmissionRequirementSetMaxAggregateOutputType | null
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetMinAggregateOutputType = {
    id: string | null
    bankActivityId: string | null
    languageKey: string | null
    sourceAttachmentId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetMaxAggregateOutputType = {
    id: string | null
    bankActivityId: string | null
    languageKey: string | null
    sourceAttachmentId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateOutputType = {
    id: number
    bankActivityId: number
    languageKey: number
    requirements: number
    sourceAttachmentId: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginBankCodingHomeworkSubmissionRequirementSetMinAggregateInputType = {
    id?: true
    bankActivityId?: true
    languageKey?: true
    sourceAttachmentId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetMaxAggregateInputType = {
    id?: true
    bankActivityId?: true
    languageKey?: true
    sourceAttachmentId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateInputType = {
    id?: true
    bankActivityId?: true
    languageKey?: true
    requirements?: true
    sourceAttachmentId?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginBankCodingHomeworkSubmissionRequirementSet to aggregate.
     */
    where?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginBankCodingHomeworkSubmissionRequirementSets to fetch.
     */
    orderBy?: PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput | PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginBankCodingHomeworkSubmissionRequirementSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginBankCodingHomeworkSubmissionRequirementSets
    **/
    _count?: true | PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginBankCodingHomeworkSubmissionRequirementSetMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginBankCodingHomeworkSubmissionRequirementSetMaxAggregateInputType
  }

  export type GetPluginBankCodingHomeworkSubmissionRequirementSetAggregateType<T extends PluginBankCodingHomeworkSubmissionRequirementSetAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginBankCodingHomeworkSubmissionRequirementSet]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginBankCodingHomeworkSubmissionRequirementSet[P]>
      : GetScalarType<T[P], AggregatePluginBankCodingHomeworkSubmissionRequirementSet[P]>
  }




  export type PluginBankCodingHomeworkSubmissionRequirementSetGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput
    orderBy?: PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithAggregationInput | PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithAggregationInput[]
    by: PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum[] | PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum
    having?: PluginBankCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateInputType | true
    _min?: PluginBankCodingHomeworkSubmissionRequirementSetMinAggregateInputType
    _max?: PluginBankCodingHomeworkSubmissionRequirementSetMaxAggregateInputType
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetGroupByOutputType = {
    id: string
    bankActivityId: string
    languageKey: string
    requirements: JsonValue
    sourceAttachmentId: string | null
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateOutputType | null
    _min: PluginBankCodingHomeworkSubmissionRequirementSetMinAggregateOutputType | null
    _max: PluginBankCodingHomeworkSubmissionRequirementSetMaxAggregateOutputType | null
  }

  type GetPluginBankCodingHomeworkSubmissionRequirementSetGroupByPayload<T extends PluginBankCodingHomeworkSubmissionRequirementSetGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginBankCodingHomeworkSubmissionRequirementSetGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginBankCodingHomeworkSubmissionRequirementSetGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginBankCodingHomeworkSubmissionRequirementSetGroupByOutputType[P]>
            : GetScalarType<T[P], PluginBankCodingHomeworkSubmissionRequirementSetGroupByOutputType[P]>
        }
      >
    >


  export type PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bankActivityId?: boolean
    languageKey?: boolean
    requirements?: boolean
    sourceAttachmentId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginBankCodingHomeworkSubmissionRequirementSet"]>

  export type PluginBankCodingHomeworkSubmissionRequirementSetSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bankActivityId?: boolean
    languageKey?: boolean
    requirements?: boolean
    sourceAttachmentId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginBankCodingHomeworkSubmissionRequirementSet"]>

  export type PluginBankCodingHomeworkSubmissionRequirementSetSelectScalar = {
    id?: boolean
    bankActivityId?: boolean
    languageKey?: boolean
    requirements?: boolean
    sourceAttachmentId?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }


  export type $PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginBankCodingHomeworkSubmissionRequirementSet"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bankActivityId: string
      languageKey: string
      requirements: Prisma.JsonValue
      sourceAttachmentId: string | null
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginBankCodingHomeworkSubmissionRequirementSet"]>
    composites: {}
  }

  type PluginBankCodingHomeworkSubmissionRequirementSetGetPayload<S extends boolean | null | undefined | PluginBankCodingHomeworkSubmissionRequirementSetDefaultArgs> = $Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload, S>

  type PluginBankCodingHomeworkSubmissionRequirementSetCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginBankCodingHomeworkSubmissionRequirementSetFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateInputType | true
    }

  export interface PluginBankCodingHomeworkSubmissionRequirementSetDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginBankCodingHomeworkSubmissionRequirementSet'], meta: { name: 'PluginBankCodingHomeworkSubmissionRequirementSet' } }
    /**
     * Find zero or one PluginBankCodingHomeworkSubmissionRequirementSet that matches the filter.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueArgs} args - Arguments to find a PluginBankCodingHomeworkSubmissionRequirementSet
     * @example
     * // Get one PluginBankCodingHomeworkSubmissionRequirementSet
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueArgs>(args: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginBankCodingHomeworkSubmissionRequirementSet that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs} args - Arguments to find a PluginBankCodingHomeworkSubmissionRequirementSet
     * @example
     * // Get one PluginBankCodingHomeworkSubmissionRequirementSet
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginBankCodingHomeworkSubmissionRequirementSet that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetFindFirstArgs} args - Arguments to find a PluginBankCodingHomeworkSubmissionRequirementSet
     * @example
     * // Get one PluginBankCodingHomeworkSubmissionRequirementSet
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginBankCodingHomeworkSubmissionRequirementSetFindFirstArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetFindFirstArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginBankCodingHomeworkSubmissionRequirementSet that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs} args - Arguments to find a PluginBankCodingHomeworkSubmissionRequirementSet
     * @example
     * // Get one PluginBankCodingHomeworkSubmissionRequirementSet
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginBankCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginBankCodingHomeworkSubmissionRequirementSets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginBankCodingHomeworkSubmissionRequirementSets
     * const pluginBankCodingHomeworkSubmissionRequirementSets = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findMany()
     * 
     * // Get first 10 PluginBankCodingHomeworkSubmissionRequirementSets
     * const pluginBankCodingHomeworkSubmissionRequirementSets = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginBankCodingHomeworkSubmissionRequirementSetWithIdOnly = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginBankCodingHomeworkSubmissionRequirementSetFindManyArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginBankCodingHomeworkSubmissionRequirementSet.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetCreateArgs} args - Arguments to create a PluginBankCodingHomeworkSubmissionRequirementSet.
     * @example
     * // Create one PluginBankCodingHomeworkSubmissionRequirementSet
     * const PluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.create({
     *   data: {
     *     // ... data to create a PluginBankCodingHomeworkSubmissionRequirementSet
     *   }
     * })
     * 
     */
    create<T extends PluginBankCodingHomeworkSubmissionRequirementSetCreateArgs>(args: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetCreateArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginBankCodingHomeworkSubmissionRequirementSets.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetCreateManyArgs} args - Arguments to create many PluginBankCodingHomeworkSubmissionRequirementSets.
     * @example
     * // Create many PluginBankCodingHomeworkSubmissionRequirementSets
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginBankCodingHomeworkSubmissionRequirementSetCreateManyArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginBankCodingHomeworkSubmissionRequirementSets and returns the data saved in the database.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs} args - Arguments to create many PluginBankCodingHomeworkSubmissionRequirementSets.
     * @example
     * // Create many PluginBankCodingHomeworkSubmissionRequirementSets
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginBankCodingHomeworkSubmissionRequirementSets and only return the `id`
     * const pluginBankCodingHomeworkSubmissionRequirementSetWithIdOnly = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginBankCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginBankCodingHomeworkSubmissionRequirementSet.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetDeleteArgs} args - Arguments to delete one PluginBankCodingHomeworkSubmissionRequirementSet.
     * @example
     * // Delete one PluginBankCodingHomeworkSubmissionRequirementSet
     * const PluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.delete({
     *   where: {
     *     // ... filter to delete one PluginBankCodingHomeworkSubmissionRequirementSet
     *   }
     * })
     * 
     */
    delete<T extends PluginBankCodingHomeworkSubmissionRequirementSetDeleteArgs>(args: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetDeleteArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginBankCodingHomeworkSubmissionRequirementSet.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetUpdateArgs} args - Arguments to update one PluginBankCodingHomeworkSubmissionRequirementSet.
     * @example
     * // Update one PluginBankCodingHomeworkSubmissionRequirementSet
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginBankCodingHomeworkSubmissionRequirementSetUpdateArgs>(args: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetUpdateArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginBankCodingHomeworkSubmissionRequirementSets.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetDeleteManyArgs} args - Arguments to filter PluginBankCodingHomeworkSubmissionRequirementSets to delete.
     * @example
     * // Delete a few PluginBankCodingHomeworkSubmissionRequirementSets
     * const { count } = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginBankCodingHomeworkSubmissionRequirementSetDeleteManyArgs>(args?: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginBankCodingHomeworkSubmissionRequirementSets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginBankCodingHomeworkSubmissionRequirementSets
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginBankCodingHomeworkSubmissionRequirementSetUpdateManyArgs>(args: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginBankCodingHomeworkSubmissionRequirementSet.
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetUpsertArgs} args - Arguments to update or create a PluginBankCodingHomeworkSubmissionRequirementSet.
     * @example
     * // Update or create a PluginBankCodingHomeworkSubmissionRequirementSet
     * const pluginBankCodingHomeworkSubmissionRequirementSet = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.upsert({
     *   create: {
     *     // ... data to create a PluginBankCodingHomeworkSubmissionRequirementSet
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginBankCodingHomeworkSubmissionRequirementSet we want to update
     *   }
     * })
     */
    upsert<T extends PluginBankCodingHomeworkSubmissionRequirementSetUpsertArgs>(args: SelectSubset<T, PluginBankCodingHomeworkSubmissionRequirementSetUpsertArgs<ExtArgs>>): Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<$Result.GetResult<Prisma.$PluginBankCodingHomeworkSubmissionRequirementSetPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginBankCodingHomeworkSubmissionRequirementSets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetCountArgs} args - Arguments to filter PluginBankCodingHomeworkSubmissionRequirementSets to count.
     * @example
     * // Count the number of PluginBankCodingHomeworkSubmissionRequirementSets
     * const count = await prisma.pluginBankCodingHomeworkSubmissionRequirementSet.count({
     *   where: {
     *     // ... the filter for the PluginBankCodingHomeworkSubmissionRequirementSets we want to count
     *   }
     * })
    **/
    count<T extends PluginBankCodingHomeworkSubmissionRequirementSetCountArgs>(
      args?: Subset<T, PluginBankCodingHomeworkSubmissionRequirementSetCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginBankCodingHomeworkSubmissionRequirementSetCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginBankCodingHomeworkSubmissionRequirementSet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginBankCodingHomeworkSubmissionRequirementSetAggregateArgs>(args: Subset<T, PluginBankCodingHomeworkSubmissionRequirementSetAggregateArgs>): Prisma.PrismaPromise<GetPluginBankCodingHomeworkSubmissionRequirementSetAggregateType<T>>

    /**
     * Group by PluginBankCodingHomeworkSubmissionRequirementSet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginBankCodingHomeworkSubmissionRequirementSetGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginBankCodingHomeworkSubmissionRequirementSetGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginBankCodingHomeworkSubmissionRequirementSetGroupByArgs['orderBy'] }
        : { orderBy?: PluginBankCodingHomeworkSubmissionRequirementSetGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginBankCodingHomeworkSubmissionRequirementSetGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginBankCodingHomeworkSubmissionRequirementSetGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginBankCodingHomeworkSubmissionRequirementSet model
   */
  readonly fields: PluginBankCodingHomeworkSubmissionRequirementSetFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginBankCodingHomeworkSubmissionRequirementSet.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginBankCodingHomeworkSubmissionRequirementSetClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginBankCodingHomeworkSubmissionRequirementSet model
   */ 
  interface PluginBankCodingHomeworkSubmissionRequirementSetFieldRefs {
    readonly id: FieldRef<"PluginBankCodingHomeworkSubmissionRequirementSet", 'String'>
    readonly bankActivityId: FieldRef<"PluginBankCodingHomeworkSubmissionRequirementSet", 'String'>
    readonly languageKey: FieldRef<"PluginBankCodingHomeworkSubmissionRequirementSet", 'String'>
    readonly requirements: FieldRef<"PluginBankCodingHomeworkSubmissionRequirementSet", 'Json'>
    readonly sourceAttachmentId: FieldRef<"PluginBankCodingHomeworkSubmissionRequirementSet", 'String'>
    readonly metadata: FieldRef<"PluginBankCodingHomeworkSubmissionRequirementSet", 'Json'>
    readonly createdAt: FieldRef<"PluginBankCodingHomeworkSubmissionRequirementSet", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginBankCodingHomeworkSubmissionRequirementSet", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet findUnique
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkSubmissionRequirementSet to fetch.
     */
    where: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet findUniqueOrThrow
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkSubmissionRequirementSet to fetch.
     */
    where: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet findFirst
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkSubmissionRequirementSet to fetch.
     */
    where?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginBankCodingHomeworkSubmissionRequirementSets to fetch.
     */
    orderBy?: PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput | PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    cursor?: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginBankCodingHomeworkSubmissionRequirementSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    distinct?: PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum | PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum[]
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet findFirstOrThrow
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkSubmissionRequirementSet to fetch.
     */
    where?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginBankCodingHomeworkSubmissionRequirementSets to fetch.
     */
    orderBy?: PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput | PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    cursor?: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginBankCodingHomeworkSubmissionRequirementSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    distinct?: PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum | PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum[]
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet findMany
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter, which PluginBankCodingHomeworkSubmissionRequirementSets to fetch.
     */
    where?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginBankCodingHomeworkSubmissionRequirementSets to fetch.
     */
    orderBy?: PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput | PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    cursor?: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginBankCodingHomeworkSubmissionRequirementSets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    skip?: number
    distinct?: PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum | PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum[]
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet create
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * The data needed to create a PluginBankCodingHomeworkSubmissionRequirementSet.
     */
    data: XOR<PluginBankCodingHomeworkSubmissionRequirementSetCreateInput, PluginBankCodingHomeworkSubmissionRequirementSetUncheckedCreateInput>
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet createMany
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    data: PluginBankCodingHomeworkSubmissionRequirementSetCreateManyInput | PluginBankCodingHomeworkSubmissionRequirementSetCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet createManyAndReturn
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    data: PluginBankCodingHomeworkSubmissionRequirementSetCreateManyInput | PluginBankCodingHomeworkSubmissionRequirementSetCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet update
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * The data needed to update a PluginBankCodingHomeworkSubmissionRequirementSet.
     */
    data: XOR<PluginBankCodingHomeworkSubmissionRequirementSetUpdateInput, PluginBankCodingHomeworkSubmissionRequirementSetUncheckedUpdateInput>
    /**
     * Choose, which PluginBankCodingHomeworkSubmissionRequirementSet to update.
     */
    where: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet updateMany
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginBankCodingHomeworkSubmissionRequirementSets.
     */
    data: XOR<PluginBankCodingHomeworkSubmissionRequirementSetUpdateManyMutationInput, PluginBankCodingHomeworkSubmissionRequirementSetUncheckedUpdateManyInput>
    /**
     * Filter which PluginBankCodingHomeworkSubmissionRequirementSets to update
     */
    where?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet upsert
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * The filter to search for the PluginBankCodingHomeworkSubmissionRequirementSet to update in case it exists.
     */
    where: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
    /**
     * In case the PluginBankCodingHomeworkSubmissionRequirementSet found by the `where` argument doesn't exist, create a new PluginBankCodingHomeworkSubmissionRequirementSet with this data.
     */
    create: XOR<PluginBankCodingHomeworkSubmissionRequirementSetCreateInput, PluginBankCodingHomeworkSubmissionRequirementSetUncheckedCreateInput>
    /**
     * In case the PluginBankCodingHomeworkSubmissionRequirementSet was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginBankCodingHomeworkSubmissionRequirementSetUpdateInput, PluginBankCodingHomeworkSubmissionRequirementSetUncheckedUpdateInput>
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet delete
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
    /**
     * Filter which PluginBankCodingHomeworkSubmissionRequirementSet to delete.
     */
    where: PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet deleteMany
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginBankCodingHomeworkSubmissionRequirementSets to delete
     */
    where?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput
  }

  /**
   * PluginBankCodingHomeworkSubmissionRequirementSet without action
   */
  export type PluginBankCodingHomeworkSubmissionRequirementSetDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginBankCodingHomeworkSubmissionRequirementSet
     */
    select?: PluginBankCodingHomeworkSubmissionRequirementSetSelect<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkAttachment
   */

  export type AggregatePluginCodingHomeworkAttachment = {
    _count: PluginCodingHomeworkAttachmentCountAggregateOutputType | null
    _avg: PluginCodingHomeworkAttachmentAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkAttachmentSumAggregateOutputType | null
    _min: PluginCodingHomeworkAttachmentMinAggregateOutputType | null
    _max: PluginCodingHomeworkAttachmentMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkAttachmentAvgAggregateOutputType = {
    sizeBytes: number | null
  }

  export type PluginCodingHomeworkAttachmentSumAggregateOutputType = {
    sizeBytes: bigint | null
  }

  export type PluginCodingHomeworkAttachmentMinAggregateOutputType = {
    id: string | null
    ownerKind: $Enums.PluginCodingHomeworkAttachmentOwnerKind | null
    ownerId: string | null
    kind: $Enums.PluginCodingHomeworkAttachmentKind | null
    originalName: string | null
    storedName: string | null
    mimeType: string | null
    sizeBytes: bigint | null
    sha256: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkAttachmentMaxAggregateOutputType = {
    id: string | null
    ownerKind: $Enums.PluginCodingHomeworkAttachmentOwnerKind | null
    ownerId: string | null
    kind: $Enums.PluginCodingHomeworkAttachmentKind | null
    originalName: string | null
    storedName: string | null
    mimeType: string | null
    sizeBytes: bigint | null
    sha256: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkAttachmentCountAggregateOutputType = {
    id: number
    ownerKind: number
    ownerId: number
    kind: number
    originalName: number
    storedName: number
    mimeType: number
    sizeBytes: number
    sha256: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkAttachmentAvgAggregateInputType = {
    sizeBytes?: true
  }

  export type PluginCodingHomeworkAttachmentSumAggregateInputType = {
    sizeBytes?: true
  }

  export type PluginCodingHomeworkAttachmentMinAggregateInputType = {
    id?: true
    ownerKind?: true
    ownerId?: true
    kind?: true
    originalName?: true
    storedName?: true
    mimeType?: true
    sizeBytes?: true
    sha256?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkAttachmentMaxAggregateInputType = {
    id?: true
    ownerKind?: true
    ownerId?: true
    kind?: true
    originalName?: true
    storedName?: true
    mimeType?: true
    sizeBytes?: true
    sha256?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkAttachmentCountAggregateInputType = {
    id?: true
    ownerKind?: true
    ownerId?: true
    kind?: true
    originalName?: true
    storedName?: true
    mimeType?: true
    sizeBytes?: true
    sha256?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkAttachmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkAttachment to aggregate.
     */
    where?: PluginCodingHomeworkAttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkAttachments to fetch.
     */
    orderBy?: PluginCodingHomeworkAttachmentOrderByWithRelationInput | PluginCodingHomeworkAttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkAttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkAttachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkAttachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkAttachments
    **/
    _count?: true | PluginCodingHomeworkAttachmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PluginCodingHomeworkAttachmentAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PluginCodingHomeworkAttachmentSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkAttachmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkAttachmentMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkAttachmentAggregateType<T extends PluginCodingHomeworkAttachmentAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkAttachment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkAttachment[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkAttachment[P]>
  }




  export type PluginCodingHomeworkAttachmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkAttachmentWhereInput
    orderBy?: PluginCodingHomeworkAttachmentOrderByWithAggregationInput | PluginCodingHomeworkAttachmentOrderByWithAggregationInput[]
    by: PluginCodingHomeworkAttachmentScalarFieldEnum[] | PluginCodingHomeworkAttachmentScalarFieldEnum
    having?: PluginCodingHomeworkAttachmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkAttachmentCountAggregateInputType | true
    _avg?: PluginCodingHomeworkAttachmentAvgAggregateInputType
    _sum?: PluginCodingHomeworkAttachmentSumAggregateInputType
    _min?: PluginCodingHomeworkAttachmentMinAggregateInputType
    _max?: PluginCodingHomeworkAttachmentMaxAggregateInputType
  }

  export type PluginCodingHomeworkAttachmentGroupByOutputType = {
    id: string
    ownerKind: $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId: string
    kind: $Enums.PluginCodingHomeworkAttachmentKind
    originalName: string
    storedName: string
    mimeType: string | null
    sizeBytes: bigint
    sha256: string
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkAttachmentCountAggregateOutputType | null
    _avg: PluginCodingHomeworkAttachmentAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkAttachmentSumAggregateOutputType | null
    _min: PluginCodingHomeworkAttachmentMinAggregateOutputType | null
    _max: PluginCodingHomeworkAttachmentMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkAttachmentGroupByPayload<T extends PluginCodingHomeworkAttachmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkAttachmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkAttachmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkAttachmentGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkAttachmentGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkAttachmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ownerKind?: boolean
    ownerId?: boolean
    kind?: boolean
    originalName?: boolean
    storedName?: boolean
    mimeType?: boolean
    sizeBytes?: boolean
    sha256?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginCodingHomeworkAttachment"]>

  export type PluginCodingHomeworkAttachmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ownerKind?: boolean
    ownerId?: boolean
    kind?: boolean
    originalName?: boolean
    storedName?: boolean
    mimeType?: boolean
    sizeBytes?: boolean
    sha256?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginCodingHomeworkAttachment"]>

  export type PluginCodingHomeworkAttachmentSelectScalar = {
    id?: boolean
    ownerKind?: boolean
    ownerId?: boolean
    kind?: boolean
    originalName?: boolean
    storedName?: boolean
    mimeType?: boolean
    sizeBytes?: boolean
    sha256?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }


  export type $PluginCodingHomeworkAttachmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkAttachment"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      ownerKind: $Enums.PluginCodingHomeworkAttachmentOwnerKind
      ownerId: string
      kind: $Enums.PluginCodingHomeworkAttachmentKind
      originalName: string
      storedName: string
      mimeType: string | null
      sizeBytes: bigint
      sha256: string
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkAttachment"]>
    composites: {}
  }

  type PluginCodingHomeworkAttachmentGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkAttachmentDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload, S>

  type PluginCodingHomeworkAttachmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkAttachmentFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkAttachmentCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkAttachmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkAttachment'], meta: { name: 'PluginCodingHomeworkAttachment' } }
    /**
     * Find zero or one PluginCodingHomeworkAttachment that matches the filter.
     * @param {PluginCodingHomeworkAttachmentFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkAttachment
     * @example
     * // Get one PluginCodingHomeworkAttachment
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkAttachmentFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkAttachmentFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAttachmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkAttachment that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkAttachmentFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkAttachment
     * @example
     * // Get one PluginCodingHomeworkAttachment
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkAttachmentFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkAttachmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAttachmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkAttachment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAttachmentFindFirstArgs} args - Arguments to find a PluginCodingHomeworkAttachment
     * @example
     * // Get one PluginCodingHomeworkAttachment
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkAttachmentFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkAttachmentFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAttachmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkAttachment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAttachmentFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkAttachment
     * @example
     * // Get one PluginCodingHomeworkAttachment
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkAttachmentFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkAttachmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAttachmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkAttachments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAttachmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkAttachments
     * const pluginCodingHomeworkAttachments = await prisma.pluginCodingHomeworkAttachment.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkAttachments
     * const pluginCodingHomeworkAttachments = await prisma.pluginCodingHomeworkAttachment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkAttachmentWithIdOnly = await prisma.pluginCodingHomeworkAttachment.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkAttachmentFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkAttachmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkAttachment.
     * @param {PluginCodingHomeworkAttachmentCreateArgs} args - Arguments to create a PluginCodingHomeworkAttachment.
     * @example
     * // Create one PluginCodingHomeworkAttachment
     * const PluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkAttachment
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkAttachmentCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkAttachmentCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAttachmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkAttachments.
     * @param {PluginCodingHomeworkAttachmentCreateManyArgs} args - Arguments to create many PluginCodingHomeworkAttachments.
     * @example
     * // Create many PluginCodingHomeworkAttachments
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkAttachmentCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkAttachmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkAttachments and returns the data saved in the database.
     * @param {PluginCodingHomeworkAttachmentCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkAttachments.
     * @example
     * // Create many PluginCodingHomeworkAttachments
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkAttachments and only return the `id`
     * const pluginCodingHomeworkAttachmentWithIdOnly = await prisma.pluginCodingHomeworkAttachment.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkAttachmentCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkAttachmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkAttachment.
     * @param {PluginCodingHomeworkAttachmentDeleteArgs} args - Arguments to delete one PluginCodingHomeworkAttachment.
     * @example
     * // Delete one PluginCodingHomeworkAttachment
     * const PluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkAttachment
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkAttachmentDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkAttachmentDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAttachmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkAttachment.
     * @param {PluginCodingHomeworkAttachmentUpdateArgs} args - Arguments to update one PluginCodingHomeworkAttachment.
     * @example
     * // Update one PluginCodingHomeworkAttachment
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkAttachmentUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkAttachmentUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAttachmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkAttachments.
     * @param {PluginCodingHomeworkAttachmentDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkAttachments to delete.
     * @example
     * // Delete a few PluginCodingHomeworkAttachments
     * const { count } = await prisma.pluginCodingHomeworkAttachment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkAttachmentDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkAttachmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkAttachments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAttachmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkAttachments
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkAttachmentUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkAttachmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkAttachment.
     * @param {PluginCodingHomeworkAttachmentUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkAttachment.
     * @example
     * // Update or create a PluginCodingHomeworkAttachment
     * const pluginCodingHomeworkAttachment = await prisma.pluginCodingHomeworkAttachment.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkAttachment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkAttachment we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkAttachmentUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkAttachmentUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkAttachmentClient<$Result.GetResult<Prisma.$PluginCodingHomeworkAttachmentPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkAttachments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAttachmentCountArgs} args - Arguments to filter PluginCodingHomeworkAttachments to count.
     * @example
     * // Count the number of PluginCodingHomeworkAttachments
     * const count = await prisma.pluginCodingHomeworkAttachment.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkAttachments we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkAttachmentCountArgs>(
      args?: Subset<T, PluginCodingHomeworkAttachmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkAttachmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkAttachment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAttachmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkAttachmentAggregateArgs>(args: Subset<T, PluginCodingHomeworkAttachmentAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkAttachmentAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkAttachment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkAttachmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkAttachmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkAttachmentGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkAttachmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkAttachmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkAttachmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkAttachment model
   */
  readonly fields: PluginCodingHomeworkAttachmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkAttachment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkAttachmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkAttachment model
   */ 
  interface PluginCodingHomeworkAttachmentFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkAttachment", 'String'>
    readonly ownerKind: FieldRef<"PluginCodingHomeworkAttachment", 'PluginCodingHomeworkAttachmentOwnerKind'>
    readonly ownerId: FieldRef<"PluginCodingHomeworkAttachment", 'String'>
    readonly kind: FieldRef<"PluginCodingHomeworkAttachment", 'PluginCodingHomeworkAttachmentKind'>
    readonly originalName: FieldRef<"PluginCodingHomeworkAttachment", 'String'>
    readonly storedName: FieldRef<"PluginCodingHomeworkAttachment", 'String'>
    readonly mimeType: FieldRef<"PluginCodingHomeworkAttachment", 'String'>
    readonly sizeBytes: FieldRef<"PluginCodingHomeworkAttachment", 'BigInt'>
    readonly sha256: FieldRef<"PluginCodingHomeworkAttachment", 'String'>
    readonly metadata: FieldRef<"PluginCodingHomeworkAttachment", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkAttachment", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkAttachment", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkAttachment findUnique
   */
  export type PluginCodingHomeworkAttachmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAttachment to fetch.
     */
    where: PluginCodingHomeworkAttachmentWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkAttachment findUniqueOrThrow
   */
  export type PluginCodingHomeworkAttachmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAttachment to fetch.
     */
    where: PluginCodingHomeworkAttachmentWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkAttachment findFirst
   */
  export type PluginCodingHomeworkAttachmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAttachment to fetch.
     */
    where?: PluginCodingHomeworkAttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkAttachments to fetch.
     */
    orderBy?: PluginCodingHomeworkAttachmentOrderByWithRelationInput | PluginCodingHomeworkAttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkAttachments.
     */
    cursor?: PluginCodingHomeworkAttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkAttachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkAttachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkAttachments.
     */
    distinct?: PluginCodingHomeworkAttachmentScalarFieldEnum | PluginCodingHomeworkAttachmentScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkAttachment findFirstOrThrow
   */
  export type PluginCodingHomeworkAttachmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAttachment to fetch.
     */
    where?: PluginCodingHomeworkAttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkAttachments to fetch.
     */
    orderBy?: PluginCodingHomeworkAttachmentOrderByWithRelationInput | PluginCodingHomeworkAttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkAttachments.
     */
    cursor?: PluginCodingHomeworkAttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkAttachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkAttachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkAttachments.
     */
    distinct?: PluginCodingHomeworkAttachmentScalarFieldEnum | PluginCodingHomeworkAttachmentScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkAttachment findMany
   */
  export type PluginCodingHomeworkAttachmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkAttachments to fetch.
     */
    where?: PluginCodingHomeworkAttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkAttachments to fetch.
     */
    orderBy?: PluginCodingHomeworkAttachmentOrderByWithRelationInput | PluginCodingHomeworkAttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkAttachments.
     */
    cursor?: PluginCodingHomeworkAttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkAttachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkAttachments.
     */
    skip?: number
    distinct?: PluginCodingHomeworkAttachmentScalarFieldEnum | PluginCodingHomeworkAttachmentScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkAttachment create
   */
  export type PluginCodingHomeworkAttachmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkAttachment.
     */
    data: XOR<PluginCodingHomeworkAttachmentCreateInput, PluginCodingHomeworkAttachmentUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkAttachment createMany
   */
  export type PluginCodingHomeworkAttachmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkAttachments.
     */
    data: PluginCodingHomeworkAttachmentCreateManyInput | PluginCodingHomeworkAttachmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkAttachment createManyAndReturn
   */
  export type PluginCodingHomeworkAttachmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkAttachments.
     */
    data: PluginCodingHomeworkAttachmentCreateManyInput | PluginCodingHomeworkAttachmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkAttachment update
   */
  export type PluginCodingHomeworkAttachmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkAttachment.
     */
    data: XOR<PluginCodingHomeworkAttachmentUpdateInput, PluginCodingHomeworkAttachmentUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkAttachment to update.
     */
    where: PluginCodingHomeworkAttachmentWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkAttachment updateMany
   */
  export type PluginCodingHomeworkAttachmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkAttachments.
     */
    data: XOR<PluginCodingHomeworkAttachmentUpdateManyMutationInput, PluginCodingHomeworkAttachmentUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkAttachments to update
     */
    where?: PluginCodingHomeworkAttachmentWhereInput
  }

  /**
   * PluginCodingHomeworkAttachment upsert
   */
  export type PluginCodingHomeworkAttachmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkAttachment to update in case it exists.
     */
    where: PluginCodingHomeworkAttachmentWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkAttachment found by the `where` argument doesn't exist, create a new PluginCodingHomeworkAttachment with this data.
     */
    create: XOR<PluginCodingHomeworkAttachmentCreateInput, PluginCodingHomeworkAttachmentUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkAttachment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkAttachmentUpdateInput, PluginCodingHomeworkAttachmentUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkAttachment delete
   */
  export type PluginCodingHomeworkAttachmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkAttachment to delete.
     */
    where: PluginCodingHomeworkAttachmentWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkAttachment deleteMany
   */
  export type PluginCodingHomeworkAttachmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkAttachments to delete
     */
    where?: PluginCodingHomeworkAttachmentWhereInput
  }

  /**
   * PluginCodingHomeworkAttachment without action
   */
  export type PluginCodingHomeworkAttachmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkAttachment
     */
    select?: PluginCodingHomeworkAttachmentSelect<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkDocumentationSnapshot
   */

  export type AggregatePluginCodingHomeworkDocumentationSnapshot = {
    _count: PluginCodingHomeworkDocumentationSnapshotCountAggregateOutputType | null
    _min: PluginCodingHomeworkDocumentationSnapshotMinAggregateOutputType | null
    _max: PluginCodingHomeworkDocumentationSnapshotMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkDocumentationSnapshotMinAggregateOutputType = {
    id: string | null
    activityId: string | null
    courseId: string | null
    groupId: string | null
    contentTreeAnchorItemId: string | null
    contentTreeFingerprint: string | null
    status: $Enums.PluginCodingHomeworkSnapshotStatus | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkDocumentationSnapshotMaxAggregateOutputType = {
    id: string | null
    activityId: string | null
    courseId: string | null
    groupId: string | null
    contentTreeAnchorItemId: string | null
    contentTreeFingerprint: string | null
    status: $Enums.PluginCodingHomeworkSnapshotStatus | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkDocumentationSnapshotCountAggregateOutputType = {
    id: number
    activityId: number
    courseId: number
    groupId: number
    contentTreeAnchorItemId: number
    contentTreeFingerprint: number
    status: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkDocumentationSnapshotMinAggregateInputType = {
    id?: true
    activityId?: true
    courseId?: true
    groupId?: true
    contentTreeAnchorItemId?: true
    contentTreeFingerprint?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkDocumentationSnapshotMaxAggregateInputType = {
    id?: true
    activityId?: true
    courseId?: true
    groupId?: true
    contentTreeAnchorItemId?: true
    contentTreeFingerprint?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkDocumentationSnapshotCountAggregateInputType = {
    id?: true
    activityId?: true
    courseId?: true
    groupId?: true
    contentTreeAnchorItemId?: true
    contentTreeFingerprint?: true
    status?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkDocumentationSnapshotAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkDocumentationSnapshot to aggregate.
     */
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkDocumentationSnapshots to fetch.
     */
    orderBy?: PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput | PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkDocumentationSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkDocumentationSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkDocumentationSnapshots
    **/
    _count?: true | PluginCodingHomeworkDocumentationSnapshotCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkDocumentationSnapshotMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkDocumentationSnapshotMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkDocumentationSnapshotAggregateType<T extends PluginCodingHomeworkDocumentationSnapshotAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkDocumentationSnapshot]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkDocumentationSnapshot[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkDocumentationSnapshot[P]>
  }




  export type PluginCodingHomeworkDocumentationSnapshotGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
    orderBy?: PluginCodingHomeworkDocumentationSnapshotOrderByWithAggregationInput | PluginCodingHomeworkDocumentationSnapshotOrderByWithAggregationInput[]
    by: PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum[] | PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum
    having?: PluginCodingHomeworkDocumentationSnapshotScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkDocumentationSnapshotCountAggregateInputType | true
    _min?: PluginCodingHomeworkDocumentationSnapshotMinAggregateInputType
    _max?: PluginCodingHomeworkDocumentationSnapshotMaxAggregateInputType
  }

  export type PluginCodingHomeworkDocumentationSnapshotGroupByOutputType = {
    id: string
    activityId: string
    courseId: string
    groupId: string | null
    contentTreeAnchorItemId: string | null
    contentTreeFingerprint: string
    status: $Enums.PluginCodingHomeworkSnapshotStatus
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkDocumentationSnapshotCountAggregateOutputType | null
    _min: PluginCodingHomeworkDocumentationSnapshotMinAggregateOutputType | null
    _max: PluginCodingHomeworkDocumentationSnapshotMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkDocumentationSnapshotGroupByPayload<T extends PluginCodingHomeworkDocumentationSnapshotGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkDocumentationSnapshotGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkDocumentationSnapshotGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkDocumentationSnapshotGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkDocumentationSnapshotGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    activityId?: boolean
    courseId?: boolean
    groupId?: boolean
    contentTreeAnchorItemId?: boolean
    contentTreeFingerprint?: boolean
    status?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    referenceFunctions?: boolean | PluginCodingHomeworkDocumentationSnapshot$referenceFunctionsArgs<ExtArgs>
    submissions?: boolean | PluginCodingHomeworkDocumentationSnapshot$submissionsArgs<ExtArgs>
    _count?: boolean | PluginCodingHomeworkDocumentationSnapshotCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkDocumentationSnapshot"]>

  export type PluginCodingHomeworkDocumentationSnapshotSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    activityId?: boolean
    courseId?: boolean
    groupId?: boolean
    contentTreeAnchorItemId?: boolean
    contentTreeFingerprint?: boolean
    status?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["pluginCodingHomeworkDocumentationSnapshot"]>

  export type PluginCodingHomeworkDocumentationSnapshotSelectScalar = {
    id?: boolean
    activityId?: boolean
    courseId?: boolean
    groupId?: boolean
    contentTreeAnchorItemId?: boolean
    contentTreeFingerprint?: boolean
    status?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    referenceFunctions?: boolean | PluginCodingHomeworkDocumentationSnapshot$referenceFunctionsArgs<ExtArgs>
    submissions?: boolean | PluginCodingHomeworkDocumentationSnapshot$submissionsArgs<ExtArgs>
    _count?: boolean | PluginCodingHomeworkDocumentationSnapshotCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PluginCodingHomeworkDocumentationSnapshotIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkDocumentationSnapshot"
    objects: {
      referenceFunctions: Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>[]
      submissions: Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      activityId: string
      courseId: string
      groupId: string | null
      contentTreeAnchorItemId: string | null
      contentTreeFingerprint: string
      status: $Enums.PluginCodingHomeworkSnapshotStatus
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkDocumentationSnapshot"]>
    composites: {}
  }

  type PluginCodingHomeworkDocumentationSnapshotGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkDocumentationSnapshotDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload, S>

  type PluginCodingHomeworkDocumentationSnapshotCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkDocumentationSnapshotFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkDocumentationSnapshotCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkDocumentationSnapshotDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkDocumentationSnapshot'], meta: { name: 'PluginCodingHomeworkDocumentationSnapshot' } }
    /**
     * Find zero or one PluginCodingHomeworkDocumentationSnapshot that matches the filter.
     * @param {PluginCodingHomeworkDocumentationSnapshotFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkDocumentationSnapshot
     * @example
     * // Get one PluginCodingHomeworkDocumentationSnapshot
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkDocumentationSnapshotFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkDocumentationSnapshot that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkDocumentationSnapshotFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkDocumentationSnapshot
     * @example
     * // Get one PluginCodingHomeworkDocumentationSnapshot
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkDocumentationSnapshotFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkDocumentationSnapshot that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkDocumentationSnapshotFindFirstArgs} args - Arguments to find a PluginCodingHomeworkDocumentationSnapshot
     * @example
     * // Get one PluginCodingHomeworkDocumentationSnapshot
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkDocumentationSnapshotFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkDocumentationSnapshot that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkDocumentationSnapshotFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkDocumentationSnapshot
     * @example
     * // Get one PluginCodingHomeworkDocumentationSnapshot
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkDocumentationSnapshotFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkDocumentationSnapshots that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkDocumentationSnapshotFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkDocumentationSnapshots
     * const pluginCodingHomeworkDocumentationSnapshots = await prisma.pluginCodingHomeworkDocumentationSnapshot.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkDocumentationSnapshots
     * const pluginCodingHomeworkDocumentationSnapshots = await prisma.pluginCodingHomeworkDocumentationSnapshot.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkDocumentationSnapshotWithIdOnly = await prisma.pluginCodingHomeworkDocumentationSnapshot.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkDocumentationSnapshotFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkDocumentationSnapshot.
     * @param {PluginCodingHomeworkDocumentationSnapshotCreateArgs} args - Arguments to create a PluginCodingHomeworkDocumentationSnapshot.
     * @example
     * // Create one PluginCodingHomeworkDocumentationSnapshot
     * const PluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkDocumentationSnapshot
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkDocumentationSnapshotCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkDocumentationSnapshots.
     * @param {PluginCodingHomeworkDocumentationSnapshotCreateManyArgs} args - Arguments to create many PluginCodingHomeworkDocumentationSnapshots.
     * @example
     * // Create many PluginCodingHomeworkDocumentationSnapshots
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkDocumentationSnapshotCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkDocumentationSnapshots and returns the data saved in the database.
     * @param {PluginCodingHomeworkDocumentationSnapshotCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkDocumentationSnapshots.
     * @example
     * // Create many PluginCodingHomeworkDocumentationSnapshots
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkDocumentationSnapshots and only return the `id`
     * const pluginCodingHomeworkDocumentationSnapshotWithIdOnly = await prisma.pluginCodingHomeworkDocumentationSnapshot.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkDocumentationSnapshotCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkDocumentationSnapshot.
     * @param {PluginCodingHomeworkDocumentationSnapshotDeleteArgs} args - Arguments to delete one PluginCodingHomeworkDocumentationSnapshot.
     * @example
     * // Delete one PluginCodingHomeworkDocumentationSnapshot
     * const PluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkDocumentationSnapshot
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkDocumentationSnapshotDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkDocumentationSnapshot.
     * @param {PluginCodingHomeworkDocumentationSnapshotUpdateArgs} args - Arguments to update one PluginCodingHomeworkDocumentationSnapshot.
     * @example
     * // Update one PluginCodingHomeworkDocumentationSnapshot
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkDocumentationSnapshotUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkDocumentationSnapshots.
     * @param {PluginCodingHomeworkDocumentationSnapshotDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkDocumentationSnapshots to delete.
     * @example
     * // Delete a few PluginCodingHomeworkDocumentationSnapshots
     * const { count } = await prisma.pluginCodingHomeworkDocumentationSnapshot.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkDocumentationSnapshotDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkDocumentationSnapshots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkDocumentationSnapshotUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkDocumentationSnapshots
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkDocumentationSnapshotUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkDocumentationSnapshot.
     * @param {PluginCodingHomeworkDocumentationSnapshotUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkDocumentationSnapshot.
     * @example
     * // Update or create a PluginCodingHomeworkDocumentationSnapshot
     * const pluginCodingHomeworkDocumentationSnapshot = await prisma.pluginCodingHomeworkDocumentationSnapshot.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkDocumentationSnapshot
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkDocumentationSnapshot we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkDocumentationSnapshotUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkDocumentationSnapshotUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkDocumentationSnapshots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkDocumentationSnapshotCountArgs} args - Arguments to filter PluginCodingHomeworkDocumentationSnapshots to count.
     * @example
     * // Count the number of PluginCodingHomeworkDocumentationSnapshots
     * const count = await prisma.pluginCodingHomeworkDocumentationSnapshot.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkDocumentationSnapshots we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkDocumentationSnapshotCountArgs>(
      args?: Subset<T, PluginCodingHomeworkDocumentationSnapshotCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkDocumentationSnapshotCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkDocumentationSnapshot.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkDocumentationSnapshotAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkDocumentationSnapshotAggregateArgs>(args: Subset<T, PluginCodingHomeworkDocumentationSnapshotAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkDocumentationSnapshotAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkDocumentationSnapshot.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkDocumentationSnapshotGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkDocumentationSnapshotGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkDocumentationSnapshotGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkDocumentationSnapshotGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkDocumentationSnapshotGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkDocumentationSnapshotGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkDocumentationSnapshot model
   */
  readonly fields: PluginCodingHomeworkDocumentationSnapshotFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkDocumentationSnapshot.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkDocumentationSnapshotClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    referenceFunctions<T extends PluginCodingHomeworkDocumentationSnapshot$referenceFunctionsArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkDocumentationSnapshot$referenceFunctionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "findMany"> | Null>
    submissions<T extends PluginCodingHomeworkDocumentationSnapshot$submissionsArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkDocumentationSnapshot$submissionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkDocumentationSnapshot model
   */ 
  interface PluginCodingHomeworkDocumentationSnapshotFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'String'>
    readonly activityId: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'String'>
    readonly courseId: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'String'>
    readonly groupId: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'String'>
    readonly contentTreeAnchorItemId: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'String'>
    readonly contentTreeFingerprint: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'String'>
    readonly status: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'PluginCodingHomeworkSnapshotStatus'>
    readonly metadata: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkDocumentationSnapshot", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkDocumentationSnapshot findUnique
   */
  export type PluginCodingHomeworkDocumentationSnapshotFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkDocumentationSnapshot to fetch.
     */
    where: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot findUniqueOrThrow
   */
  export type PluginCodingHomeworkDocumentationSnapshotFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkDocumentationSnapshot to fetch.
     */
    where: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot findFirst
   */
  export type PluginCodingHomeworkDocumentationSnapshotFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkDocumentationSnapshot to fetch.
     */
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkDocumentationSnapshots to fetch.
     */
    orderBy?: PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput | PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkDocumentationSnapshots.
     */
    cursor?: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkDocumentationSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkDocumentationSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkDocumentationSnapshots.
     */
    distinct?: PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum | PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot findFirstOrThrow
   */
  export type PluginCodingHomeworkDocumentationSnapshotFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkDocumentationSnapshot to fetch.
     */
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkDocumentationSnapshots to fetch.
     */
    orderBy?: PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput | PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkDocumentationSnapshots.
     */
    cursor?: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkDocumentationSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkDocumentationSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkDocumentationSnapshots.
     */
    distinct?: PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum | PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot findMany
   */
  export type PluginCodingHomeworkDocumentationSnapshotFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkDocumentationSnapshots to fetch.
     */
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkDocumentationSnapshots to fetch.
     */
    orderBy?: PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput | PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkDocumentationSnapshots.
     */
    cursor?: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkDocumentationSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkDocumentationSnapshots.
     */
    skip?: number
    distinct?: PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum | PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot create
   */
  export type PluginCodingHomeworkDocumentationSnapshotCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkDocumentationSnapshot.
     */
    data: XOR<PluginCodingHomeworkDocumentationSnapshotCreateInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot createMany
   */
  export type PluginCodingHomeworkDocumentationSnapshotCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkDocumentationSnapshots.
     */
    data: PluginCodingHomeworkDocumentationSnapshotCreateManyInput | PluginCodingHomeworkDocumentationSnapshotCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot createManyAndReturn
   */
  export type PluginCodingHomeworkDocumentationSnapshotCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkDocumentationSnapshots.
     */
    data: PluginCodingHomeworkDocumentationSnapshotCreateManyInput | PluginCodingHomeworkDocumentationSnapshotCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot update
   */
  export type PluginCodingHomeworkDocumentationSnapshotUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkDocumentationSnapshot.
     */
    data: XOR<PluginCodingHomeworkDocumentationSnapshotUpdateInput, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkDocumentationSnapshot to update.
     */
    where: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot updateMany
   */
  export type PluginCodingHomeworkDocumentationSnapshotUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkDocumentationSnapshots.
     */
    data: XOR<PluginCodingHomeworkDocumentationSnapshotUpdateManyMutationInput, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkDocumentationSnapshots to update
     */
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot upsert
   */
  export type PluginCodingHomeworkDocumentationSnapshotUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkDocumentationSnapshot to update in case it exists.
     */
    where: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkDocumentationSnapshot found by the `where` argument doesn't exist, create a new PluginCodingHomeworkDocumentationSnapshot with this data.
     */
    create: XOR<PluginCodingHomeworkDocumentationSnapshotCreateInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkDocumentationSnapshot was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkDocumentationSnapshotUpdateInput, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot delete
   */
  export type PluginCodingHomeworkDocumentationSnapshotDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkDocumentationSnapshot to delete.
     */
    where: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot deleteMany
   */
  export type PluginCodingHomeworkDocumentationSnapshotDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkDocumentationSnapshots to delete
     */
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot.referenceFunctions
   */
  export type PluginCodingHomeworkDocumentationSnapshot$referenceFunctionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
    orderBy?: PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput | PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput[]
    cursor?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PluginCodingHomeworkReferenceFunctionScalarFieldEnum | PluginCodingHomeworkReferenceFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot.submissions
   */
  export type PluginCodingHomeworkDocumentationSnapshot$submissionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    where?: PluginCodingHomeworkSubmissionWhereInput
    orderBy?: PluginCodingHomeworkSubmissionOrderByWithRelationInput | PluginCodingHomeworkSubmissionOrderByWithRelationInput[]
    cursor?: PluginCodingHomeworkSubmissionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PluginCodingHomeworkSubmissionScalarFieldEnum | PluginCodingHomeworkSubmissionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkDocumentationSnapshot without action
   */
  export type PluginCodingHomeworkDocumentationSnapshotDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkReferenceFunction
   */

  export type AggregatePluginCodingHomeworkReferenceFunction = {
    _count: PluginCodingHomeworkReferenceFunctionCountAggregateOutputType | null
    _min: PluginCodingHomeworkReferenceFunctionMinAggregateOutputType | null
    _max: PluginCodingHomeworkReferenceFunctionMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkReferenceFunctionMinAggregateOutputType = {
    id: string | null
    snapshotId: string | null
    contentResourceId: string | null
    sourceTitle: string | null
    sourceKind: string | null
    languageKey: string | null
    functionName: string | null
    functionCode: string | null
    astText: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkReferenceFunctionMaxAggregateOutputType = {
    id: string | null
    snapshotId: string | null
    contentResourceId: string | null
    sourceTitle: string | null
    sourceKind: string | null
    languageKey: string | null
    functionName: string | null
    functionCode: string | null
    astText: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkReferenceFunctionCountAggregateOutputType = {
    id: number
    snapshotId: number
    contentResourceId: number
    sourceTitle: number
    sourceKind: number
    languageKey: number
    functionName: number
    functionCode: number
    astText: number
    embedding: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkReferenceFunctionMinAggregateInputType = {
    id?: true
    snapshotId?: true
    contentResourceId?: true
    sourceTitle?: true
    sourceKind?: true
    languageKey?: true
    functionName?: true
    functionCode?: true
    astText?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkReferenceFunctionMaxAggregateInputType = {
    id?: true
    snapshotId?: true
    contentResourceId?: true
    sourceTitle?: true
    sourceKind?: true
    languageKey?: true
    functionName?: true
    functionCode?: true
    astText?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkReferenceFunctionCountAggregateInputType = {
    id?: true
    snapshotId?: true
    contentResourceId?: true
    sourceTitle?: true
    sourceKind?: true
    languageKey?: true
    functionName?: true
    functionCode?: true
    astText?: true
    embedding?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkReferenceFunctionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkReferenceFunction to aggregate.
     */
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkReferenceFunctions to fetch.
     */
    orderBy?: PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput | PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkReferenceFunctions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkReferenceFunctions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkReferenceFunctions
    **/
    _count?: true | PluginCodingHomeworkReferenceFunctionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkReferenceFunctionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkReferenceFunctionMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkReferenceFunctionAggregateType<T extends PluginCodingHomeworkReferenceFunctionAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkReferenceFunction]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkReferenceFunction[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkReferenceFunction[P]>
  }




  export type PluginCodingHomeworkReferenceFunctionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
    orderBy?: PluginCodingHomeworkReferenceFunctionOrderByWithAggregationInput | PluginCodingHomeworkReferenceFunctionOrderByWithAggregationInput[]
    by: PluginCodingHomeworkReferenceFunctionScalarFieldEnum[] | PluginCodingHomeworkReferenceFunctionScalarFieldEnum
    having?: PluginCodingHomeworkReferenceFunctionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkReferenceFunctionCountAggregateInputType | true
    _min?: PluginCodingHomeworkReferenceFunctionMinAggregateInputType
    _max?: PluginCodingHomeworkReferenceFunctionMaxAggregateInputType
  }

  export type PluginCodingHomeworkReferenceFunctionGroupByOutputType = {
    id: string
    snapshotId: string
    contentResourceId: string | null
    sourceTitle: string
    sourceKind: string
    languageKey: string
    functionName: string
    functionCode: string
    astText: string
    embedding: JsonValue
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkReferenceFunctionCountAggregateOutputType | null
    _min: PluginCodingHomeworkReferenceFunctionMinAggregateOutputType | null
    _max: PluginCodingHomeworkReferenceFunctionMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkReferenceFunctionGroupByPayload<T extends PluginCodingHomeworkReferenceFunctionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkReferenceFunctionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkReferenceFunctionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkReferenceFunctionGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkReferenceFunctionGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkReferenceFunctionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    snapshotId?: boolean
    contentResourceId?: boolean
    sourceTitle?: boolean
    sourceKind?: boolean
    languageKey?: boolean
    functionName?: boolean
    functionCode?: boolean
    astText?: boolean
    embedding?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    snapshot?: boolean | PluginCodingHomeworkDocumentationSnapshotDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkReferenceFunction"]>

  export type PluginCodingHomeworkReferenceFunctionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    snapshotId?: boolean
    contentResourceId?: boolean
    sourceTitle?: boolean
    sourceKind?: boolean
    languageKey?: boolean
    functionName?: boolean
    functionCode?: boolean
    astText?: boolean
    embedding?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    snapshot?: boolean | PluginCodingHomeworkDocumentationSnapshotDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkReferenceFunction"]>

  export type PluginCodingHomeworkReferenceFunctionSelectScalar = {
    id?: boolean
    snapshotId?: boolean
    contentResourceId?: boolean
    sourceTitle?: boolean
    sourceKind?: boolean
    languageKey?: boolean
    functionName?: boolean
    functionCode?: boolean
    astText?: boolean
    embedding?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PluginCodingHomeworkReferenceFunctionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    snapshot?: boolean | PluginCodingHomeworkDocumentationSnapshotDefaultArgs<ExtArgs>
  }
  export type PluginCodingHomeworkReferenceFunctionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    snapshot?: boolean | PluginCodingHomeworkDocumentationSnapshotDefaultArgs<ExtArgs>
  }

  export type $PluginCodingHomeworkReferenceFunctionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkReferenceFunction"
    objects: {
      snapshot: Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      snapshotId: string
      contentResourceId: string | null
      sourceTitle: string
      sourceKind: string
      languageKey: string
      functionName: string
      functionCode: string
      astText: string
      embedding: Prisma.JsonValue
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkReferenceFunction"]>
    composites: {}
  }

  type PluginCodingHomeworkReferenceFunctionGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkReferenceFunctionDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload, S>

  type PluginCodingHomeworkReferenceFunctionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkReferenceFunctionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkReferenceFunctionCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkReferenceFunctionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkReferenceFunction'], meta: { name: 'PluginCodingHomeworkReferenceFunction' } }
    /**
     * Find zero or one PluginCodingHomeworkReferenceFunction that matches the filter.
     * @param {PluginCodingHomeworkReferenceFunctionFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkReferenceFunction
     * @example
     * // Get one PluginCodingHomeworkReferenceFunction
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkReferenceFunctionFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkReferenceFunctionFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReferenceFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkReferenceFunction that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkReferenceFunctionFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkReferenceFunction
     * @example
     * // Get one PluginCodingHomeworkReferenceFunction
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkReferenceFunctionFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkReferenceFunctionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReferenceFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkReferenceFunction that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReferenceFunctionFindFirstArgs} args - Arguments to find a PluginCodingHomeworkReferenceFunction
     * @example
     * // Get one PluginCodingHomeworkReferenceFunction
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkReferenceFunctionFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkReferenceFunctionFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReferenceFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkReferenceFunction that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReferenceFunctionFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkReferenceFunction
     * @example
     * // Get one PluginCodingHomeworkReferenceFunction
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkReferenceFunctionFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkReferenceFunctionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReferenceFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkReferenceFunctions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReferenceFunctionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkReferenceFunctions
     * const pluginCodingHomeworkReferenceFunctions = await prisma.pluginCodingHomeworkReferenceFunction.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkReferenceFunctions
     * const pluginCodingHomeworkReferenceFunctions = await prisma.pluginCodingHomeworkReferenceFunction.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkReferenceFunctionWithIdOnly = await prisma.pluginCodingHomeworkReferenceFunction.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkReferenceFunctionFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkReferenceFunctionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkReferenceFunction.
     * @param {PluginCodingHomeworkReferenceFunctionCreateArgs} args - Arguments to create a PluginCodingHomeworkReferenceFunction.
     * @example
     * // Create one PluginCodingHomeworkReferenceFunction
     * const PluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkReferenceFunction
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkReferenceFunctionCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkReferenceFunctionCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReferenceFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkReferenceFunctions.
     * @param {PluginCodingHomeworkReferenceFunctionCreateManyArgs} args - Arguments to create many PluginCodingHomeworkReferenceFunctions.
     * @example
     * // Create many PluginCodingHomeworkReferenceFunctions
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkReferenceFunctionCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkReferenceFunctionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkReferenceFunctions and returns the data saved in the database.
     * @param {PluginCodingHomeworkReferenceFunctionCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkReferenceFunctions.
     * @example
     * // Create many PluginCodingHomeworkReferenceFunctions
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkReferenceFunctions and only return the `id`
     * const pluginCodingHomeworkReferenceFunctionWithIdOnly = await prisma.pluginCodingHomeworkReferenceFunction.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkReferenceFunctionCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkReferenceFunctionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkReferenceFunction.
     * @param {PluginCodingHomeworkReferenceFunctionDeleteArgs} args - Arguments to delete one PluginCodingHomeworkReferenceFunction.
     * @example
     * // Delete one PluginCodingHomeworkReferenceFunction
     * const PluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkReferenceFunction
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkReferenceFunctionDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkReferenceFunctionDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReferenceFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkReferenceFunction.
     * @param {PluginCodingHomeworkReferenceFunctionUpdateArgs} args - Arguments to update one PluginCodingHomeworkReferenceFunction.
     * @example
     * // Update one PluginCodingHomeworkReferenceFunction
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkReferenceFunctionUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkReferenceFunctionUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReferenceFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkReferenceFunctions.
     * @param {PluginCodingHomeworkReferenceFunctionDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkReferenceFunctions to delete.
     * @example
     * // Delete a few PluginCodingHomeworkReferenceFunctions
     * const { count } = await prisma.pluginCodingHomeworkReferenceFunction.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkReferenceFunctionDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkReferenceFunctionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkReferenceFunctions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReferenceFunctionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkReferenceFunctions
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkReferenceFunctionUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkReferenceFunctionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkReferenceFunction.
     * @param {PluginCodingHomeworkReferenceFunctionUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkReferenceFunction.
     * @example
     * // Update or create a PluginCodingHomeworkReferenceFunction
     * const pluginCodingHomeworkReferenceFunction = await prisma.pluginCodingHomeworkReferenceFunction.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkReferenceFunction
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkReferenceFunction we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkReferenceFunctionUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkReferenceFunctionUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReferenceFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReferenceFunctionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkReferenceFunctions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReferenceFunctionCountArgs} args - Arguments to filter PluginCodingHomeworkReferenceFunctions to count.
     * @example
     * // Count the number of PluginCodingHomeworkReferenceFunctions
     * const count = await prisma.pluginCodingHomeworkReferenceFunction.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkReferenceFunctions we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkReferenceFunctionCountArgs>(
      args?: Subset<T, PluginCodingHomeworkReferenceFunctionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkReferenceFunctionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkReferenceFunction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReferenceFunctionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkReferenceFunctionAggregateArgs>(args: Subset<T, PluginCodingHomeworkReferenceFunctionAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkReferenceFunctionAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkReferenceFunction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReferenceFunctionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkReferenceFunctionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkReferenceFunctionGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkReferenceFunctionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkReferenceFunctionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkReferenceFunctionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkReferenceFunction model
   */
  readonly fields: PluginCodingHomeworkReferenceFunctionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkReferenceFunction.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkReferenceFunctionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    snapshot<T extends PluginCodingHomeworkDocumentationSnapshotDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkDocumentationSnapshotDefaultArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkReferenceFunction model
   */ 
  interface PluginCodingHomeworkReferenceFunctionFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly snapshotId: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly contentResourceId: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly sourceTitle: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly sourceKind: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly languageKey: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly functionName: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly functionCode: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly astText: FieldRef<"PluginCodingHomeworkReferenceFunction", 'String'>
    readonly embedding: FieldRef<"PluginCodingHomeworkReferenceFunction", 'Json'>
    readonly metadata: FieldRef<"PluginCodingHomeworkReferenceFunction", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkReferenceFunction", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkReferenceFunction", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkReferenceFunction findUnique
   */
  export type PluginCodingHomeworkReferenceFunctionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReferenceFunction to fetch.
     */
    where: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkReferenceFunction findUniqueOrThrow
   */
  export type PluginCodingHomeworkReferenceFunctionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReferenceFunction to fetch.
     */
    where: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkReferenceFunction findFirst
   */
  export type PluginCodingHomeworkReferenceFunctionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReferenceFunction to fetch.
     */
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkReferenceFunctions to fetch.
     */
    orderBy?: PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput | PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkReferenceFunctions.
     */
    cursor?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkReferenceFunctions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkReferenceFunctions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkReferenceFunctions.
     */
    distinct?: PluginCodingHomeworkReferenceFunctionScalarFieldEnum | PluginCodingHomeworkReferenceFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkReferenceFunction findFirstOrThrow
   */
  export type PluginCodingHomeworkReferenceFunctionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReferenceFunction to fetch.
     */
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkReferenceFunctions to fetch.
     */
    orderBy?: PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput | PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkReferenceFunctions.
     */
    cursor?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkReferenceFunctions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkReferenceFunctions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkReferenceFunctions.
     */
    distinct?: PluginCodingHomeworkReferenceFunctionScalarFieldEnum | PluginCodingHomeworkReferenceFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkReferenceFunction findMany
   */
  export type PluginCodingHomeworkReferenceFunctionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReferenceFunctions to fetch.
     */
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkReferenceFunctions to fetch.
     */
    orderBy?: PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput | PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkReferenceFunctions.
     */
    cursor?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkReferenceFunctions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkReferenceFunctions.
     */
    skip?: number
    distinct?: PluginCodingHomeworkReferenceFunctionScalarFieldEnum | PluginCodingHomeworkReferenceFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkReferenceFunction create
   */
  export type PluginCodingHomeworkReferenceFunctionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkReferenceFunction.
     */
    data: XOR<PluginCodingHomeworkReferenceFunctionCreateInput, PluginCodingHomeworkReferenceFunctionUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkReferenceFunction createMany
   */
  export type PluginCodingHomeworkReferenceFunctionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkReferenceFunctions.
     */
    data: PluginCodingHomeworkReferenceFunctionCreateManyInput | PluginCodingHomeworkReferenceFunctionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkReferenceFunction createManyAndReturn
   */
  export type PluginCodingHomeworkReferenceFunctionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkReferenceFunctions.
     */
    data: PluginCodingHomeworkReferenceFunctionCreateManyInput | PluginCodingHomeworkReferenceFunctionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkReferenceFunction update
   */
  export type PluginCodingHomeworkReferenceFunctionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkReferenceFunction.
     */
    data: XOR<PluginCodingHomeworkReferenceFunctionUpdateInput, PluginCodingHomeworkReferenceFunctionUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkReferenceFunction to update.
     */
    where: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkReferenceFunction updateMany
   */
  export type PluginCodingHomeworkReferenceFunctionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkReferenceFunctions.
     */
    data: XOR<PluginCodingHomeworkReferenceFunctionUpdateManyMutationInput, PluginCodingHomeworkReferenceFunctionUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkReferenceFunctions to update
     */
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
  }

  /**
   * PluginCodingHomeworkReferenceFunction upsert
   */
  export type PluginCodingHomeworkReferenceFunctionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkReferenceFunction to update in case it exists.
     */
    where: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkReferenceFunction found by the `where` argument doesn't exist, create a new PluginCodingHomeworkReferenceFunction with this data.
     */
    create: XOR<PluginCodingHomeworkReferenceFunctionCreateInput, PluginCodingHomeworkReferenceFunctionUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkReferenceFunction was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkReferenceFunctionUpdateInput, PluginCodingHomeworkReferenceFunctionUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkReferenceFunction delete
   */
  export type PluginCodingHomeworkReferenceFunctionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkReferenceFunction to delete.
     */
    where: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkReferenceFunction deleteMany
   */
  export type PluginCodingHomeworkReferenceFunctionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkReferenceFunctions to delete
     */
    where?: PluginCodingHomeworkReferenceFunctionWhereInput
  }

  /**
   * PluginCodingHomeworkReferenceFunction without action
   */
  export type PluginCodingHomeworkReferenceFunctionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReferenceFunction
     */
    select?: PluginCodingHomeworkReferenceFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReferenceFunctionInclude<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkSubmission
   */

  export type AggregatePluginCodingHomeworkSubmission = {
    _count: PluginCodingHomeworkSubmissionCountAggregateOutputType | null
    _min: PluginCodingHomeworkSubmissionMinAggregateOutputType | null
    _max: PluginCodingHomeworkSubmissionMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkSubmissionMinAggregateOutputType = {
    id: string | null
    activityId: string | null
    groupId: string | null
    userId: string | null
    coreAttemptId: string | null
    documentationSnapshotId: string | null
    zipAttachmentId: string | null
    kind: $Enums.PluginCodingHomeworkSubmissionKind | null
    status: $Enums.PluginCodingHomeworkSubmissionStatus | null
    processingError: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkSubmissionMaxAggregateOutputType = {
    id: string | null
    activityId: string | null
    groupId: string | null
    userId: string | null
    coreAttemptId: string | null
    documentationSnapshotId: string | null
    zipAttachmentId: string | null
    kind: $Enums.PluginCodingHomeworkSubmissionKind | null
    status: $Enums.PluginCodingHomeworkSubmissionStatus | null
    processingError: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkSubmissionCountAggregateOutputType = {
    id: number
    activityId: number
    groupId: number
    userId: number
    coreAttemptId: number
    documentationSnapshotId: number
    zipAttachmentId: number
    kind: number
    status: number
    structureValidationSummary: number
    processingError: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkSubmissionMinAggregateInputType = {
    id?: true
    activityId?: true
    groupId?: true
    userId?: true
    coreAttemptId?: true
    documentationSnapshotId?: true
    zipAttachmentId?: true
    kind?: true
    status?: true
    processingError?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkSubmissionMaxAggregateInputType = {
    id?: true
    activityId?: true
    groupId?: true
    userId?: true
    coreAttemptId?: true
    documentationSnapshotId?: true
    zipAttachmentId?: true
    kind?: true
    status?: true
    processingError?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkSubmissionCountAggregateInputType = {
    id?: true
    activityId?: true
    groupId?: true
    userId?: true
    coreAttemptId?: true
    documentationSnapshotId?: true
    zipAttachmentId?: true
    kind?: true
    status?: true
    structureValidationSummary?: true
    processingError?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkSubmissionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkSubmission to aggregate.
     */
    where?: PluginCodingHomeworkSubmissionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissions to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionOrderByWithRelationInput | PluginCodingHomeworkSubmissionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkSubmissionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkSubmissions
    **/
    _count?: true | PluginCodingHomeworkSubmissionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkSubmissionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkSubmissionMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkSubmissionAggregateType<T extends PluginCodingHomeworkSubmissionAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkSubmission]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkSubmission[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkSubmission[P]>
  }




  export type PluginCodingHomeworkSubmissionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkSubmissionWhereInput
    orderBy?: PluginCodingHomeworkSubmissionOrderByWithAggregationInput | PluginCodingHomeworkSubmissionOrderByWithAggregationInput[]
    by: PluginCodingHomeworkSubmissionScalarFieldEnum[] | PluginCodingHomeworkSubmissionScalarFieldEnum
    having?: PluginCodingHomeworkSubmissionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkSubmissionCountAggregateInputType | true
    _min?: PluginCodingHomeworkSubmissionMinAggregateInputType
    _max?: PluginCodingHomeworkSubmissionMaxAggregateInputType
  }

  export type PluginCodingHomeworkSubmissionGroupByOutputType = {
    id: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId: string | null
    documentationSnapshotId: string | null
    zipAttachmentId: string | null
    kind: $Enums.PluginCodingHomeworkSubmissionKind
    status: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary: JsonValue
    processingError: string | null
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkSubmissionCountAggregateOutputType | null
    _min: PluginCodingHomeworkSubmissionMinAggregateOutputType | null
    _max: PluginCodingHomeworkSubmissionMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkSubmissionGroupByPayload<T extends PluginCodingHomeworkSubmissionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkSubmissionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkSubmissionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkSubmissionGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkSubmissionGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkSubmissionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    activityId?: boolean
    groupId?: boolean
    userId?: boolean
    coreAttemptId?: boolean
    documentationSnapshotId?: boolean
    zipAttachmentId?: boolean
    kind?: boolean
    status?: boolean
    structureValidationSummary?: boolean
    processingError?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    documentationSnapshot?: boolean | PluginCodingHomeworkSubmission$documentationSnapshotArgs<ExtArgs>
    files?: boolean | PluginCodingHomeworkSubmission$filesArgs<ExtArgs>
    functions?: boolean | PluginCodingHomeworkSubmission$functionsArgs<ExtArgs>
    questions?: boolean | PluginCodingHomeworkSubmission$questionsArgs<ExtArgs>
    reviews?: boolean | PluginCodingHomeworkSubmission$reviewsArgs<ExtArgs>
    _count?: boolean | PluginCodingHomeworkSubmissionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkSubmission"]>

  export type PluginCodingHomeworkSubmissionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    activityId?: boolean
    groupId?: boolean
    userId?: boolean
    coreAttemptId?: boolean
    documentationSnapshotId?: boolean
    zipAttachmentId?: boolean
    kind?: boolean
    status?: boolean
    structureValidationSummary?: boolean
    processingError?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    documentationSnapshot?: boolean | PluginCodingHomeworkSubmission$documentationSnapshotArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkSubmission"]>

  export type PluginCodingHomeworkSubmissionSelectScalar = {
    id?: boolean
    activityId?: boolean
    groupId?: boolean
    userId?: boolean
    coreAttemptId?: boolean
    documentationSnapshotId?: boolean
    zipAttachmentId?: boolean
    kind?: boolean
    status?: boolean
    structureValidationSummary?: boolean
    processingError?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PluginCodingHomeworkSubmissionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    documentationSnapshot?: boolean | PluginCodingHomeworkSubmission$documentationSnapshotArgs<ExtArgs>
    files?: boolean | PluginCodingHomeworkSubmission$filesArgs<ExtArgs>
    functions?: boolean | PluginCodingHomeworkSubmission$functionsArgs<ExtArgs>
    questions?: boolean | PluginCodingHomeworkSubmission$questionsArgs<ExtArgs>
    reviews?: boolean | PluginCodingHomeworkSubmission$reviewsArgs<ExtArgs>
    _count?: boolean | PluginCodingHomeworkSubmissionCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PluginCodingHomeworkSubmissionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    documentationSnapshot?: boolean | PluginCodingHomeworkSubmission$documentationSnapshotArgs<ExtArgs>
  }

  export type $PluginCodingHomeworkSubmissionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkSubmission"
    objects: {
      documentationSnapshot: Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs> | null
      files: Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>[]
      functions: Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>[]
      questions: Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>[]
      reviews: Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      activityId: string
      groupId: string
      userId: string
      coreAttemptId: string | null
      documentationSnapshotId: string | null
      zipAttachmentId: string | null
      kind: $Enums.PluginCodingHomeworkSubmissionKind
      status: $Enums.PluginCodingHomeworkSubmissionStatus
      structureValidationSummary: Prisma.JsonValue
      processingError: string | null
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkSubmission"]>
    composites: {}
  }

  type PluginCodingHomeworkSubmissionGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkSubmissionDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload, S>

  type PluginCodingHomeworkSubmissionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkSubmissionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkSubmissionCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkSubmissionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkSubmission'], meta: { name: 'PluginCodingHomeworkSubmission' } }
    /**
     * Find zero or one PluginCodingHomeworkSubmission that matches the filter.
     * @param {PluginCodingHomeworkSubmissionFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkSubmission
     * @example
     * // Get one PluginCodingHomeworkSubmission
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkSubmissionFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkSubmission that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkSubmissionFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkSubmission
     * @example
     * // Get one PluginCodingHomeworkSubmission
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkSubmissionFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkSubmission that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFindFirstArgs} args - Arguments to find a PluginCodingHomeworkSubmission
     * @example
     * // Get one PluginCodingHomeworkSubmission
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkSubmissionFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkSubmission that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkSubmission
     * @example
     * // Get one PluginCodingHomeworkSubmission
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkSubmissionFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkSubmissions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkSubmissions
     * const pluginCodingHomeworkSubmissions = await prisma.pluginCodingHomeworkSubmission.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkSubmissions
     * const pluginCodingHomeworkSubmissions = await prisma.pluginCodingHomeworkSubmission.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkSubmissionWithIdOnly = await prisma.pluginCodingHomeworkSubmission.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkSubmissionFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkSubmission.
     * @param {PluginCodingHomeworkSubmissionCreateArgs} args - Arguments to create a PluginCodingHomeworkSubmission.
     * @example
     * // Create one PluginCodingHomeworkSubmission
     * const PluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkSubmission
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkSubmissionCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkSubmissions.
     * @param {PluginCodingHomeworkSubmissionCreateManyArgs} args - Arguments to create many PluginCodingHomeworkSubmissions.
     * @example
     * // Create many PluginCodingHomeworkSubmissions
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkSubmissionCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkSubmissions and returns the data saved in the database.
     * @param {PluginCodingHomeworkSubmissionCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkSubmissions.
     * @example
     * // Create many PluginCodingHomeworkSubmissions
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkSubmissions and only return the `id`
     * const pluginCodingHomeworkSubmissionWithIdOnly = await prisma.pluginCodingHomeworkSubmission.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkSubmissionCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkSubmission.
     * @param {PluginCodingHomeworkSubmissionDeleteArgs} args - Arguments to delete one PluginCodingHomeworkSubmission.
     * @example
     * // Delete one PluginCodingHomeworkSubmission
     * const PluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkSubmission
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkSubmissionDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkSubmission.
     * @param {PluginCodingHomeworkSubmissionUpdateArgs} args - Arguments to update one PluginCodingHomeworkSubmission.
     * @example
     * // Update one PluginCodingHomeworkSubmission
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkSubmissionUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkSubmissions.
     * @param {PluginCodingHomeworkSubmissionDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkSubmissions to delete.
     * @example
     * // Delete a few PluginCodingHomeworkSubmissions
     * const { count } = await prisma.pluginCodingHomeworkSubmission.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkSubmissionDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkSubmissions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkSubmissions
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkSubmissionUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkSubmission.
     * @param {PluginCodingHomeworkSubmissionUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkSubmission.
     * @example
     * // Update or create a PluginCodingHomeworkSubmission
     * const pluginCodingHomeworkSubmission = await prisma.pluginCodingHomeworkSubmission.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkSubmission
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkSubmission we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkSubmissionUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkSubmissions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionCountArgs} args - Arguments to filter PluginCodingHomeworkSubmissions to count.
     * @example
     * // Count the number of PluginCodingHomeworkSubmissions
     * const count = await prisma.pluginCodingHomeworkSubmission.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkSubmissions we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkSubmissionCountArgs>(
      args?: Subset<T, PluginCodingHomeworkSubmissionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkSubmissionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkSubmission.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkSubmissionAggregateArgs>(args: Subset<T, PluginCodingHomeworkSubmissionAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkSubmissionAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkSubmission.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkSubmissionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkSubmissionGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkSubmissionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkSubmissionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkSubmissionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkSubmission model
   */
  readonly fields: PluginCodingHomeworkSubmissionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkSubmission.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkSubmissionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    documentationSnapshot<T extends PluginCodingHomeworkSubmission$documentationSnapshotArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmission$documentationSnapshotArgs<ExtArgs>>): Prisma__PluginCodingHomeworkDocumentationSnapshotClient<$Result.GetResult<Prisma.$PluginCodingHomeworkDocumentationSnapshotPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    files<T extends PluginCodingHomeworkSubmission$filesArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmission$filesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "findMany"> | Null>
    functions<T extends PluginCodingHomeworkSubmission$functionsArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmission$functionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "findMany"> | Null>
    questions<T extends PluginCodingHomeworkSubmission$questionsArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmission$questionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "findMany"> | Null>
    reviews<T extends PluginCodingHomeworkSubmission$reviewsArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmission$reviewsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkSubmission model
   */ 
  interface PluginCodingHomeworkSubmissionFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkSubmission", 'String'>
    readonly activityId: FieldRef<"PluginCodingHomeworkSubmission", 'String'>
    readonly groupId: FieldRef<"PluginCodingHomeworkSubmission", 'String'>
    readonly userId: FieldRef<"PluginCodingHomeworkSubmission", 'String'>
    readonly coreAttemptId: FieldRef<"PluginCodingHomeworkSubmission", 'String'>
    readonly documentationSnapshotId: FieldRef<"PluginCodingHomeworkSubmission", 'String'>
    readonly zipAttachmentId: FieldRef<"PluginCodingHomeworkSubmission", 'String'>
    readonly kind: FieldRef<"PluginCodingHomeworkSubmission", 'PluginCodingHomeworkSubmissionKind'>
    readonly status: FieldRef<"PluginCodingHomeworkSubmission", 'PluginCodingHomeworkSubmissionStatus'>
    readonly structureValidationSummary: FieldRef<"PluginCodingHomeworkSubmission", 'Json'>
    readonly processingError: FieldRef<"PluginCodingHomeworkSubmission", 'String'>
    readonly metadata: FieldRef<"PluginCodingHomeworkSubmission", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkSubmission", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkSubmission", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkSubmission findUnique
   */
  export type PluginCodingHomeworkSubmissionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmission to fetch.
     */
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmission findUniqueOrThrow
   */
  export type PluginCodingHomeworkSubmissionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmission to fetch.
     */
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmission findFirst
   */
  export type PluginCodingHomeworkSubmissionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmission to fetch.
     */
    where?: PluginCodingHomeworkSubmissionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissions to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionOrderByWithRelationInput | PluginCodingHomeworkSubmissionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkSubmissions.
     */
    cursor?: PluginCodingHomeworkSubmissionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkSubmissions.
     */
    distinct?: PluginCodingHomeworkSubmissionScalarFieldEnum | PluginCodingHomeworkSubmissionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmission findFirstOrThrow
   */
  export type PluginCodingHomeworkSubmissionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmission to fetch.
     */
    where?: PluginCodingHomeworkSubmissionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissions to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionOrderByWithRelationInput | PluginCodingHomeworkSubmissionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkSubmissions.
     */
    cursor?: PluginCodingHomeworkSubmissionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkSubmissions.
     */
    distinct?: PluginCodingHomeworkSubmissionScalarFieldEnum | PluginCodingHomeworkSubmissionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmission findMany
   */
  export type PluginCodingHomeworkSubmissionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissions to fetch.
     */
    where?: PluginCodingHomeworkSubmissionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissions to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionOrderByWithRelationInput | PluginCodingHomeworkSubmissionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkSubmissions.
     */
    cursor?: PluginCodingHomeworkSubmissionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissions.
     */
    skip?: number
    distinct?: PluginCodingHomeworkSubmissionScalarFieldEnum | PluginCodingHomeworkSubmissionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmission create
   */
  export type PluginCodingHomeworkSubmissionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkSubmission.
     */
    data: XOR<PluginCodingHomeworkSubmissionCreateInput, PluginCodingHomeworkSubmissionUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkSubmission createMany
   */
  export type PluginCodingHomeworkSubmissionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkSubmissions.
     */
    data: PluginCodingHomeworkSubmissionCreateManyInput | PluginCodingHomeworkSubmissionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkSubmission createManyAndReturn
   */
  export type PluginCodingHomeworkSubmissionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkSubmissions.
     */
    data: PluginCodingHomeworkSubmissionCreateManyInput | PluginCodingHomeworkSubmissionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkSubmission update
   */
  export type PluginCodingHomeworkSubmissionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkSubmission.
     */
    data: XOR<PluginCodingHomeworkSubmissionUpdateInput, PluginCodingHomeworkSubmissionUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkSubmission to update.
     */
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmission updateMany
   */
  export type PluginCodingHomeworkSubmissionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkSubmissions.
     */
    data: XOR<PluginCodingHomeworkSubmissionUpdateManyMutationInput, PluginCodingHomeworkSubmissionUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkSubmissions to update
     */
    where?: PluginCodingHomeworkSubmissionWhereInput
  }

  /**
   * PluginCodingHomeworkSubmission upsert
   */
  export type PluginCodingHomeworkSubmissionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkSubmission to update in case it exists.
     */
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkSubmission found by the `where` argument doesn't exist, create a new PluginCodingHomeworkSubmission with this data.
     */
    create: XOR<PluginCodingHomeworkSubmissionCreateInput, PluginCodingHomeworkSubmissionUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkSubmission was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkSubmissionUpdateInput, PluginCodingHomeworkSubmissionUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkSubmission delete
   */
  export type PluginCodingHomeworkSubmissionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkSubmission to delete.
     */
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmission deleteMany
   */
  export type PluginCodingHomeworkSubmissionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkSubmissions to delete
     */
    where?: PluginCodingHomeworkSubmissionWhereInput
  }

  /**
   * PluginCodingHomeworkSubmission.documentationSnapshot
   */
  export type PluginCodingHomeworkSubmission$documentationSnapshotArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkDocumentationSnapshot
     */
    select?: PluginCodingHomeworkDocumentationSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkDocumentationSnapshotInclude<ExtArgs> | null
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
  }

  /**
   * PluginCodingHomeworkSubmission.files
   */
  export type PluginCodingHomeworkSubmission$filesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    where?: PluginCodingHomeworkSubmissionFileWhereInput
    orderBy?: PluginCodingHomeworkSubmissionFileOrderByWithRelationInput | PluginCodingHomeworkSubmissionFileOrderByWithRelationInput[]
    cursor?: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PluginCodingHomeworkSubmissionFileScalarFieldEnum | PluginCodingHomeworkSubmissionFileScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmission.functions
   */
  export type PluginCodingHomeworkSubmission$functionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
    orderBy?: PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput | PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput[]
    cursor?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PluginCodingHomeworkSubmissionFunctionScalarFieldEnum | PluginCodingHomeworkSubmissionFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmission.questions
   */
  export type PluginCodingHomeworkSubmission$questionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
    orderBy?: PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput | PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput[]
    cursor?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PluginCodingHomeworkChallengeQuestionScalarFieldEnum | PluginCodingHomeworkChallengeQuestionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmission.reviews
   */
  export type PluginCodingHomeworkSubmission$reviewsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    where?: PluginCodingHomeworkReviewWhereInput
    orderBy?: PluginCodingHomeworkReviewOrderByWithRelationInput | PluginCodingHomeworkReviewOrderByWithRelationInput[]
    cursor?: PluginCodingHomeworkReviewWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PluginCodingHomeworkReviewScalarFieldEnum | PluginCodingHomeworkReviewScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmission without action
   */
  export type PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmission
     */
    select?: PluginCodingHomeworkSubmissionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionInclude<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkSubmissionFile
   */

  export type AggregatePluginCodingHomeworkSubmissionFile = {
    _count: PluginCodingHomeworkSubmissionFileCountAggregateOutputType | null
    _avg: PluginCodingHomeworkSubmissionFileAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkSubmissionFileSumAggregateOutputType | null
    _min: PluginCodingHomeworkSubmissionFileMinAggregateOutputType | null
    _max: PluginCodingHomeworkSubmissionFileMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkSubmissionFileAvgAggregateOutputType = {
    sizeBytes: number | null
  }

  export type PluginCodingHomeworkSubmissionFileSumAggregateOutputType = {
    sizeBytes: bigint | null
  }

  export type PluginCodingHomeworkSubmissionFileMinAggregateOutputType = {
    id: string | null
    submissionId: string | null
    path: string | null
    languageKey: string | null
    sizeBytes: bigint | null
    sha256: string | null
    storedName: string | null
    createdAt: Date | null
  }

  export type PluginCodingHomeworkSubmissionFileMaxAggregateOutputType = {
    id: string | null
    submissionId: string | null
    path: string | null
    languageKey: string | null
    sizeBytes: bigint | null
    sha256: string | null
    storedName: string | null
    createdAt: Date | null
  }

  export type PluginCodingHomeworkSubmissionFileCountAggregateOutputType = {
    id: number
    submissionId: number
    path: number
    languageKey: number
    sizeBytes: number
    sha256: number
    storedName: number
    metadata: number
    createdAt: number
    _all: number
  }


  export type PluginCodingHomeworkSubmissionFileAvgAggregateInputType = {
    sizeBytes?: true
  }

  export type PluginCodingHomeworkSubmissionFileSumAggregateInputType = {
    sizeBytes?: true
  }

  export type PluginCodingHomeworkSubmissionFileMinAggregateInputType = {
    id?: true
    submissionId?: true
    path?: true
    languageKey?: true
    sizeBytes?: true
    sha256?: true
    storedName?: true
    createdAt?: true
  }

  export type PluginCodingHomeworkSubmissionFileMaxAggregateInputType = {
    id?: true
    submissionId?: true
    path?: true
    languageKey?: true
    sizeBytes?: true
    sha256?: true
    storedName?: true
    createdAt?: true
  }

  export type PluginCodingHomeworkSubmissionFileCountAggregateInputType = {
    id?: true
    submissionId?: true
    path?: true
    languageKey?: true
    sizeBytes?: true
    sha256?: true
    storedName?: true
    metadata?: true
    createdAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkSubmissionFileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkSubmissionFile to aggregate.
     */
    where?: PluginCodingHomeworkSubmissionFileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionFiles to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionFileOrderByWithRelationInput | PluginCodingHomeworkSubmissionFileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionFiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionFiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkSubmissionFiles
    **/
    _count?: true | PluginCodingHomeworkSubmissionFileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PluginCodingHomeworkSubmissionFileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PluginCodingHomeworkSubmissionFileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkSubmissionFileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkSubmissionFileMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkSubmissionFileAggregateType<T extends PluginCodingHomeworkSubmissionFileAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkSubmissionFile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkSubmissionFile[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkSubmissionFile[P]>
  }




  export type PluginCodingHomeworkSubmissionFileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkSubmissionFileWhereInput
    orderBy?: PluginCodingHomeworkSubmissionFileOrderByWithAggregationInput | PluginCodingHomeworkSubmissionFileOrderByWithAggregationInput[]
    by: PluginCodingHomeworkSubmissionFileScalarFieldEnum[] | PluginCodingHomeworkSubmissionFileScalarFieldEnum
    having?: PluginCodingHomeworkSubmissionFileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkSubmissionFileCountAggregateInputType | true
    _avg?: PluginCodingHomeworkSubmissionFileAvgAggregateInputType
    _sum?: PluginCodingHomeworkSubmissionFileSumAggregateInputType
    _min?: PluginCodingHomeworkSubmissionFileMinAggregateInputType
    _max?: PluginCodingHomeworkSubmissionFileMaxAggregateInputType
  }

  export type PluginCodingHomeworkSubmissionFileGroupByOutputType = {
    id: string
    submissionId: string
    path: string
    languageKey: string | null
    sizeBytes: bigint
    sha256: string
    storedName: string
    metadata: JsonValue
    createdAt: Date
    _count: PluginCodingHomeworkSubmissionFileCountAggregateOutputType | null
    _avg: PluginCodingHomeworkSubmissionFileAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkSubmissionFileSumAggregateOutputType | null
    _min: PluginCodingHomeworkSubmissionFileMinAggregateOutputType | null
    _max: PluginCodingHomeworkSubmissionFileMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkSubmissionFileGroupByPayload<T extends PluginCodingHomeworkSubmissionFileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkSubmissionFileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkSubmissionFileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkSubmissionFileGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkSubmissionFileGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkSubmissionFileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    submissionId?: boolean
    path?: boolean
    languageKey?: boolean
    sizeBytes?: boolean
    sha256?: boolean
    storedName?: boolean
    metadata?: boolean
    createdAt?: boolean
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    functions?: boolean | PluginCodingHomeworkSubmissionFile$functionsArgs<ExtArgs>
    _count?: boolean | PluginCodingHomeworkSubmissionFileCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkSubmissionFile"]>

  export type PluginCodingHomeworkSubmissionFileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    submissionId?: boolean
    path?: boolean
    languageKey?: boolean
    sizeBytes?: boolean
    sha256?: boolean
    storedName?: boolean
    metadata?: boolean
    createdAt?: boolean
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkSubmissionFile"]>

  export type PluginCodingHomeworkSubmissionFileSelectScalar = {
    id?: boolean
    submissionId?: boolean
    path?: boolean
    languageKey?: boolean
    sizeBytes?: boolean
    sha256?: boolean
    storedName?: boolean
    metadata?: boolean
    createdAt?: boolean
  }

  export type PluginCodingHomeworkSubmissionFileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    functions?: boolean | PluginCodingHomeworkSubmissionFile$functionsArgs<ExtArgs>
    _count?: boolean | PluginCodingHomeworkSubmissionFileCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PluginCodingHomeworkSubmissionFileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
  }

  export type $PluginCodingHomeworkSubmissionFilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkSubmissionFile"
    objects: {
      submission: Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>
      functions: Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      submissionId: string
      path: string
      languageKey: string | null
      sizeBytes: bigint
      sha256: string
      storedName: string
      metadata: Prisma.JsonValue
      createdAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkSubmissionFile"]>
    composites: {}
  }

  type PluginCodingHomeworkSubmissionFileGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkSubmissionFileDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload, S>

  type PluginCodingHomeworkSubmissionFileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkSubmissionFileFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkSubmissionFileCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkSubmissionFileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkSubmissionFile'], meta: { name: 'PluginCodingHomeworkSubmissionFile' } }
    /**
     * Find zero or one PluginCodingHomeworkSubmissionFile that matches the filter.
     * @param {PluginCodingHomeworkSubmissionFileFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkSubmissionFile
     * @example
     * // Get one PluginCodingHomeworkSubmissionFile
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkSubmissionFileFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFileFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkSubmissionFile that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkSubmissionFileFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkSubmissionFile
     * @example
     * // Get one PluginCodingHomeworkSubmissionFile
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkSubmissionFileFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkSubmissionFile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFileFindFirstArgs} args - Arguments to find a PluginCodingHomeworkSubmissionFile
     * @example
     * // Get one PluginCodingHomeworkSubmissionFile
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkSubmissionFileFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFileFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkSubmissionFile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFileFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkSubmissionFile
     * @example
     * // Get one PluginCodingHomeworkSubmissionFile
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkSubmissionFileFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFileFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkSubmissionFiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkSubmissionFiles
     * const pluginCodingHomeworkSubmissionFiles = await prisma.pluginCodingHomeworkSubmissionFile.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkSubmissionFiles
     * const pluginCodingHomeworkSubmissionFiles = await prisma.pluginCodingHomeworkSubmissionFile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkSubmissionFileWithIdOnly = await prisma.pluginCodingHomeworkSubmissionFile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkSubmissionFileFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkSubmissionFile.
     * @param {PluginCodingHomeworkSubmissionFileCreateArgs} args - Arguments to create a PluginCodingHomeworkSubmissionFile.
     * @example
     * // Create one PluginCodingHomeworkSubmissionFile
     * const PluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkSubmissionFile
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkSubmissionFileCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFileCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkSubmissionFiles.
     * @param {PluginCodingHomeworkSubmissionFileCreateManyArgs} args - Arguments to create many PluginCodingHomeworkSubmissionFiles.
     * @example
     * // Create many PluginCodingHomeworkSubmissionFiles
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkSubmissionFileCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkSubmissionFiles and returns the data saved in the database.
     * @param {PluginCodingHomeworkSubmissionFileCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkSubmissionFiles.
     * @example
     * // Create many PluginCodingHomeworkSubmissionFiles
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkSubmissionFiles and only return the `id`
     * const pluginCodingHomeworkSubmissionFileWithIdOnly = await prisma.pluginCodingHomeworkSubmissionFile.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkSubmissionFileCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkSubmissionFile.
     * @param {PluginCodingHomeworkSubmissionFileDeleteArgs} args - Arguments to delete one PluginCodingHomeworkSubmissionFile.
     * @example
     * // Delete one PluginCodingHomeworkSubmissionFile
     * const PluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkSubmissionFile
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkSubmissionFileDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFileDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkSubmissionFile.
     * @param {PluginCodingHomeworkSubmissionFileUpdateArgs} args - Arguments to update one PluginCodingHomeworkSubmissionFile.
     * @example
     * // Update one PluginCodingHomeworkSubmissionFile
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkSubmissionFileUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFileUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkSubmissionFiles.
     * @param {PluginCodingHomeworkSubmissionFileDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkSubmissionFiles to delete.
     * @example
     * // Delete a few PluginCodingHomeworkSubmissionFiles
     * const { count } = await prisma.pluginCodingHomeworkSubmissionFile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkSubmissionFileDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkSubmissionFiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkSubmissionFiles
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkSubmissionFileUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkSubmissionFile.
     * @param {PluginCodingHomeworkSubmissionFileUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkSubmissionFile.
     * @example
     * // Update or create a PluginCodingHomeworkSubmissionFile
     * const pluginCodingHomeworkSubmissionFile = await prisma.pluginCodingHomeworkSubmissionFile.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkSubmissionFile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkSubmissionFile we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkSubmissionFileUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFileUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkSubmissionFiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFileCountArgs} args - Arguments to filter PluginCodingHomeworkSubmissionFiles to count.
     * @example
     * // Count the number of PluginCodingHomeworkSubmissionFiles
     * const count = await prisma.pluginCodingHomeworkSubmissionFile.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkSubmissionFiles we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkSubmissionFileCountArgs>(
      args?: Subset<T, PluginCodingHomeworkSubmissionFileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkSubmissionFileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkSubmissionFile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkSubmissionFileAggregateArgs>(args: Subset<T, PluginCodingHomeworkSubmissionFileAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkSubmissionFileAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkSubmissionFile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkSubmissionFileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkSubmissionFileGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkSubmissionFileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkSubmissionFileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkSubmissionFileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkSubmissionFile model
   */
  readonly fields: PluginCodingHomeworkSubmissionFileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkSubmissionFile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkSubmissionFileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    submission<T extends PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    functions<T extends PluginCodingHomeworkSubmissionFile$functionsArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmissionFile$functionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkSubmissionFile model
   */ 
  interface PluginCodingHomeworkSubmissionFileFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkSubmissionFile", 'String'>
    readonly submissionId: FieldRef<"PluginCodingHomeworkSubmissionFile", 'String'>
    readonly path: FieldRef<"PluginCodingHomeworkSubmissionFile", 'String'>
    readonly languageKey: FieldRef<"PluginCodingHomeworkSubmissionFile", 'String'>
    readonly sizeBytes: FieldRef<"PluginCodingHomeworkSubmissionFile", 'BigInt'>
    readonly sha256: FieldRef<"PluginCodingHomeworkSubmissionFile", 'String'>
    readonly storedName: FieldRef<"PluginCodingHomeworkSubmissionFile", 'String'>
    readonly metadata: FieldRef<"PluginCodingHomeworkSubmissionFile", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkSubmissionFile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkSubmissionFile findUnique
   */
  export type PluginCodingHomeworkSubmissionFileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFile to fetch.
     */
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionFile findUniqueOrThrow
   */
  export type PluginCodingHomeworkSubmissionFileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFile to fetch.
     */
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionFile findFirst
   */
  export type PluginCodingHomeworkSubmissionFileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFile to fetch.
     */
    where?: PluginCodingHomeworkSubmissionFileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionFiles to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionFileOrderByWithRelationInput | PluginCodingHomeworkSubmissionFileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkSubmissionFiles.
     */
    cursor?: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionFiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionFiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkSubmissionFiles.
     */
    distinct?: PluginCodingHomeworkSubmissionFileScalarFieldEnum | PluginCodingHomeworkSubmissionFileScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionFile findFirstOrThrow
   */
  export type PluginCodingHomeworkSubmissionFileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFile to fetch.
     */
    where?: PluginCodingHomeworkSubmissionFileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionFiles to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionFileOrderByWithRelationInput | PluginCodingHomeworkSubmissionFileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkSubmissionFiles.
     */
    cursor?: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionFiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionFiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkSubmissionFiles.
     */
    distinct?: PluginCodingHomeworkSubmissionFileScalarFieldEnum | PluginCodingHomeworkSubmissionFileScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionFile findMany
   */
  export type PluginCodingHomeworkSubmissionFileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFiles to fetch.
     */
    where?: PluginCodingHomeworkSubmissionFileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionFiles to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionFileOrderByWithRelationInput | PluginCodingHomeworkSubmissionFileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkSubmissionFiles.
     */
    cursor?: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionFiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionFiles.
     */
    skip?: number
    distinct?: PluginCodingHomeworkSubmissionFileScalarFieldEnum | PluginCodingHomeworkSubmissionFileScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionFile create
   */
  export type PluginCodingHomeworkSubmissionFileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkSubmissionFile.
     */
    data: XOR<PluginCodingHomeworkSubmissionFileCreateInput, PluginCodingHomeworkSubmissionFileUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkSubmissionFile createMany
   */
  export type PluginCodingHomeworkSubmissionFileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkSubmissionFiles.
     */
    data: PluginCodingHomeworkSubmissionFileCreateManyInput | PluginCodingHomeworkSubmissionFileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkSubmissionFile createManyAndReturn
   */
  export type PluginCodingHomeworkSubmissionFileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkSubmissionFiles.
     */
    data: PluginCodingHomeworkSubmissionFileCreateManyInput | PluginCodingHomeworkSubmissionFileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkSubmissionFile update
   */
  export type PluginCodingHomeworkSubmissionFileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkSubmissionFile.
     */
    data: XOR<PluginCodingHomeworkSubmissionFileUpdateInput, PluginCodingHomeworkSubmissionFileUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkSubmissionFile to update.
     */
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionFile updateMany
   */
  export type PluginCodingHomeworkSubmissionFileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkSubmissionFiles.
     */
    data: XOR<PluginCodingHomeworkSubmissionFileUpdateManyMutationInput, PluginCodingHomeworkSubmissionFileUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkSubmissionFiles to update
     */
    where?: PluginCodingHomeworkSubmissionFileWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionFile upsert
   */
  export type PluginCodingHomeworkSubmissionFileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkSubmissionFile to update in case it exists.
     */
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkSubmissionFile found by the `where` argument doesn't exist, create a new PluginCodingHomeworkSubmissionFile with this data.
     */
    create: XOR<PluginCodingHomeworkSubmissionFileCreateInput, PluginCodingHomeworkSubmissionFileUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkSubmissionFile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkSubmissionFileUpdateInput, PluginCodingHomeworkSubmissionFileUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkSubmissionFile delete
   */
  export type PluginCodingHomeworkSubmissionFileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkSubmissionFile to delete.
     */
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionFile deleteMany
   */
  export type PluginCodingHomeworkSubmissionFileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkSubmissionFiles to delete
     */
    where?: PluginCodingHomeworkSubmissionFileWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionFile.functions
   */
  export type PluginCodingHomeworkSubmissionFile$functionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
    orderBy?: PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput | PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput[]
    cursor?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PluginCodingHomeworkSubmissionFunctionScalarFieldEnum | PluginCodingHomeworkSubmissionFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionFile without action
   */
  export type PluginCodingHomeworkSubmissionFileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFile
     */
    select?: PluginCodingHomeworkSubmissionFileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFileInclude<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkSubmissionFunction
   */

  export type AggregatePluginCodingHomeworkSubmissionFunction = {
    _count: PluginCodingHomeworkSubmissionFunctionCountAggregateOutputType | null
    _avg: PluginCodingHomeworkSubmissionFunctionAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkSubmissionFunctionSumAggregateOutputType | null
    _min: PluginCodingHomeworkSubmissionFunctionMinAggregateOutputType | null
    _max: PluginCodingHomeworkSubmissionFunctionMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkSubmissionFunctionAvgAggregateOutputType = {
    divergenceScore: number | null
  }

  export type PluginCodingHomeworkSubmissionFunctionSumAggregateOutputType = {
    divergenceScore: number | null
  }

  export type PluginCodingHomeworkSubmissionFunctionMinAggregateOutputType = {
    id: string | null
    submissionId: string | null
    fileId: string | null
    functionName: string | null
    functionCode: string | null
    astText: string | null
    divergenceScore: number | null
    selectedForQuestion: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkSubmissionFunctionMaxAggregateOutputType = {
    id: string | null
    submissionId: string | null
    fileId: string | null
    functionName: string | null
    functionCode: string | null
    astText: string | null
    divergenceScore: number | null
    selectedForQuestion: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkSubmissionFunctionCountAggregateOutputType = {
    id: number
    submissionId: number
    fileId: number
    functionName: number
    functionCode: number
    astText: number
    embedding: number
    nearestExamples: number
    divergenceScore: number
    selectedForQuestion: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkSubmissionFunctionAvgAggregateInputType = {
    divergenceScore?: true
  }

  export type PluginCodingHomeworkSubmissionFunctionSumAggregateInputType = {
    divergenceScore?: true
  }

  export type PluginCodingHomeworkSubmissionFunctionMinAggregateInputType = {
    id?: true
    submissionId?: true
    fileId?: true
    functionName?: true
    functionCode?: true
    astText?: true
    divergenceScore?: true
    selectedForQuestion?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkSubmissionFunctionMaxAggregateInputType = {
    id?: true
    submissionId?: true
    fileId?: true
    functionName?: true
    functionCode?: true
    astText?: true
    divergenceScore?: true
    selectedForQuestion?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkSubmissionFunctionCountAggregateInputType = {
    id?: true
    submissionId?: true
    fileId?: true
    functionName?: true
    functionCode?: true
    astText?: true
    embedding?: true
    nearestExamples?: true
    divergenceScore?: true
    selectedForQuestion?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkSubmissionFunctionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkSubmissionFunction to aggregate.
     */
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionFunctions to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput | PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionFunctions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionFunctions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkSubmissionFunctions
    **/
    _count?: true | PluginCodingHomeworkSubmissionFunctionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PluginCodingHomeworkSubmissionFunctionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PluginCodingHomeworkSubmissionFunctionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkSubmissionFunctionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkSubmissionFunctionMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkSubmissionFunctionAggregateType<T extends PluginCodingHomeworkSubmissionFunctionAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkSubmissionFunction]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkSubmissionFunction[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkSubmissionFunction[P]>
  }




  export type PluginCodingHomeworkSubmissionFunctionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
    orderBy?: PluginCodingHomeworkSubmissionFunctionOrderByWithAggregationInput | PluginCodingHomeworkSubmissionFunctionOrderByWithAggregationInput[]
    by: PluginCodingHomeworkSubmissionFunctionScalarFieldEnum[] | PluginCodingHomeworkSubmissionFunctionScalarFieldEnum
    having?: PluginCodingHomeworkSubmissionFunctionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkSubmissionFunctionCountAggregateInputType | true
    _avg?: PluginCodingHomeworkSubmissionFunctionAvgAggregateInputType
    _sum?: PluginCodingHomeworkSubmissionFunctionSumAggregateInputType
    _min?: PluginCodingHomeworkSubmissionFunctionMinAggregateInputType
    _max?: PluginCodingHomeworkSubmissionFunctionMaxAggregateInputType
  }

  export type PluginCodingHomeworkSubmissionFunctionGroupByOutputType = {
    id: string
    submissionId: string
    fileId: string
    functionName: string
    functionCode: string
    astText: string
    embedding: JsonValue
    nearestExamples: JsonValue
    divergenceScore: number | null
    selectedForQuestion: boolean
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkSubmissionFunctionCountAggregateOutputType | null
    _avg: PluginCodingHomeworkSubmissionFunctionAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkSubmissionFunctionSumAggregateOutputType | null
    _min: PluginCodingHomeworkSubmissionFunctionMinAggregateOutputType | null
    _max: PluginCodingHomeworkSubmissionFunctionMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkSubmissionFunctionGroupByPayload<T extends PluginCodingHomeworkSubmissionFunctionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkSubmissionFunctionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkSubmissionFunctionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkSubmissionFunctionGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkSubmissionFunctionGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    submissionId?: boolean
    fileId?: boolean
    functionName?: boolean
    functionCode?: boolean
    astText?: boolean
    embedding?: boolean
    nearestExamples?: boolean
    divergenceScore?: boolean
    selectedForQuestion?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    file?: boolean | PluginCodingHomeworkSubmissionFileDefaultArgs<ExtArgs>
    questions?: boolean | PluginCodingHomeworkSubmissionFunction$questionsArgs<ExtArgs>
    _count?: boolean | PluginCodingHomeworkSubmissionFunctionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkSubmissionFunction"]>

  export type PluginCodingHomeworkSubmissionFunctionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    submissionId?: boolean
    fileId?: boolean
    functionName?: boolean
    functionCode?: boolean
    astText?: boolean
    embedding?: boolean
    nearestExamples?: boolean
    divergenceScore?: boolean
    selectedForQuestion?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    file?: boolean | PluginCodingHomeworkSubmissionFileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkSubmissionFunction"]>

  export type PluginCodingHomeworkSubmissionFunctionSelectScalar = {
    id?: boolean
    submissionId?: boolean
    fileId?: boolean
    functionName?: boolean
    functionCode?: boolean
    astText?: boolean
    embedding?: boolean
    nearestExamples?: boolean
    divergenceScore?: boolean
    selectedForQuestion?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    file?: boolean | PluginCodingHomeworkSubmissionFileDefaultArgs<ExtArgs>
    questions?: boolean | PluginCodingHomeworkSubmissionFunction$questionsArgs<ExtArgs>
    _count?: boolean | PluginCodingHomeworkSubmissionFunctionCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PluginCodingHomeworkSubmissionFunctionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    file?: boolean | PluginCodingHomeworkSubmissionFileDefaultArgs<ExtArgs>
  }

  export type $PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkSubmissionFunction"
    objects: {
      submission: Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>
      file: Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>
      questions: Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      submissionId: string
      fileId: string
      functionName: string
      functionCode: string
      astText: string
      embedding: Prisma.JsonValue
      nearestExamples: Prisma.JsonValue
      divergenceScore: number | null
      selectedForQuestion: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkSubmissionFunction"]>
    composites: {}
  }

  type PluginCodingHomeworkSubmissionFunctionGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkSubmissionFunctionDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload, S>

  type PluginCodingHomeworkSubmissionFunctionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkSubmissionFunctionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkSubmissionFunctionCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkSubmissionFunctionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkSubmissionFunction'], meta: { name: 'PluginCodingHomeworkSubmissionFunction' } }
    /**
     * Find zero or one PluginCodingHomeworkSubmissionFunction that matches the filter.
     * @param {PluginCodingHomeworkSubmissionFunctionFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkSubmissionFunction
     * @example
     * // Get one PluginCodingHomeworkSubmissionFunction
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkSubmissionFunctionFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkSubmissionFunction that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkSubmissionFunctionFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkSubmissionFunction
     * @example
     * // Get one PluginCodingHomeworkSubmissionFunction
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkSubmissionFunctionFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkSubmissionFunction that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFunctionFindFirstArgs} args - Arguments to find a PluginCodingHomeworkSubmissionFunction
     * @example
     * // Get one PluginCodingHomeworkSubmissionFunction
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkSubmissionFunctionFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkSubmissionFunction that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFunctionFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkSubmissionFunction
     * @example
     * // Get one PluginCodingHomeworkSubmissionFunction
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkSubmissionFunctionFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkSubmissionFunctions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFunctionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkSubmissionFunctions
     * const pluginCodingHomeworkSubmissionFunctions = await prisma.pluginCodingHomeworkSubmissionFunction.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkSubmissionFunctions
     * const pluginCodingHomeworkSubmissionFunctions = await prisma.pluginCodingHomeworkSubmissionFunction.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkSubmissionFunctionWithIdOnly = await prisma.pluginCodingHomeworkSubmissionFunction.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkSubmissionFunctionFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkSubmissionFunction.
     * @param {PluginCodingHomeworkSubmissionFunctionCreateArgs} args - Arguments to create a PluginCodingHomeworkSubmissionFunction.
     * @example
     * // Create one PluginCodingHomeworkSubmissionFunction
     * const PluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkSubmissionFunction
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkSubmissionFunctionCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkSubmissionFunctions.
     * @param {PluginCodingHomeworkSubmissionFunctionCreateManyArgs} args - Arguments to create many PluginCodingHomeworkSubmissionFunctions.
     * @example
     * // Create many PluginCodingHomeworkSubmissionFunctions
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkSubmissionFunctionCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkSubmissionFunctions and returns the data saved in the database.
     * @param {PluginCodingHomeworkSubmissionFunctionCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkSubmissionFunctions.
     * @example
     * // Create many PluginCodingHomeworkSubmissionFunctions
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkSubmissionFunctions and only return the `id`
     * const pluginCodingHomeworkSubmissionFunctionWithIdOnly = await prisma.pluginCodingHomeworkSubmissionFunction.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkSubmissionFunctionCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkSubmissionFunction.
     * @param {PluginCodingHomeworkSubmissionFunctionDeleteArgs} args - Arguments to delete one PluginCodingHomeworkSubmissionFunction.
     * @example
     * // Delete one PluginCodingHomeworkSubmissionFunction
     * const PluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkSubmissionFunction
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkSubmissionFunctionDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkSubmissionFunction.
     * @param {PluginCodingHomeworkSubmissionFunctionUpdateArgs} args - Arguments to update one PluginCodingHomeworkSubmissionFunction.
     * @example
     * // Update one PluginCodingHomeworkSubmissionFunction
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkSubmissionFunctionUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkSubmissionFunctions.
     * @param {PluginCodingHomeworkSubmissionFunctionDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkSubmissionFunctions to delete.
     * @example
     * // Delete a few PluginCodingHomeworkSubmissionFunctions
     * const { count } = await prisma.pluginCodingHomeworkSubmissionFunction.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkSubmissionFunctionDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkSubmissionFunctions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFunctionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkSubmissionFunctions
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkSubmissionFunctionUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkSubmissionFunction.
     * @param {PluginCodingHomeworkSubmissionFunctionUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkSubmissionFunction.
     * @example
     * // Update or create a PluginCodingHomeworkSubmissionFunction
     * const pluginCodingHomeworkSubmissionFunction = await prisma.pluginCodingHomeworkSubmissionFunction.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkSubmissionFunction
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkSubmissionFunction we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkSubmissionFunctionUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkSubmissionFunctionUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkSubmissionFunctions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFunctionCountArgs} args - Arguments to filter PluginCodingHomeworkSubmissionFunctions to count.
     * @example
     * // Count the number of PluginCodingHomeworkSubmissionFunctions
     * const count = await prisma.pluginCodingHomeworkSubmissionFunction.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkSubmissionFunctions we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkSubmissionFunctionCountArgs>(
      args?: Subset<T, PluginCodingHomeworkSubmissionFunctionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkSubmissionFunctionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkSubmissionFunction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFunctionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkSubmissionFunctionAggregateArgs>(args: Subset<T, PluginCodingHomeworkSubmissionFunctionAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkSubmissionFunctionAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkSubmissionFunction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkSubmissionFunctionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkSubmissionFunctionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkSubmissionFunctionGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkSubmissionFunctionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkSubmissionFunctionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkSubmissionFunctionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkSubmissionFunction model
   */
  readonly fields: PluginCodingHomeworkSubmissionFunctionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkSubmissionFunction.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkSubmissionFunctionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    submission<T extends PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    file<T extends PluginCodingHomeworkSubmissionFileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmissionFileDefaultArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFileClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFilePayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    questions<T extends PluginCodingHomeworkSubmissionFunction$questionsArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmissionFunction$questionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkSubmissionFunction model
   */ 
  interface PluginCodingHomeworkSubmissionFunctionFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'String'>
    readonly submissionId: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'String'>
    readonly fileId: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'String'>
    readonly functionName: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'String'>
    readonly functionCode: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'String'>
    readonly astText: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'String'>
    readonly embedding: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'Json'>
    readonly nearestExamples: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'Json'>
    readonly divergenceScore: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'Float'>
    readonly selectedForQuestion: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'Boolean'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkSubmissionFunction", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkSubmissionFunction findUnique
   */
  export type PluginCodingHomeworkSubmissionFunctionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFunction to fetch.
     */
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionFunction findUniqueOrThrow
   */
  export type PluginCodingHomeworkSubmissionFunctionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFunction to fetch.
     */
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionFunction findFirst
   */
  export type PluginCodingHomeworkSubmissionFunctionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFunction to fetch.
     */
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionFunctions to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput | PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkSubmissionFunctions.
     */
    cursor?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionFunctions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionFunctions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkSubmissionFunctions.
     */
    distinct?: PluginCodingHomeworkSubmissionFunctionScalarFieldEnum | PluginCodingHomeworkSubmissionFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionFunction findFirstOrThrow
   */
  export type PluginCodingHomeworkSubmissionFunctionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFunction to fetch.
     */
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionFunctions to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput | PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkSubmissionFunctions.
     */
    cursor?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionFunctions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionFunctions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkSubmissionFunctions.
     */
    distinct?: PluginCodingHomeworkSubmissionFunctionScalarFieldEnum | PluginCodingHomeworkSubmissionFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionFunction findMany
   */
  export type PluginCodingHomeworkSubmissionFunctionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkSubmissionFunctions to fetch.
     */
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkSubmissionFunctions to fetch.
     */
    orderBy?: PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput | PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkSubmissionFunctions.
     */
    cursor?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkSubmissionFunctions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkSubmissionFunctions.
     */
    skip?: number
    distinct?: PluginCodingHomeworkSubmissionFunctionScalarFieldEnum | PluginCodingHomeworkSubmissionFunctionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionFunction create
   */
  export type PluginCodingHomeworkSubmissionFunctionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkSubmissionFunction.
     */
    data: XOR<PluginCodingHomeworkSubmissionFunctionCreateInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkSubmissionFunction createMany
   */
  export type PluginCodingHomeworkSubmissionFunctionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkSubmissionFunctions.
     */
    data: PluginCodingHomeworkSubmissionFunctionCreateManyInput | PluginCodingHomeworkSubmissionFunctionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkSubmissionFunction createManyAndReturn
   */
  export type PluginCodingHomeworkSubmissionFunctionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkSubmissionFunctions.
     */
    data: PluginCodingHomeworkSubmissionFunctionCreateManyInput | PluginCodingHomeworkSubmissionFunctionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkSubmissionFunction update
   */
  export type PluginCodingHomeworkSubmissionFunctionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkSubmissionFunction.
     */
    data: XOR<PluginCodingHomeworkSubmissionFunctionUpdateInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkSubmissionFunction to update.
     */
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionFunction updateMany
   */
  export type PluginCodingHomeworkSubmissionFunctionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkSubmissionFunctions.
     */
    data: XOR<PluginCodingHomeworkSubmissionFunctionUpdateManyMutationInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkSubmissionFunctions to update
     */
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionFunction upsert
   */
  export type PluginCodingHomeworkSubmissionFunctionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkSubmissionFunction to update in case it exists.
     */
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkSubmissionFunction found by the `where` argument doesn't exist, create a new PluginCodingHomeworkSubmissionFunction with this data.
     */
    create: XOR<PluginCodingHomeworkSubmissionFunctionCreateInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkSubmissionFunction was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkSubmissionFunctionUpdateInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkSubmissionFunction delete
   */
  export type PluginCodingHomeworkSubmissionFunctionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkSubmissionFunction to delete.
     */
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkSubmissionFunction deleteMany
   */
  export type PluginCodingHomeworkSubmissionFunctionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkSubmissionFunctions to delete
     */
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
  }

  /**
   * PluginCodingHomeworkSubmissionFunction.questions
   */
  export type PluginCodingHomeworkSubmissionFunction$questionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
    orderBy?: PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput | PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput[]
    cursor?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PluginCodingHomeworkChallengeQuestionScalarFieldEnum | PluginCodingHomeworkChallengeQuestionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkSubmissionFunction without action
   */
  export type PluginCodingHomeworkSubmissionFunctionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkChallengeQuestion
   */

  export type AggregatePluginCodingHomeworkChallengeQuestion = {
    _count: PluginCodingHomeworkChallengeQuestionCountAggregateOutputType | null
    _avg: PluginCodingHomeworkChallengeQuestionAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkChallengeQuestionSumAggregateOutputType | null
    _min: PluginCodingHomeworkChallengeQuestionMinAggregateOutputType | null
    _max: PluginCodingHomeworkChallengeQuestionMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkChallengeQuestionAvgAggregateOutputType = {
    orderIndex: number | null
  }

  export type PluginCodingHomeworkChallengeQuestionSumAggregateOutputType = {
    orderIndex: number | null
  }

  export type PluginCodingHomeworkChallengeQuestionMinAggregateOutputType = {
    id: string | null
    submissionId: string | null
    submissionFunctionId: string | null
    orderIndex: number | null
    questionText: string | null
    studentAnswer: string | null
    answerSubmittedAt: Date | null
    generationModel: string | null
    generationPromptVersion: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkChallengeQuestionMaxAggregateOutputType = {
    id: string | null
    submissionId: string | null
    submissionFunctionId: string | null
    orderIndex: number | null
    questionText: string | null
    studentAnswer: string | null
    answerSubmittedAt: Date | null
    generationModel: string | null
    generationPromptVersion: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkChallengeQuestionCountAggregateOutputType = {
    id: number
    submissionId: number
    submissionFunctionId: number
    orderIndex: number
    questionText: number
    studentAnswer: number
    answerSubmittedAt: number
    generationModel: number
    generationPromptVersion: number
    nearestExamples: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkChallengeQuestionAvgAggregateInputType = {
    orderIndex?: true
  }

  export type PluginCodingHomeworkChallengeQuestionSumAggregateInputType = {
    orderIndex?: true
  }

  export type PluginCodingHomeworkChallengeQuestionMinAggregateInputType = {
    id?: true
    submissionId?: true
    submissionFunctionId?: true
    orderIndex?: true
    questionText?: true
    studentAnswer?: true
    answerSubmittedAt?: true
    generationModel?: true
    generationPromptVersion?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkChallengeQuestionMaxAggregateInputType = {
    id?: true
    submissionId?: true
    submissionFunctionId?: true
    orderIndex?: true
    questionText?: true
    studentAnswer?: true
    answerSubmittedAt?: true
    generationModel?: true
    generationPromptVersion?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkChallengeQuestionCountAggregateInputType = {
    id?: true
    submissionId?: true
    submissionFunctionId?: true
    orderIndex?: true
    questionText?: true
    studentAnswer?: true
    answerSubmittedAt?: true
    generationModel?: true
    generationPromptVersion?: true
    nearestExamples?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkChallengeQuestionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkChallengeQuestion to aggregate.
     */
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkChallengeQuestions to fetch.
     */
    orderBy?: PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput | PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkChallengeQuestions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkChallengeQuestions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkChallengeQuestions
    **/
    _count?: true | PluginCodingHomeworkChallengeQuestionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PluginCodingHomeworkChallengeQuestionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PluginCodingHomeworkChallengeQuestionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkChallengeQuestionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkChallengeQuestionMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkChallengeQuestionAggregateType<T extends PluginCodingHomeworkChallengeQuestionAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkChallengeQuestion]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkChallengeQuestion[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkChallengeQuestion[P]>
  }




  export type PluginCodingHomeworkChallengeQuestionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
    orderBy?: PluginCodingHomeworkChallengeQuestionOrderByWithAggregationInput | PluginCodingHomeworkChallengeQuestionOrderByWithAggregationInput[]
    by: PluginCodingHomeworkChallengeQuestionScalarFieldEnum[] | PluginCodingHomeworkChallengeQuestionScalarFieldEnum
    having?: PluginCodingHomeworkChallengeQuestionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkChallengeQuestionCountAggregateInputType | true
    _avg?: PluginCodingHomeworkChallengeQuestionAvgAggregateInputType
    _sum?: PluginCodingHomeworkChallengeQuestionSumAggregateInputType
    _min?: PluginCodingHomeworkChallengeQuestionMinAggregateInputType
    _max?: PluginCodingHomeworkChallengeQuestionMaxAggregateInputType
  }

  export type PluginCodingHomeworkChallengeQuestionGroupByOutputType = {
    id: string
    submissionId: string
    submissionFunctionId: string | null
    orderIndex: number
    questionText: string
    studentAnswer: string | null
    answerSubmittedAt: Date | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples: JsonValue
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkChallengeQuestionCountAggregateOutputType | null
    _avg: PluginCodingHomeworkChallengeQuestionAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkChallengeQuestionSumAggregateOutputType | null
    _min: PluginCodingHomeworkChallengeQuestionMinAggregateOutputType | null
    _max: PluginCodingHomeworkChallengeQuestionMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkChallengeQuestionGroupByPayload<T extends PluginCodingHomeworkChallengeQuestionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkChallengeQuestionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkChallengeQuestionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkChallengeQuestionGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkChallengeQuestionGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkChallengeQuestionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    submissionId?: boolean
    submissionFunctionId?: boolean
    orderIndex?: boolean
    questionText?: boolean
    studentAnswer?: boolean
    answerSubmittedAt?: boolean
    generationModel?: boolean
    generationPromptVersion?: boolean
    nearestExamples?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    submissionFunction?: boolean | PluginCodingHomeworkChallengeQuestion$submissionFunctionArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkChallengeQuestion"]>

  export type PluginCodingHomeworkChallengeQuestionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    submissionId?: boolean
    submissionFunctionId?: boolean
    orderIndex?: boolean
    questionText?: boolean
    studentAnswer?: boolean
    answerSubmittedAt?: boolean
    generationModel?: boolean
    generationPromptVersion?: boolean
    nearestExamples?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    submissionFunction?: boolean | PluginCodingHomeworkChallengeQuestion$submissionFunctionArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkChallengeQuestion"]>

  export type PluginCodingHomeworkChallengeQuestionSelectScalar = {
    id?: boolean
    submissionId?: boolean
    submissionFunctionId?: boolean
    orderIndex?: boolean
    questionText?: boolean
    studentAnswer?: boolean
    answerSubmittedAt?: boolean
    generationModel?: boolean
    generationPromptVersion?: boolean
    nearestExamples?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PluginCodingHomeworkChallengeQuestionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    submissionFunction?: boolean | PluginCodingHomeworkChallengeQuestion$submissionFunctionArgs<ExtArgs>
  }
  export type PluginCodingHomeworkChallengeQuestionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    submissionFunction?: boolean | PluginCodingHomeworkChallengeQuestion$submissionFunctionArgs<ExtArgs>
  }

  export type $PluginCodingHomeworkChallengeQuestionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkChallengeQuestion"
    objects: {
      submission: Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>
      submissionFunction: Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      submissionId: string
      submissionFunctionId: string | null
      orderIndex: number
      questionText: string
      studentAnswer: string | null
      answerSubmittedAt: Date | null
      generationModel: string
      generationPromptVersion: string
      nearestExamples: Prisma.JsonValue
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkChallengeQuestion"]>
    composites: {}
  }

  type PluginCodingHomeworkChallengeQuestionGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkChallengeQuestionDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload, S>

  type PluginCodingHomeworkChallengeQuestionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkChallengeQuestionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkChallengeQuestionCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkChallengeQuestionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkChallengeQuestion'], meta: { name: 'PluginCodingHomeworkChallengeQuestion' } }
    /**
     * Find zero or one PluginCodingHomeworkChallengeQuestion that matches the filter.
     * @param {PluginCodingHomeworkChallengeQuestionFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkChallengeQuestion
     * @example
     * // Get one PluginCodingHomeworkChallengeQuestion
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkChallengeQuestionFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkChallengeQuestionFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkChallengeQuestionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkChallengeQuestion that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkChallengeQuestionFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkChallengeQuestion
     * @example
     * // Get one PluginCodingHomeworkChallengeQuestion
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkChallengeQuestionFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkChallengeQuestionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkChallengeQuestionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkChallengeQuestion that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkChallengeQuestionFindFirstArgs} args - Arguments to find a PluginCodingHomeworkChallengeQuestion
     * @example
     * // Get one PluginCodingHomeworkChallengeQuestion
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkChallengeQuestionFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkChallengeQuestionFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkChallengeQuestionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkChallengeQuestion that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkChallengeQuestionFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkChallengeQuestion
     * @example
     * // Get one PluginCodingHomeworkChallengeQuestion
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkChallengeQuestionFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkChallengeQuestionFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkChallengeQuestionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkChallengeQuestions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkChallengeQuestionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkChallengeQuestions
     * const pluginCodingHomeworkChallengeQuestions = await prisma.pluginCodingHomeworkChallengeQuestion.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkChallengeQuestions
     * const pluginCodingHomeworkChallengeQuestions = await prisma.pluginCodingHomeworkChallengeQuestion.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkChallengeQuestionWithIdOnly = await prisma.pluginCodingHomeworkChallengeQuestion.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkChallengeQuestionFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkChallengeQuestionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkChallengeQuestion.
     * @param {PluginCodingHomeworkChallengeQuestionCreateArgs} args - Arguments to create a PluginCodingHomeworkChallengeQuestion.
     * @example
     * // Create one PluginCodingHomeworkChallengeQuestion
     * const PluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkChallengeQuestion
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkChallengeQuestionCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkChallengeQuestionCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkChallengeQuestionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkChallengeQuestions.
     * @param {PluginCodingHomeworkChallengeQuestionCreateManyArgs} args - Arguments to create many PluginCodingHomeworkChallengeQuestions.
     * @example
     * // Create many PluginCodingHomeworkChallengeQuestions
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkChallengeQuestionCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkChallengeQuestionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkChallengeQuestions and returns the data saved in the database.
     * @param {PluginCodingHomeworkChallengeQuestionCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkChallengeQuestions.
     * @example
     * // Create many PluginCodingHomeworkChallengeQuestions
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkChallengeQuestions and only return the `id`
     * const pluginCodingHomeworkChallengeQuestionWithIdOnly = await prisma.pluginCodingHomeworkChallengeQuestion.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkChallengeQuestionCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkChallengeQuestionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkChallengeQuestion.
     * @param {PluginCodingHomeworkChallengeQuestionDeleteArgs} args - Arguments to delete one PluginCodingHomeworkChallengeQuestion.
     * @example
     * // Delete one PluginCodingHomeworkChallengeQuestion
     * const PluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkChallengeQuestion
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkChallengeQuestionDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkChallengeQuestionDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkChallengeQuestionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkChallengeQuestion.
     * @param {PluginCodingHomeworkChallengeQuestionUpdateArgs} args - Arguments to update one PluginCodingHomeworkChallengeQuestion.
     * @example
     * // Update one PluginCodingHomeworkChallengeQuestion
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkChallengeQuestionUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkChallengeQuestionUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkChallengeQuestionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkChallengeQuestions.
     * @param {PluginCodingHomeworkChallengeQuestionDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkChallengeQuestions to delete.
     * @example
     * // Delete a few PluginCodingHomeworkChallengeQuestions
     * const { count } = await prisma.pluginCodingHomeworkChallengeQuestion.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkChallengeQuestionDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkChallengeQuestionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkChallengeQuestions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkChallengeQuestionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkChallengeQuestions
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkChallengeQuestionUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkChallengeQuestionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkChallengeQuestion.
     * @param {PluginCodingHomeworkChallengeQuestionUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkChallengeQuestion.
     * @example
     * // Update or create a PluginCodingHomeworkChallengeQuestion
     * const pluginCodingHomeworkChallengeQuestion = await prisma.pluginCodingHomeworkChallengeQuestion.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkChallengeQuestion
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkChallengeQuestion we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkChallengeQuestionUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkChallengeQuestionUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkChallengeQuestionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkChallengeQuestionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkChallengeQuestions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkChallengeQuestionCountArgs} args - Arguments to filter PluginCodingHomeworkChallengeQuestions to count.
     * @example
     * // Count the number of PluginCodingHomeworkChallengeQuestions
     * const count = await prisma.pluginCodingHomeworkChallengeQuestion.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkChallengeQuestions we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkChallengeQuestionCountArgs>(
      args?: Subset<T, PluginCodingHomeworkChallengeQuestionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkChallengeQuestionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkChallengeQuestion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkChallengeQuestionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkChallengeQuestionAggregateArgs>(args: Subset<T, PluginCodingHomeworkChallengeQuestionAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkChallengeQuestionAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkChallengeQuestion.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkChallengeQuestionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkChallengeQuestionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkChallengeQuestionGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkChallengeQuestionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkChallengeQuestionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkChallengeQuestionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkChallengeQuestion model
   */
  readonly fields: PluginCodingHomeworkChallengeQuestionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkChallengeQuestion.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkChallengeQuestionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    submission<T extends PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    submissionFunction<T extends PluginCodingHomeworkChallengeQuestion$submissionFunctionArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkChallengeQuestion$submissionFunctionArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionFunctionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionFunctionPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkChallengeQuestion model
   */ 
  interface PluginCodingHomeworkChallengeQuestionFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'String'>
    readonly submissionId: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'String'>
    readonly submissionFunctionId: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'String'>
    readonly orderIndex: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'Int'>
    readonly questionText: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'String'>
    readonly studentAnswer: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'String'>
    readonly answerSubmittedAt: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'DateTime'>
    readonly generationModel: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'String'>
    readonly generationPromptVersion: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'String'>
    readonly nearestExamples: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'Json'>
    readonly metadata: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkChallengeQuestion", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkChallengeQuestion findUnique
   */
  export type PluginCodingHomeworkChallengeQuestionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkChallengeQuestion to fetch.
     */
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkChallengeQuestion findUniqueOrThrow
   */
  export type PluginCodingHomeworkChallengeQuestionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkChallengeQuestion to fetch.
     */
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkChallengeQuestion findFirst
   */
  export type PluginCodingHomeworkChallengeQuestionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkChallengeQuestion to fetch.
     */
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkChallengeQuestions to fetch.
     */
    orderBy?: PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput | PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkChallengeQuestions.
     */
    cursor?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkChallengeQuestions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkChallengeQuestions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkChallengeQuestions.
     */
    distinct?: PluginCodingHomeworkChallengeQuestionScalarFieldEnum | PluginCodingHomeworkChallengeQuestionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkChallengeQuestion findFirstOrThrow
   */
  export type PluginCodingHomeworkChallengeQuestionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkChallengeQuestion to fetch.
     */
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkChallengeQuestions to fetch.
     */
    orderBy?: PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput | PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkChallengeQuestions.
     */
    cursor?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkChallengeQuestions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkChallengeQuestions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkChallengeQuestions.
     */
    distinct?: PluginCodingHomeworkChallengeQuestionScalarFieldEnum | PluginCodingHomeworkChallengeQuestionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkChallengeQuestion findMany
   */
  export type PluginCodingHomeworkChallengeQuestionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkChallengeQuestions to fetch.
     */
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkChallengeQuestions to fetch.
     */
    orderBy?: PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput | PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkChallengeQuestions.
     */
    cursor?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkChallengeQuestions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkChallengeQuestions.
     */
    skip?: number
    distinct?: PluginCodingHomeworkChallengeQuestionScalarFieldEnum | PluginCodingHomeworkChallengeQuestionScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkChallengeQuestion create
   */
  export type PluginCodingHomeworkChallengeQuestionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkChallengeQuestion.
     */
    data: XOR<PluginCodingHomeworkChallengeQuestionCreateInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkChallengeQuestion createMany
   */
  export type PluginCodingHomeworkChallengeQuestionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkChallengeQuestions.
     */
    data: PluginCodingHomeworkChallengeQuestionCreateManyInput | PluginCodingHomeworkChallengeQuestionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkChallengeQuestion createManyAndReturn
   */
  export type PluginCodingHomeworkChallengeQuestionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkChallengeQuestions.
     */
    data: PluginCodingHomeworkChallengeQuestionCreateManyInput | PluginCodingHomeworkChallengeQuestionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkChallengeQuestion update
   */
  export type PluginCodingHomeworkChallengeQuestionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkChallengeQuestion.
     */
    data: XOR<PluginCodingHomeworkChallengeQuestionUpdateInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkChallengeQuestion to update.
     */
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkChallengeQuestion updateMany
   */
  export type PluginCodingHomeworkChallengeQuestionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkChallengeQuestions.
     */
    data: XOR<PluginCodingHomeworkChallengeQuestionUpdateManyMutationInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkChallengeQuestions to update
     */
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
  }

  /**
   * PluginCodingHomeworkChallengeQuestion upsert
   */
  export type PluginCodingHomeworkChallengeQuestionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkChallengeQuestion to update in case it exists.
     */
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkChallengeQuestion found by the `where` argument doesn't exist, create a new PluginCodingHomeworkChallengeQuestion with this data.
     */
    create: XOR<PluginCodingHomeworkChallengeQuestionCreateInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkChallengeQuestion was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkChallengeQuestionUpdateInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkChallengeQuestion delete
   */
  export type PluginCodingHomeworkChallengeQuestionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkChallengeQuestion to delete.
     */
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkChallengeQuestion deleteMany
   */
  export type PluginCodingHomeworkChallengeQuestionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkChallengeQuestions to delete
     */
    where?: PluginCodingHomeworkChallengeQuestionWhereInput
  }

  /**
   * PluginCodingHomeworkChallengeQuestion.submissionFunction
   */
  export type PluginCodingHomeworkChallengeQuestion$submissionFunctionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkSubmissionFunction
     */
    select?: PluginCodingHomeworkSubmissionFunctionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkSubmissionFunctionInclude<ExtArgs> | null
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
  }

  /**
   * PluginCodingHomeworkChallengeQuestion without action
   */
  export type PluginCodingHomeworkChallengeQuestionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkChallengeQuestion
     */
    select?: PluginCodingHomeworkChallengeQuestionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkChallengeQuestionInclude<ExtArgs> | null
  }


  /**
   * Model PluginCodingHomeworkReview
   */

  export type AggregatePluginCodingHomeworkReview = {
    _count: PluginCodingHomeworkReviewCountAggregateOutputType | null
    _avg: PluginCodingHomeworkReviewAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkReviewSumAggregateOutputType | null
    _min: PluginCodingHomeworkReviewMinAggregateOutputType | null
    _max: PluginCodingHomeworkReviewMaxAggregateOutputType | null
  }

  export type PluginCodingHomeworkReviewAvgAggregateOutputType = {
    score: number | null
    maxScore: number | null
  }

  export type PluginCodingHomeworkReviewSumAggregateOutputType = {
    score: number | null
    maxScore: number | null
  }

  export type PluginCodingHomeworkReviewMinAggregateOutputType = {
    id: string | null
    submissionId: string | null
    reviewerUserId: string | null
    score: number | null
    maxScore: number | null
    feedback: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkReviewMaxAggregateOutputType = {
    id: string | null
    submissionId: string | null
    reviewerUserId: string | null
    score: number | null
    maxScore: number | null
    feedback: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type PluginCodingHomeworkReviewCountAggregateOutputType = {
    id: number
    submissionId: number
    reviewerUserId: number
    score: number
    maxScore: number
    feedback: number
    rubric: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type PluginCodingHomeworkReviewAvgAggregateInputType = {
    score?: true
    maxScore?: true
  }

  export type PluginCodingHomeworkReviewSumAggregateInputType = {
    score?: true
    maxScore?: true
  }

  export type PluginCodingHomeworkReviewMinAggregateInputType = {
    id?: true
    submissionId?: true
    reviewerUserId?: true
    score?: true
    maxScore?: true
    feedback?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkReviewMaxAggregateInputType = {
    id?: true
    submissionId?: true
    reviewerUserId?: true
    score?: true
    maxScore?: true
    feedback?: true
    createdAt?: true
    updatedAt?: true
  }

  export type PluginCodingHomeworkReviewCountAggregateInputType = {
    id?: true
    submissionId?: true
    reviewerUserId?: true
    score?: true
    maxScore?: true
    feedback?: true
    rubric?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type PluginCodingHomeworkReviewAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkReview to aggregate.
     */
    where?: PluginCodingHomeworkReviewWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkReviews to fetch.
     */
    orderBy?: PluginCodingHomeworkReviewOrderByWithRelationInput | PluginCodingHomeworkReviewOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PluginCodingHomeworkReviewWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkReviews from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkReviews.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PluginCodingHomeworkReviews
    **/
    _count?: true | PluginCodingHomeworkReviewCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PluginCodingHomeworkReviewAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PluginCodingHomeworkReviewSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PluginCodingHomeworkReviewMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PluginCodingHomeworkReviewMaxAggregateInputType
  }

  export type GetPluginCodingHomeworkReviewAggregateType<T extends PluginCodingHomeworkReviewAggregateArgs> = {
        [P in keyof T & keyof AggregatePluginCodingHomeworkReview]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePluginCodingHomeworkReview[P]>
      : GetScalarType<T[P], AggregatePluginCodingHomeworkReview[P]>
  }




  export type PluginCodingHomeworkReviewGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PluginCodingHomeworkReviewWhereInput
    orderBy?: PluginCodingHomeworkReviewOrderByWithAggregationInput | PluginCodingHomeworkReviewOrderByWithAggregationInput[]
    by: PluginCodingHomeworkReviewScalarFieldEnum[] | PluginCodingHomeworkReviewScalarFieldEnum
    having?: PluginCodingHomeworkReviewScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PluginCodingHomeworkReviewCountAggregateInputType | true
    _avg?: PluginCodingHomeworkReviewAvgAggregateInputType
    _sum?: PluginCodingHomeworkReviewSumAggregateInputType
    _min?: PluginCodingHomeworkReviewMinAggregateInputType
    _max?: PluginCodingHomeworkReviewMaxAggregateInputType
  }

  export type PluginCodingHomeworkReviewGroupByOutputType = {
    id: string
    submissionId: string
    reviewerUserId: string
    score: number | null
    maxScore: number | null
    feedback: string
    rubric: JsonValue
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: PluginCodingHomeworkReviewCountAggregateOutputType | null
    _avg: PluginCodingHomeworkReviewAvgAggregateOutputType | null
    _sum: PluginCodingHomeworkReviewSumAggregateOutputType | null
    _min: PluginCodingHomeworkReviewMinAggregateOutputType | null
    _max: PluginCodingHomeworkReviewMaxAggregateOutputType | null
  }

  type GetPluginCodingHomeworkReviewGroupByPayload<T extends PluginCodingHomeworkReviewGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PluginCodingHomeworkReviewGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PluginCodingHomeworkReviewGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PluginCodingHomeworkReviewGroupByOutputType[P]>
            : GetScalarType<T[P], PluginCodingHomeworkReviewGroupByOutputType[P]>
        }
      >
    >


  export type PluginCodingHomeworkReviewSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    submissionId?: boolean
    reviewerUserId?: boolean
    score?: boolean
    maxScore?: boolean
    feedback?: boolean
    rubric?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkReview"]>

  export type PluginCodingHomeworkReviewSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    submissionId?: boolean
    reviewerUserId?: boolean
    score?: boolean
    maxScore?: boolean
    feedback?: boolean
    rubric?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["pluginCodingHomeworkReview"]>

  export type PluginCodingHomeworkReviewSelectScalar = {
    id?: boolean
    submissionId?: boolean
    reviewerUserId?: boolean
    score?: boolean
    maxScore?: boolean
    feedback?: boolean
    rubric?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type PluginCodingHomeworkReviewInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
  }
  export type PluginCodingHomeworkReviewIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    submission?: boolean | PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
  }

  export type $PluginCodingHomeworkReviewPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PluginCodingHomeworkReview"
    objects: {
      submission: Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      submissionId: string
      reviewerUserId: string
      score: number | null
      maxScore: number | null
      feedback: string
      rubric: Prisma.JsonValue
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["pluginCodingHomeworkReview"]>
    composites: {}
  }

  type PluginCodingHomeworkReviewGetPayload<S extends boolean | null | undefined | PluginCodingHomeworkReviewDefaultArgs> = $Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload, S>

  type PluginCodingHomeworkReviewCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PluginCodingHomeworkReviewFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PluginCodingHomeworkReviewCountAggregateInputType | true
    }

  export interface PluginCodingHomeworkReviewDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PluginCodingHomeworkReview'], meta: { name: 'PluginCodingHomeworkReview' } }
    /**
     * Find zero or one PluginCodingHomeworkReview that matches the filter.
     * @param {PluginCodingHomeworkReviewFindUniqueArgs} args - Arguments to find a PluginCodingHomeworkReview
     * @example
     * // Get one PluginCodingHomeworkReview
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PluginCodingHomeworkReviewFindUniqueArgs>(args: SelectSubset<T, PluginCodingHomeworkReviewFindUniqueArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReviewClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PluginCodingHomeworkReview that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PluginCodingHomeworkReviewFindUniqueOrThrowArgs} args - Arguments to find a PluginCodingHomeworkReview
     * @example
     * // Get one PluginCodingHomeworkReview
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PluginCodingHomeworkReviewFindUniqueOrThrowArgs>(args: SelectSubset<T, PluginCodingHomeworkReviewFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReviewClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkReview that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReviewFindFirstArgs} args - Arguments to find a PluginCodingHomeworkReview
     * @example
     * // Get one PluginCodingHomeworkReview
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PluginCodingHomeworkReviewFindFirstArgs>(args?: SelectSubset<T, PluginCodingHomeworkReviewFindFirstArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReviewClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PluginCodingHomeworkReview that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReviewFindFirstOrThrowArgs} args - Arguments to find a PluginCodingHomeworkReview
     * @example
     * // Get one PluginCodingHomeworkReview
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PluginCodingHomeworkReviewFindFirstOrThrowArgs>(args?: SelectSubset<T, PluginCodingHomeworkReviewFindFirstOrThrowArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReviewClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PluginCodingHomeworkReviews that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReviewFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PluginCodingHomeworkReviews
     * const pluginCodingHomeworkReviews = await prisma.pluginCodingHomeworkReview.findMany()
     * 
     * // Get first 10 PluginCodingHomeworkReviews
     * const pluginCodingHomeworkReviews = await prisma.pluginCodingHomeworkReview.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const pluginCodingHomeworkReviewWithIdOnly = await prisma.pluginCodingHomeworkReview.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PluginCodingHomeworkReviewFindManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkReviewFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PluginCodingHomeworkReview.
     * @param {PluginCodingHomeworkReviewCreateArgs} args - Arguments to create a PluginCodingHomeworkReview.
     * @example
     * // Create one PluginCodingHomeworkReview
     * const PluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.create({
     *   data: {
     *     // ... data to create a PluginCodingHomeworkReview
     *   }
     * })
     * 
     */
    create<T extends PluginCodingHomeworkReviewCreateArgs>(args: SelectSubset<T, PluginCodingHomeworkReviewCreateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReviewClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PluginCodingHomeworkReviews.
     * @param {PluginCodingHomeworkReviewCreateManyArgs} args - Arguments to create many PluginCodingHomeworkReviews.
     * @example
     * // Create many PluginCodingHomeworkReviews
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PluginCodingHomeworkReviewCreateManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkReviewCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PluginCodingHomeworkReviews and returns the data saved in the database.
     * @param {PluginCodingHomeworkReviewCreateManyAndReturnArgs} args - Arguments to create many PluginCodingHomeworkReviews.
     * @example
     * // Create many PluginCodingHomeworkReviews
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PluginCodingHomeworkReviews and only return the `id`
     * const pluginCodingHomeworkReviewWithIdOnly = await prisma.pluginCodingHomeworkReview.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PluginCodingHomeworkReviewCreateManyAndReturnArgs>(args?: SelectSubset<T, PluginCodingHomeworkReviewCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PluginCodingHomeworkReview.
     * @param {PluginCodingHomeworkReviewDeleteArgs} args - Arguments to delete one PluginCodingHomeworkReview.
     * @example
     * // Delete one PluginCodingHomeworkReview
     * const PluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.delete({
     *   where: {
     *     // ... filter to delete one PluginCodingHomeworkReview
     *   }
     * })
     * 
     */
    delete<T extends PluginCodingHomeworkReviewDeleteArgs>(args: SelectSubset<T, PluginCodingHomeworkReviewDeleteArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReviewClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PluginCodingHomeworkReview.
     * @param {PluginCodingHomeworkReviewUpdateArgs} args - Arguments to update one PluginCodingHomeworkReview.
     * @example
     * // Update one PluginCodingHomeworkReview
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PluginCodingHomeworkReviewUpdateArgs>(args: SelectSubset<T, PluginCodingHomeworkReviewUpdateArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReviewClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PluginCodingHomeworkReviews.
     * @param {PluginCodingHomeworkReviewDeleteManyArgs} args - Arguments to filter PluginCodingHomeworkReviews to delete.
     * @example
     * // Delete a few PluginCodingHomeworkReviews
     * const { count } = await prisma.pluginCodingHomeworkReview.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PluginCodingHomeworkReviewDeleteManyArgs>(args?: SelectSubset<T, PluginCodingHomeworkReviewDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PluginCodingHomeworkReviews.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReviewUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PluginCodingHomeworkReviews
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PluginCodingHomeworkReviewUpdateManyArgs>(args: SelectSubset<T, PluginCodingHomeworkReviewUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PluginCodingHomeworkReview.
     * @param {PluginCodingHomeworkReviewUpsertArgs} args - Arguments to update or create a PluginCodingHomeworkReview.
     * @example
     * // Update or create a PluginCodingHomeworkReview
     * const pluginCodingHomeworkReview = await prisma.pluginCodingHomeworkReview.upsert({
     *   create: {
     *     // ... data to create a PluginCodingHomeworkReview
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkReview we want to update
     *   }
     * })
     */
    upsert<T extends PluginCodingHomeworkReviewUpsertArgs>(args: SelectSubset<T, PluginCodingHomeworkReviewUpsertArgs<ExtArgs>>): Prisma__PluginCodingHomeworkReviewClient<$Result.GetResult<Prisma.$PluginCodingHomeworkReviewPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PluginCodingHomeworkReviews.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReviewCountArgs} args - Arguments to filter PluginCodingHomeworkReviews to count.
     * @example
     * // Count the number of PluginCodingHomeworkReviews
     * const count = await prisma.pluginCodingHomeworkReview.count({
     *   where: {
     *     // ... the filter for the PluginCodingHomeworkReviews we want to count
     *   }
     * })
    **/
    count<T extends PluginCodingHomeworkReviewCountArgs>(
      args?: Subset<T, PluginCodingHomeworkReviewCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PluginCodingHomeworkReviewCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PluginCodingHomeworkReview.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReviewAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PluginCodingHomeworkReviewAggregateArgs>(args: Subset<T, PluginCodingHomeworkReviewAggregateArgs>): Prisma.PrismaPromise<GetPluginCodingHomeworkReviewAggregateType<T>>

    /**
     * Group by PluginCodingHomeworkReview.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PluginCodingHomeworkReviewGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PluginCodingHomeworkReviewGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PluginCodingHomeworkReviewGroupByArgs['orderBy'] }
        : { orderBy?: PluginCodingHomeworkReviewGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PluginCodingHomeworkReviewGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPluginCodingHomeworkReviewGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PluginCodingHomeworkReview model
   */
  readonly fields: PluginCodingHomeworkReviewFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PluginCodingHomeworkReview.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PluginCodingHomeworkReviewClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    submission<T extends PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>>): Prisma__PluginCodingHomeworkSubmissionClient<$Result.GetResult<Prisma.$PluginCodingHomeworkSubmissionPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PluginCodingHomeworkReview model
   */ 
  interface PluginCodingHomeworkReviewFieldRefs {
    readonly id: FieldRef<"PluginCodingHomeworkReview", 'String'>
    readonly submissionId: FieldRef<"PluginCodingHomeworkReview", 'String'>
    readonly reviewerUserId: FieldRef<"PluginCodingHomeworkReview", 'String'>
    readonly score: FieldRef<"PluginCodingHomeworkReview", 'Float'>
    readonly maxScore: FieldRef<"PluginCodingHomeworkReview", 'Float'>
    readonly feedback: FieldRef<"PluginCodingHomeworkReview", 'String'>
    readonly rubric: FieldRef<"PluginCodingHomeworkReview", 'Json'>
    readonly metadata: FieldRef<"PluginCodingHomeworkReview", 'Json'>
    readonly createdAt: FieldRef<"PluginCodingHomeworkReview", 'DateTime'>
    readonly updatedAt: FieldRef<"PluginCodingHomeworkReview", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PluginCodingHomeworkReview findUnique
   */
  export type PluginCodingHomeworkReviewFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReview to fetch.
     */
    where: PluginCodingHomeworkReviewWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkReview findUniqueOrThrow
   */
  export type PluginCodingHomeworkReviewFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReview to fetch.
     */
    where: PluginCodingHomeworkReviewWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkReview findFirst
   */
  export type PluginCodingHomeworkReviewFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReview to fetch.
     */
    where?: PluginCodingHomeworkReviewWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkReviews to fetch.
     */
    orderBy?: PluginCodingHomeworkReviewOrderByWithRelationInput | PluginCodingHomeworkReviewOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkReviews.
     */
    cursor?: PluginCodingHomeworkReviewWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkReviews from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkReviews.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkReviews.
     */
    distinct?: PluginCodingHomeworkReviewScalarFieldEnum | PluginCodingHomeworkReviewScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkReview findFirstOrThrow
   */
  export type PluginCodingHomeworkReviewFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReview to fetch.
     */
    where?: PluginCodingHomeworkReviewWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkReviews to fetch.
     */
    orderBy?: PluginCodingHomeworkReviewOrderByWithRelationInput | PluginCodingHomeworkReviewOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PluginCodingHomeworkReviews.
     */
    cursor?: PluginCodingHomeworkReviewWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkReviews from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkReviews.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PluginCodingHomeworkReviews.
     */
    distinct?: PluginCodingHomeworkReviewScalarFieldEnum | PluginCodingHomeworkReviewScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkReview findMany
   */
  export type PluginCodingHomeworkReviewFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * Filter, which PluginCodingHomeworkReviews to fetch.
     */
    where?: PluginCodingHomeworkReviewWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PluginCodingHomeworkReviews to fetch.
     */
    orderBy?: PluginCodingHomeworkReviewOrderByWithRelationInput | PluginCodingHomeworkReviewOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PluginCodingHomeworkReviews.
     */
    cursor?: PluginCodingHomeworkReviewWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PluginCodingHomeworkReviews from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PluginCodingHomeworkReviews.
     */
    skip?: number
    distinct?: PluginCodingHomeworkReviewScalarFieldEnum | PluginCodingHomeworkReviewScalarFieldEnum[]
  }

  /**
   * PluginCodingHomeworkReview create
   */
  export type PluginCodingHomeworkReviewCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * The data needed to create a PluginCodingHomeworkReview.
     */
    data: XOR<PluginCodingHomeworkReviewCreateInput, PluginCodingHomeworkReviewUncheckedCreateInput>
  }

  /**
   * PluginCodingHomeworkReview createMany
   */
  export type PluginCodingHomeworkReviewCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PluginCodingHomeworkReviews.
     */
    data: PluginCodingHomeworkReviewCreateManyInput | PluginCodingHomeworkReviewCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PluginCodingHomeworkReview createManyAndReturn
   */
  export type PluginCodingHomeworkReviewCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PluginCodingHomeworkReviews.
     */
    data: PluginCodingHomeworkReviewCreateManyInput | PluginCodingHomeworkReviewCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PluginCodingHomeworkReview update
   */
  export type PluginCodingHomeworkReviewUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * The data needed to update a PluginCodingHomeworkReview.
     */
    data: XOR<PluginCodingHomeworkReviewUpdateInput, PluginCodingHomeworkReviewUncheckedUpdateInput>
    /**
     * Choose, which PluginCodingHomeworkReview to update.
     */
    where: PluginCodingHomeworkReviewWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkReview updateMany
   */
  export type PluginCodingHomeworkReviewUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PluginCodingHomeworkReviews.
     */
    data: XOR<PluginCodingHomeworkReviewUpdateManyMutationInput, PluginCodingHomeworkReviewUncheckedUpdateManyInput>
    /**
     * Filter which PluginCodingHomeworkReviews to update
     */
    where?: PluginCodingHomeworkReviewWhereInput
  }

  /**
   * PluginCodingHomeworkReview upsert
   */
  export type PluginCodingHomeworkReviewUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * The filter to search for the PluginCodingHomeworkReview to update in case it exists.
     */
    where: PluginCodingHomeworkReviewWhereUniqueInput
    /**
     * In case the PluginCodingHomeworkReview found by the `where` argument doesn't exist, create a new PluginCodingHomeworkReview with this data.
     */
    create: XOR<PluginCodingHomeworkReviewCreateInput, PluginCodingHomeworkReviewUncheckedCreateInput>
    /**
     * In case the PluginCodingHomeworkReview was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PluginCodingHomeworkReviewUpdateInput, PluginCodingHomeworkReviewUncheckedUpdateInput>
  }

  /**
   * PluginCodingHomeworkReview delete
   */
  export type PluginCodingHomeworkReviewDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
    /**
     * Filter which PluginCodingHomeworkReview to delete.
     */
    where: PluginCodingHomeworkReviewWhereUniqueInput
  }

  /**
   * PluginCodingHomeworkReview deleteMany
   */
  export type PluginCodingHomeworkReviewDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PluginCodingHomeworkReviews to delete
     */
    where?: PluginCodingHomeworkReviewWhereInput
  }

  /**
   * PluginCodingHomeworkReview without action
   */
  export type PluginCodingHomeworkReviewDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PluginCodingHomeworkReview
     */
    select?: PluginCodingHomeworkReviewSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PluginCodingHomeworkReviewInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const PluginCodingHomeworkAssignmentScalarFieldEnum: {
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

  export type PluginCodingHomeworkAssignmentScalarFieldEnum = (typeof PluginCodingHomeworkAssignmentScalarFieldEnum)[keyof typeof PluginCodingHomeworkAssignmentScalarFieldEnum]


  export const PluginBankCodingHomeworkAssignmentScalarFieldEnum: {
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

  export type PluginBankCodingHomeworkAssignmentScalarFieldEnum = (typeof PluginBankCodingHomeworkAssignmentScalarFieldEnum)[keyof typeof PluginBankCodingHomeworkAssignmentScalarFieldEnum]


  export const PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum: {
    id: 'id',
    activityId: 'activityId',
    languageKey: 'languageKey',
    requirements: 'requirements',
    sourceAttachmentId: 'sourceAttachmentId',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum = (typeof PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum)[keyof typeof PluginCodingHomeworkSubmissionRequirementSetScalarFieldEnum]


  export const PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum: {
    id: 'id',
    bankActivityId: 'bankActivityId',
    languageKey: 'languageKey',
    requirements: 'requirements',
    sourceAttachmentId: 'sourceAttachmentId',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum = (typeof PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum)[keyof typeof PluginBankCodingHomeworkSubmissionRequirementSetScalarFieldEnum]


  export const PluginCodingHomeworkAttachmentScalarFieldEnum: {
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

  export type PluginCodingHomeworkAttachmentScalarFieldEnum = (typeof PluginCodingHomeworkAttachmentScalarFieldEnum)[keyof typeof PluginCodingHomeworkAttachmentScalarFieldEnum]


  export const PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum: {
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

  export type PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum = (typeof PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum)[keyof typeof PluginCodingHomeworkDocumentationSnapshotScalarFieldEnum]


  export const PluginCodingHomeworkReferenceFunctionScalarFieldEnum: {
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

  export type PluginCodingHomeworkReferenceFunctionScalarFieldEnum = (typeof PluginCodingHomeworkReferenceFunctionScalarFieldEnum)[keyof typeof PluginCodingHomeworkReferenceFunctionScalarFieldEnum]


  export const PluginCodingHomeworkSubmissionScalarFieldEnum: {
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

  export type PluginCodingHomeworkSubmissionScalarFieldEnum = (typeof PluginCodingHomeworkSubmissionScalarFieldEnum)[keyof typeof PluginCodingHomeworkSubmissionScalarFieldEnum]


  export const PluginCodingHomeworkSubmissionFileScalarFieldEnum: {
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

  export type PluginCodingHomeworkSubmissionFileScalarFieldEnum = (typeof PluginCodingHomeworkSubmissionFileScalarFieldEnum)[keyof typeof PluginCodingHomeworkSubmissionFileScalarFieldEnum]


  export const PluginCodingHomeworkSubmissionFunctionScalarFieldEnum: {
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

  export type PluginCodingHomeworkSubmissionFunctionScalarFieldEnum = (typeof PluginCodingHomeworkSubmissionFunctionScalarFieldEnum)[keyof typeof PluginCodingHomeworkSubmissionFunctionScalarFieldEnum]


  export const PluginCodingHomeworkChallengeQuestionScalarFieldEnum: {
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

  export type PluginCodingHomeworkChallengeQuestionScalarFieldEnum = (typeof PluginCodingHomeworkChallengeQuestionScalarFieldEnum)[keyof typeof PluginCodingHomeworkChallengeQuestionScalarFieldEnum]


  export const PluginCodingHomeworkReviewScalarFieldEnum: {
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

  export type PluginCodingHomeworkReviewScalarFieldEnum = (typeof PluginCodingHomeworkReviewScalarFieldEnum)[keyof typeof PluginCodingHomeworkReviewScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkAttachmentOwnerKind'
   */
  export type EnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkAttachmentOwnerKind'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkAttachmentOwnerKind[]'
   */
  export type ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkAttachmentOwnerKind[]'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkAttachmentKind'
   */
  export type EnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkAttachmentKind'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkAttachmentKind[]'
   */
  export type ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkAttachmentKind[]'>
    


  /**
   * Reference to a field of type 'BigInt'
   */
  export type BigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt'>
    


  /**
   * Reference to a field of type 'BigInt[]'
   */
  export type ListBigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt[]'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkSnapshotStatus'
   */
  export type EnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkSnapshotStatus'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkSnapshotStatus[]'
   */
  export type ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkSnapshotStatus[]'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkSubmissionKind'
   */
  export type EnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkSubmissionKind'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkSubmissionKind[]'
   */
  export type ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkSubmissionKind[]'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkSubmissionStatus'
   */
  export type EnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkSubmissionStatus'>
    


  /**
   * Reference to a field of type 'PluginCodingHomeworkSubmissionStatus[]'
   */
  export type ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PluginCodingHomeworkSubmissionStatus[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    
  /**
   * Deep Input Types
   */


  export type PluginCodingHomeworkAssignmentWhereInput = {
    AND?: PluginCodingHomeworkAssignmentWhereInput | PluginCodingHomeworkAssignmentWhereInput[]
    OR?: PluginCodingHomeworkAssignmentWhereInput[]
    NOT?: PluginCodingHomeworkAssignmentWhereInput | PluginCodingHomeworkAssignmentWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkAssignment"> | string
    activityId?: StringFilter<"PluginCodingHomeworkAssignment"> | string
    promptMarkdown?: StringFilter<"PluginCodingHomeworkAssignment"> | string
    promptPdfAttachmentId?: StringNullableFilter<"PluginCodingHomeworkAssignment"> | string | null
    languageKey?: StringFilter<"PluginCodingHomeworkAssignment"> | string
    candidateLimit?: IntFilter<"PluginCodingHomeworkAssignment"> | number
    retrievedExampleCount?: IntFilter<"PluginCodingHomeworkAssignment"> | number
    questionCount?: IntFilter<"PluginCodingHomeworkAssignment"> | number
    generationInstructions?: StringFilter<"PluginCodingHomeworkAssignment"> | string
    settings?: JsonFilter<"PluginCodingHomeworkAssignment">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkAssignment"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkAssignment"> | Date | string
  }

  export type PluginCodingHomeworkAssignmentOrderByWithRelationInput = {
    id?: SortOrder
    activityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrderInput | SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    settings?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkAssignmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    activityId?: string
    AND?: PluginCodingHomeworkAssignmentWhereInput | PluginCodingHomeworkAssignmentWhereInput[]
    OR?: PluginCodingHomeworkAssignmentWhereInput[]
    NOT?: PluginCodingHomeworkAssignmentWhereInput | PluginCodingHomeworkAssignmentWhereInput[]
    promptMarkdown?: StringFilter<"PluginCodingHomeworkAssignment"> | string
    promptPdfAttachmentId?: StringNullableFilter<"PluginCodingHomeworkAssignment"> | string | null
    languageKey?: StringFilter<"PluginCodingHomeworkAssignment"> | string
    candidateLimit?: IntFilter<"PluginCodingHomeworkAssignment"> | number
    retrievedExampleCount?: IntFilter<"PluginCodingHomeworkAssignment"> | number
    questionCount?: IntFilter<"PluginCodingHomeworkAssignment"> | number
    generationInstructions?: StringFilter<"PluginCodingHomeworkAssignment"> | string
    settings?: JsonFilter<"PluginCodingHomeworkAssignment">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkAssignment"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkAssignment"> | Date | string
  }, "id" | "activityId">

  export type PluginCodingHomeworkAssignmentOrderByWithAggregationInput = {
    id?: SortOrder
    activityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrderInput | SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    settings?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkAssignmentCountOrderByAggregateInput
    _avg?: PluginCodingHomeworkAssignmentAvgOrderByAggregateInput
    _max?: PluginCodingHomeworkAssignmentMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkAssignmentMinOrderByAggregateInput
    _sum?: PluginCodingHomeworkAssignmentSumOrderByAggregateInput
  }

  export type PluginCodingHomeworkAssignmentScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkAssignmentScalarWhereWithAggregatesInput | PluginCodingHomeworkAssignmentScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkAssignmentScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkAssignmentScalarWhereWithAggregatesInput | PluginCodingHomeworkAssignmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | string
    activityId?: StringWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | string
    promptMarkdown?: StringWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | string
    promptPdfAttachmentId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | string | null
    languageKey?: StringWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | string
    candidateLimit?: IntWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | number
    retrievedExampleCount?: IntWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | number
    questionCount?: IntWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | number
    generationInstructions?: StringWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | string
    settings?: JsonWithAggregatesFilter<"PluginCodingHomeworkAssignment">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkAssignment"> | Date | string
  }

  export type PluginBankCodingHomeworkAssignmentWhereInput = {
    AND?: PluginBankCodingHomeworkAssignmentWhereInput | PluginBankCodingHomeworkAssignmentWhereInput[]
    OR?: PluginBankCodingHomeworkAssignmentWhereInput[]
    NOT?: PluginBankCodingHomeworkAssignmentWhereInput | PluginBankCodingHomeworkAssignmentWhereInput[]
    id?: StringFilter<"PluginBankCodingHomeworkAssignment"> | string
    bankActivityId?: StringFilter<"PluginBankCodingHomeworkAssignment"> | string
    promptMarkdown?: StringFilter<"PluginBankCodingHomeworkAssignment"> | string
    promptPdfAttachmentId?: StringNullableFilter<"PluginBankCodingHomeworkAssignment"> | string | null
    languageKey?: StringFilter<"PluginBankCodingHomeworkAssignment"> | string
    candidateLimit?: IntFilter<"PluginBankCodingHomeworkAssignment"> | number
    retrievedExampleCount?: IntFilter<"PluginBankCodingHomeworkAssignment"> | number
    questionCount?: IntFilter<"PluginBankCodingHomeworkAssignment"> | number
    generationInstructions?: StringFilter<"PluginBankCodingHomeworkAssignment"> | string
    settings?: JsonFilter<"PluginBankCodingHomeworkAssignment">
    createdAt?: DateTimeFilter<"PluginBankCodingHomeworkAssignment"> | Date | string
    updatedAt?: DateTimeFilter<"PluginBankCodingHomeworkAssignment"> | Date | string
  }

  export type PluginBankCodingHomeworkAssignmentOrderByWithRelationInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrderInput | SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    settings?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginBankCodingHomeworkAssignmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    bankActivityId?: string
    AND?: PluginBankCodingHomeworkAssignmentWhereInput | PluginBankCodingHomeworkAssignmentWhereInput[]
    OR?: PluginBankCodingHomeworkAssignmentWhereInput[]
    NOT?: PluginBankCodingHomeworkAssignmentWhereInput | PluginBankCodingHomeworkAssignmentWhereInput[]
    promptMarkdown?: StringFilter<"PluginBankCodingHomeworkAssignment"> | string
    promptPdfAttachmentId?: StringNullableFilter<"PluginBankCodingHomeworkAssignment"> | string | null
    languageKey?: StringFilter<"PluginBankCodingHomeworkAssignment"> | string
    candidateLimit?: IntFilter<"PluginBankCodingHomeworkAssignment"> | number
    retrievedExampleCount?: IntFilter<"PluginBankCodingHomeworkAssignment"> | number
    questionCount?: IntFilter<"PluginBankCodingHomeworkAssignment"> | number
    generationInstructions?: StringFilter<"PluginBankCodingHomeworkAssignment"> | string
    settings?: JsonFilter<"PluginBankCodingHomeworkAssignment">
    createdAt?: DateTimeFilter<"PluginBankCodingHomeworkAssignment"> | Date | string
    updatedAt?: DateTimeFilter<"PluginBankCodingHomeworkAssignment"> | Date | string
  }, "id" | "bankActivityId">

  export type PluginBankCodingHomeworkAssignmentOrderByWithAggregationInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrderInput | SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    settings?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginBankCodingHomeworkAssignmentCountOrderByAggregateInput
    _avg?: PluginBankCodingHomeworkAssignmentAvgOrderByAggregateInput
    _max?: PluginBankCodingHomeworkAssignmentMaxOrderByAggregateInput
    _min?: PluginBankCodingHomeworkAssignmentMinOrderByAggregateInput
    _sum?: PluginBankCodingHomeworkAssignmentSumOrderByAggregateInput
  }

  export type PluginBankCodingHomeworkAssignmentScalarWhereWithAggregatesInput = {
    AND?: PluginBankCodingHomeworkAssignmentScalarWhereWithAggregatesInput | PluginBankCodingHomeworkAssignmentScalarWhereWithAggregatesInput[]
    OR?: PluginBankCodingHomeworkAssignmentScalarWhereWithAggregatesInput[]
    NOT?: PluginBankCodingHomeworkAssignmentScalarWhereWithAggregatesInput | PluginBankCodingHomeworkAssignmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | string
    bankActivityId?: StringWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | string
    promptMarkdown?: StringWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | string
    promptPdfAttachmentId?: StringNullableWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | string | null
    languageKey?: StringWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | string
    candidateLimit?: IntWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | number
    retrievedExampleCount?: IntWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | number
    questionCount?: IntWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | number
    generationInstructions?: StringWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | string
    settings?: JsonWithAggregatesFilter<"PluginBankCodingHomeworkAssignment">
    createdAt?: DateTimeWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginBankCodingHomeworkAssignment"> | Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetWhereInput = {
    AND?: PluginCodingHomeworkSubmissionRequirementSetWhereInput | PluginCodingHomeworkSubmissionRequirementSetWhereInput[]
    OR?: PluginCodingHomeworkSubmissionRequirementSetWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionRequirementSetWhereInput | PluginCodingHomeworkSubmissionRequirementSetWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string
    activityId?: StringFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string
    languageKey?: StringFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string
    requirements?: JsonFilter<"PluginCodingHomeworkSubmissionRequirementSet">
    sourceAttachmentId?: StringNullableFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string | null
    metadata?: JsonFilter<"PluginCodingHomeworkSubmissionRequirementSet">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput = {
    id?: SortOrder
    activityId?: SortOrder
    languageKey?: SortOrder
    requirements?: SortOrder
    sourceAttachmentId?: SortOrderInput | SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionRequirementSetWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    activityId?: string
    AND?: PluginCodingHomeworkSubmissionRequirementSetWhereInput | PluginCodingHomeworkSubmissionRequirementSetWhereInput[]
    OR?: PluginCodingHomeworkSubmissionRequirementSetWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionRequirementSetWhereInput | PluginCodingHomeworkSubmissionRequirementSetWhereInput[]
    languageKey?: StringFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string
    requirements?: JsonFilter<"PluginCodingHomeworkSubmissionRequirementSet">
    sourceAttachmentId?: StringNullableFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string | null
    metadata?: JsonFilter<"PluginCodingHomeworkSubmissionRequirementSet">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | Date | string
  }, "id" | "activityId">

  export type PluginCodingHomeworkSubmissionRequirementSetOrderByWithAggregationInput = {
    id?: SortOrder
    activityId?: SortOrder
    languageKey?: SortOrder
    requirements?: SortOrder
    sourceAttachmentId?: SortOrderInput | SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkSubmissionRequirementSetCountOrderByAggregateInput
    _max?: PluginCodingHomeworkSubmissionRequirementSetMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkSubmissionRequirementSetMinOrderByAggregateInput
  }

  export type PluginCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput | PluginCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput | PluginCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string
    activityId?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string
    languageKey?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string
    requirements?: JsonWithAggregatesFilter<"PluginCodingHomeworkSubmissionRequirementSet">
    sourceAttachmentId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | string | null
    metadata?: JsonWithAggregatesFilter<"PluginCodingHomeworkSubmissionRequirementSet">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkSubmissionRequirementSet"> | Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetWhereInput = {
    AND?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput | PluginBankCodingHomeworkSubmissionRequirementSetWhereInput[]
    OR?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput[]
    NOT?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput | PluginBankCodingHomeworkSubmissionRequirementSetWhereInput[]
    id?: StringFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string
    bankActivityId?: StringFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string
    languageKey?: StringFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string
    requirements?: JsonFilter<"PluginBankCodingHomeworkSubmissionRequirementSet">
    sourceAttachmentId?: StringNullableFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string | null
    metadata?: JsonFilter<"PluginBankCodingHomeworkSubmissionRequirementSet">
    createdAt?: DateTimeFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | Date | string
    updatedAt?: DateTimeFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithRelationInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    languageKey?: SortOrder
    requirements?: SortOrder
    sourceAttachmentId?: SortOrderInput | SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    bankActivityId?: string
    AND?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput | PluginBankCodingHomeworkSubmissionRequirementSetWhereInput[]
    OR?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput[]
    NOT?: PluginBankCodingHomeworkSubmissionRequirementSetWhereInput | PluginBankCodingHomeworkSubmissionRequirementSetWhereInput[]
    languageKey?: StringFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string
    requirements?: JsonFilter<"PluginBankCodingHomeworkSubmissionRequirementSet">
    sourceAttachmentId?: StringNullableFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string | null
    metadata?: JsonFilter<"PluginBankCodingHomeworkSubmissionRequirementSet">
    createdAt?: DateTimeFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | Date | string
    updatedAt?: DateTimeFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | Date | string
  }, "id" | "bankActivityId">

  export type PluginBankCodingHomeworkSubmissionRequirementSetOrderByWithAggregationInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    languageKey?: SortOrder
    requirements?: SortOrder
    sourceAttachmentId?: SortOrderInput | SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginBankCodingHomeworkSubmissionRequirementSetCountOrderByAggregateInput
    _max?: PluginBankCodingHomeworkSubmissionRequirementSetMaxOrderByAggregateInput
    _min?: PluginBankCodingHomeworkSubmissionRequirementSetMinOrderByAggregateInput
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput = {
    AND?: PluginBankCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput | PluginBankCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput[]
    OR?: PluginBankCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput[]
    NOT?: PluginBankCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput | PluginBankCodingHomeworkSubmissionRequirementSetScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string
    bankActivityId?: StringWithAggregatesFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string
    languageKey?: StringWithAggregatesFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string
    requirements?: JsonWithAggregatesFilter<"PluginBankCodingHomeworkSubmissionRequirementSet">
    sourceAttachmentId?: StringNullableWithAggregatesFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | string | null
    metadata?: JsonWithAggregatesFilter<"PluginBankCodingHomeworkSubmissionRequirementSet">
    createdAt?: DateTimeWithAggregatesFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginBankCodingHomeworkSubmissionRequirementSet"> | Date | string
  }

  export type PluginCodingHomeworkAttachmentWhereInput = {
    AND?: PluginCodingHomeworkAttachmentWhereInput | PluginCodingHomeworkAttachmentWhereInput[]
    OR?: PluginCodingHomeworkAttachmentWhereInput[]
    NOT?: PluginCodingHomeworkAttachmentWhereInput | PluginCodingHomeworkAttachmentWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    ownerKind?: EnumPluginCodingHomeworkAttachmentOwnerKindFilter<"PluginCodingHomeworkAttachment"> | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    kind?: EnumPluginCodingHomeworkAttachmentKindFilter<"PluginCodingHomeworkAttachment"> | $Enums.PluginCodingHomeworkAttachmentKind
    originalName?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    storedName?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    mimeType?: StringNullableFilter<"PluginCodingHomeworkAttachment"> | string | null
    sizeBytes?: BigIntFilter<"PluginCodingHomeworkAttachment"> | bigint | number
    sha256?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    metadata?: JsonFilter<"PluginCodingHomeworkAttachment">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkAttachment"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkAttachment"> | Date | string
  }

  export type PluginCodingHomeworkAttachmentOrderByWithRelationInput = {
    id?: SortOrder
    ownerKind?: SortOrder
    ownerId?: SortOrder
    kind?: SortOrder
    originalName?: SortOrder
    storedName?: SortOrder
    mimeType?: SortOrderInput | SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkAttachmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PluginCodingHomeworkAttachmentWhereInput | PluginCodingHomeworkAttachmentWhereInput[]
    OR?: PluginCodingHomeworkAttachmentWhereInput[]
    NOT?: PluginCodingHomeworkAttachmentWhereInput | PluginCodingHomeworkAttachmentWhereInput[]
    ownerKind?: EnumPluginCodingHomeworkAttachmentOwnerKindFilter<"PluginCodingHomeworkAttachment"> | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    kind?: EnumPluginCodingHomeworkAttachmentKindFilter<"PluginCodingHomeworkAttachment"> | $Enums.PluginCodingHomeworkAttachmentKind
    originalName?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    storedName?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    mimeType?: StringNullableFilter<"PluginCodingHomeworkAttachment"> | string | null
    sizeBytes?: BigIntFilter<"PluginCodingHomeworkAttachment"> | bigint | number
    sha256?: StringFilter<"PluginCodingHomeworkAttachment"> | string
    metadata?: JsonFilter<"PluginCodingHomeworkAttachment">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkAttachment"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkAttachment"> | Date | string
  }, "id">

  export type PluginCodingHomeworkAttachmentOrderByWithAggregationInput = {
    id?: SortOrder
    ownerKind?: SortOrder
    ownerId?: SortOrder
    kind?: SortOrder
    originalName?: SortOrder
    storedName?: SortOrder
    mimeType?: SortOrderInput | SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkAttachmentCountOrderByAggregateInput
    _avg?: PluginCodingHomeworkAttachmentAvgOrderByAggregateInput
    _max?: PluginCodingHomeworkAttachmentMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkAttachmentMinOrderByAggregateInput
    _sum?: PluginCodingHomeworkAttachmentSumOrderByAggregateInput
  }

  export type PluginCodingHomeworkAttachmentScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkAttachmentScalarWhereWithAggregatesInput | PluginCodingHomeworkAttachmentScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkAttachmentScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkAttachmentScalarWhereWithAggregatesInput | PluginCodingHomeworkAttachmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | string
    ownerKind?: EnumPluginCodingHomeworkAttachmentOwnerKindWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId?: StringWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | string
    kind?: EnumPluginCodingHomeworkAttachmentKindWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | $Enums.PluginCodingHomeworkAttachmentKind
    originalName?: StringWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | string
    storedName?: StringWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | string
    mimeType?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | string | null
    sizeBytes?: BigIntWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | bigint | number
    sha256?: StringWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | string
    metadata?: JsonWithAggregatesFilter<"PluginCodingHomeworkAttachment">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkAttachment"> | Date | string
  }

  export type PluginCodingHomeworkDocumentationSnapshotWhereInput = {
    AND?: PluginCodingHomeworkDocumentationSnapshotWhereInput | PluginCodingHomeworkDocumentationSnapshotWhereInput[]
    OR?: PluginCodingHomeworkDocumentationSnapshotWhereInput[]
    NOT?: PluginCodingHomeworkDocumentationSnapshotWhereInput | PluginCodingHomeworkDocumentationSnapshotWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    activityId?: StringFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    courseId?: StringFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    groupId?: StringNullableFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string | null
    contentTreeAnchorItemId?: StringNullableFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string | null
    contentTreeFingerprint?: StringFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFilter<"PluginCodingHomeworkDocumentationSnapshot"> | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonFilter<"PluginCodingHomeworkDocumentationSnapshot">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkDocumentationSnapshot"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkDocumentationSnapshot"> | Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionListRelationFilter
    submissions?: PluginCodingHomeworkSubmissionListRelationFilter
  }

  export type PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput = {
    id?: SortOrder
    activityId?: SortOrder
    courseId?: SortOrder
    groupId?: SortOrderInput | SortOrder
    contentTreeAnchorItemId?: SortOrderInput | SortOrder
    contentTreeFingerprint?: SortOrder
    status?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionOrderByRelationAggregateInput
    submissions?: PluginCodingHomeworkSubmissionOrderByRelationAggregateInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PluginCodingHomeworkDocumentationSnapshotWhereInput | PluginCodingHomeworkDocumentationSnapshotWhereInput[]
    OR?: PluginCodingHomeworkDocumentationSnapshotWhereInput[]
    NOT?: PluginCodingHomeworkDocumentationSnapshotWhereInput | PluginCodingHomeworkDocumentationSnapshotWhereInput[]
    activityId?: StringFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    courseId?: StringFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    groupId?: StringNullableFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string | null
    contentTreeAnchorItemId?: StringNullableFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string | null
    contentTreeFingerprint?: StringFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFilter<"PluginCodingHomeworkDocumentationSnapshot"> | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonFilter<"PluginCodingHomeworkDocumentationSnapshot">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkDocumentationSnapshot"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkDocumentationSnapshot"> | Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionListRelationFilter
    submissions?: PluginCodingHomeworkSubmissionListRelationFilter
  }, "id">

  export type PluginCodingHomeworkDocumentationSnapshotOrderByWithAggregationInput = {
    id?: SortOrder
    activityId?: SortOrder
    courseId?: SortOrder
    groupId?: SortOrderInput | SortOrder
    contentTreeAnchorItemId?: SortOrderInput | SortOrder
    contentTreeFingerprint?: SortOrder
    status?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkDocumentationSnapshotCountOrderByAggregateInput
    _max?: PluginCodingHomeworkDocumentationSnapshotMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkDocumentationSnapshotMinOrderByAggregateInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkDocumentationSnapshotScalarWhereWithAggregatesInput | PluginCodingHomeworkDocumentationSnapshotScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkDocumentationSnapshotScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkDocumentationSnapshotScalarWhereWithAggregatesInput | PluginCodingHomeworkDocumentationSnapshotScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    activityId?: StringWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    courseId?: StringWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    groupId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string | null
    contentTreeAnchorItemId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string | null
    contentTreeFingerprint?: StringWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | string
    status?: EnumPluginCodingHomeworkSnapshotStatusWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkDocumentationSnapshot"> | Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionWhereInput = {
    AND?: PluginCodingHomeworkReferenceFunctionWhereInput | PluginCodingHomeworkReferenceFunctionWhereInput[]
    OR?: PluginCodingHomeworkReferenceFunctionWhereInput[]
    NOT?: PluginCodingHomeworkReferenceFunctionWhereInput | PluginCodingHomeworkReferenceFunctionWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    snapshotId?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    contentResourceId?: StringNullableFilter<"PluginCodingHomeworkReferenceFunction"> | string | null
    sourceTitle?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    sourceKind?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    languageKey?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    functionName?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    functionCode?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    astText?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    embedding?: JsonFilter<"PluginCodingHomeworkReferenceFunction">
    metadata?: JsonFilter<"PluginCodingHomeworkReferenceFunction">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkReferenceFunction"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkReferenceFunction"> | Date | string
    snapshot?: XOR<PluginCodingHomeworkDocumentationSnapshotRelationFilter, PluginCodingHomeworkDocumentationSnapshotWhereInput>
  }

  export type PluginCodingHomeworkReferenceFunctionOrderByWithRelationInput = {
    id?: SortOrder
    snapshotId?: SortOrder
    contentResourceId?: SortOrderInput | SortOrder
    sourceTitle?: SortOrder
    sourceKind?: SortOrder
    languageKey?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    embedding?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    snapshot?: PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput
  }

  export type PluginCodingHomeworkReferenceFunctionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PluginCodingHomeworkReferenceFunctionWhereInput | PluginCodingHomeworkReferenceFunctionWhereInput[]
    OR?: PluginCodingHomeworkReferenceFunctionWhereInput[]
    NOT?: PluginCodingHomeworkReferenceFunctionWhereInput | PluginCodingHomeworkReferenceFunctionWhereInput[]
    snapshotId?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    contentResourceId?: StringNullableFilter<"PluginCodingHomeworkReferenceFunction"> | string | null
    sourceTitle?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    sourceKind?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    languageKey?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    functionName?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    functionCode?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    astText?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    embedding?: JsonFilter<"PluginCodingHomeworkReferenceFunction">
    metadata?: JsonFilter<"PluginCodingHomeworkReferenceFunction">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkReferenceFunction"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkReferenceFunction"> | Date | string
    snapshot?: XOR<PluginCodingHomeworkDocumentationSnapshotRelationFilter, PluginCodingHomeworkDocumentationSnapshotWhereInput>
  }, "id">

  export type PluginCodingHomeworkReferenceFunctionOrderByWithAggregationInput = {
    id?: SortOrder
    snapshotId?: SortOrder
    contentResourceId?: SortOrderInput | SortOrder
    sourceTitle?: SortOrder
    sourceKind?: SortOrder
    languageKey?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    embedding?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkReferenceFunctionCountOrderByAggregateInput
    _max?: PluginCodingHomeworkReferenceFunctionMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkReferenceFunctionMinOrderByAggregateInput
  }

  export type PluginCodingHomeworkReferenceFunctionScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkReferenceFunctionScalarWhereWithAggregatesInput | PluginCodingHomeworkReferenceFunctionScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkReferenceFunctionScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkReferenceFunctionScalarWhereWithAggregatesInput | PluginCodingHomeworkReferenceFunctionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string
    snapshotId?: StringWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string
    contentResourceId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string | null
    sourceTitle?: StringWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string
    sourceKind?: StringWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string
    languageKey?: StringWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string
    functionName?: StringWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string
    functionCode?: StringWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string
    astText?: StringWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | string
    embedding?: JsonWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction">
    metadata?: JsonWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkReferenceFunction"> | Date | string
  }

  export type PluginCodingHomeworkSubmissionWhereInput = {
    AND?: PluginCodingHomeworkSubmissionWhereInput | PluginCodingHomeworkSubmissionWhereInput[]
    OR?: PluginCodingHomeworkSubmissionWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionWhereInput | PluginCodingHomeworkSubmissionWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    activityId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    groupId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    userId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    coreAttemptId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    documentationSnapshotId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    zipAttachmentId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFilter<"PluginCodingHomeworkSubmission"> | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFilter<"PluginCodingHomeworkSubmission"> | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonFilter<"PluginCodingHomeworkSubmission">
    processingError?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    metadata?: JsonFilter<"PluginCodingHomeworkSubmission">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmission"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkSubmission"> | Date | string
    documentationSnapshot?: XOR<PluginCodingHomeworkDocumentationSnapshotNullableRelationFilter, PluginCodingHomeworkDocumentationSnapshotWhereInput> | null
    files?: PluginCodingHomeworkSubmissionFileListRelationFilter
    functions?: PluginCodingHomeworkSubmissionFunctionListRelationFilter
    questions?: PluginCodingHomeworkChallengeQuestionListRelationFilter
    reviews?: PluginCodingHomeworkReviewListRelationFilter
  }

  export type PluginCodingHomeworkSubmissionOrderByWithRelationInput = {
    id?: SortOrder
    activityId?: SortOrder
    groupId?: SortOrder
    userId?: SortOrder
    coreAttemptId?: SortOrderInput | SortOrder
    documentationSnapshotId?: SortOrderInput | SortOrder
    zipAttachmentId?: SortOrderInput | SortOrder
    kind?: SortOrder
    status?: SortOrder
    structureValidationSummary?: SortOrder
    processingError?: SortOrderInput | SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotOrderByWithRelationInput
    files?: PluginCodingHomeworkSubmissionFileOrderByRelationAggregateInput
    functions?: PluginCodingHomeworkSubmissionFunctionOrderByRelationAggregateInput
    questions?: PluginCodingHomeworkChallengeQuestionOrderByRelationAggregateInput
    reviews?: PluginCodingHomeworkReviewOrderByRelationAggregateInput
  }

  export type PluginCodingHomeworkSubmissionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PluginCodingHomeworkSubmissionWhereInput | PluginCodingHomeworkSubmissionWhereInput[]
    OR?: PluginCodingHomeworkSubmissionWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionWhereInput | PluginCodingHomeworkSubmissionWhereInput[]
    activityId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    groupId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    userId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    coreAttemptId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    documentationSnapshotId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    zipAttachmentId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFilter<"PluginCodingHomeworkSubmission"> | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFilter<"PluginCodingHomeworkSubmission"> | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonFilter<"PluginCodingHomeworkSubmission">
    processingError?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    metadata?: JsonFilter<"PluginCodingHomeworkSubmission">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmission"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkSubmission"> | Date | string
    documentationSnapshot?: XOR<PluginCodingHomeworkDocumentationSnapshotNullableRelationFilter, PluginCodingHomeworkDocumentationSnapshotWhereInput> | null
    files?: PluginCodingHomeworkSubmissionFileListRelationFilter
    functions?: PluginCodingHomeworkSubmissionFunctionListRelationFilter
    questions?: PluginCodingHomeworkChallengeQuestionListRelationFilter
    reviews?: PluginCodingHomeworkReviewListRelationFilter
  }, "id">

  export type PluginCodingHomeworkSubmissionOrderByWithAggregationInput = {
    id?: SortOrder
    activityId?: SortOrder
    groupId?: SortOrder
    userId?: SortOrder
    coreAttemptId?: SortOrderInput | SortOrder
    documentationSnapshotId?: SortOrderInput | SortOrder
    zipAttachmentId?: SortOrderInput | SortOrder
    kind?: SortOrder
    status?: SortOrder
    structureValidationSummary?: SortOrder
    processingError?: SortOrderInput | SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkSubmissionCountOrderByAggregateInput
    _max?: PluginCodingHomeworkSubmissionMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkSubmissionMinOrderByAggregateInput
  }

  export type PluginCodingHomeworkSubmissionScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkSubmissionScalarWhereWithAggregatesInput | PluginCodingHomeworkSubmissionScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkSubmissionScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkSubmissionScalarWhereWithAggregatesInput | PluginCodingHomeworkSubmissionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | string
    activityId?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | string
    groupId?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | string
    userId?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | string
    coreAttemptId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | string | null
    documentationSnapshotId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | string | null
    zipAttachmentId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonWithAggregatesFilter<"PluginCodingHomeworkSubmission">
    processingError?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | string | null
    metadata?: JsonWithAggregatesFilter<"PluginCodingHomeworkSubmission">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkSubmission"> | Date | string
  }

  export type PluginCodingHomeworkSubmissionFileWhereInput = {
    AND?: PluginCodingHomeworkSubmissionFileWhereInput | PluginCodingHomeworkSubmissionFileWhereInput[]
    OR?: PluginCodingHomeworkSubmissionFileWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionFileWhereInput | PluginCodingHomeworkSubmissionFileWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    submissionId?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    path?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    languageKey?: StringNullableFilter<"PluginCodingHomeworkSubmissionFile"> | string | null
    sizeBytes?: BigIntFilter<"PluginCodingHomeworkSubmissionFile"> | bigint | number
    sha256?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    storedName?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    metadata?: JsonFilter<"PluginCodingHomeworkSubmissionFile">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFile"> | Date | string
    submission?: XOR<PluginCodingHomeworkSubmissionRelationFilter, PluginCodingHomeworkSubmissionWhereInput>
    functions?: PluginCodingHomeworkSubmissionFunctionListRelationFilter
  }

  export type PluginCodingHomeworkSubmissionFileOrderByWithRelationInput = {
    id?: SortOrder
    submissionId?: SortOrder
    path?: SortOrder
    languageKey?: SortOrderInput | SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    storedName?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    submission?: PluginCodingHomeworkSubmissionOrderByWithRelationInput
    functions?: PluginCodingHomeworkSubmissionFunctionOrderByRelationAggregateInput
  }

  export type PluginCodingHomeworkSubmissionFileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    submissionId_path?: PluginCodingHomeworkSubmissionFileSubmissionIdPathCompoundUniqueInput
    AND?: PluginCodingHomeworkSubmissionFileWhereInput | PluginCodingHomeworkSubmissionFileWhereInput[]
    OR?: PluginCodingHomeworkSubmissionFileWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionFileWhereInput | PluginCodingHomeworkSubmissionFileWhereInput[]
    submissionId?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    path?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    languageKey?: StringNullableFilter<"PluginCodingHomeworkSubmissionFile"> | string | null
    sizeBytes?: BigIntFilter<"PluginCodingHomeworkSubmissionFile"> | bigint | number
    sha256?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    storedName?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    metadata?: JsonFilter<"PluginCodingHomeworkSubmissionFile">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFile"> | Date | string
    submission?: XOR<PluginCodingHomeworkSubmissionRelationFilter, PluginCodingHomeworkSubmissionWhereInput>
    functions?: PluginCodingHomeworkSubmissionFunctionListRelationFilter
  }, "id" | "submissionId_path">

  export type PluginCodingHomeworkSubmissionFileOrderByWithAggregationInput = {
    id?: SortOrder
    submissionId?: SortOrder
    path?: SortOrder
    languageKey?: SortOrderInput | SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    storedName?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    _count?: PluginCodingHomeworkSubmissionFileCountOrderByAggregateInput
    _avg?: PluginCodingHomeworkSubmissionFileAvgOrderByAggregateInput
    _max?: PluginCodingHomeworkSubmissionFileMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkSubmissionFileMinOrderByAggregateInput
    _sum?: PluginCodingHomeworkSubmissionFileSumOrderByAggregateInput
  }

  export type PluginCodingHomeworkSubmissionFileScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkSubmissionFileScalarWhereWithAggregatesInput | PluginCodingHomeworkSubmissionFileScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkSubmissionFileScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkSubmissionFileScalarWhereWithAggregatesInput | PluginCodingHomeworkSubmissionFileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile"> | string
    submissionId?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile"> | string
    path?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile"> | string
    languageKey?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile"> | string | null
    sizeBytes?: BigIntWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile"> | bigint | number
    sha256?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile"> | string
    storedName?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile"> | string
    metadata?: JsonWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkSubmissionFile"> | Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionWhereInput = {
    AND?: PluginCodingHomeworkSubmissionFunctionWhereInput | PluginCodingHomeworkSubmissionFunctionWhereInput[]
    OR?: PluginCodingHomeworkSubmissionFunctionWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionFunctionWhereInput | PluginCodingHomeworkSubmissionFunctionWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    submissionId?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    fileId?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    functionName?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    functionCode?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    astText?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    embedding?: JsonFilter<"PluginCodingHomeworkSubmissionFunction">
    nearestExamples?: JsonFilter<"PluginCodingHomeworkSubmissionFunction">
    divergenceScore?: FloatNullableFilter<"PluginCodingHomeworkSubmissionFunction"> | number | null
    selectedForQuestion?: BoolFilter<"PluginCodingHomeworkSubmissionFunction"> | boolean
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFunction"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFunction"> | Date | string
    submission?: XOR<PluginCodingHomeworkSubmissionRelationFilter, PluginCodingHomeworkSubmissionWhereInput>
    file?: XOR<PluginCodingHomeworkSubmissionFileRelationFilter, PluginCodingHomeworkSubmissionFileWhereInput>
    questions?: PluginCodingHomeworkChallengeQuestionListRelationFilter
  }

  export type PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput = {
    id?: SortOrder
    submissionId?: SortOrder
    fileId?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    embedding?: SortOrder
    nearestExamples?: SortOrder
    divergenceScore?: SortOrderInput | SortOrder
    selectedForQuestion?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    submission?: PluginCodingHomeworkSubmissionOrderByWithRelationInput
    file?: PluginCodingHomeworkSubmissionFileOrderByWithRelationInput
    questions?: PluginCodingHomeworkChallengeQuestionOrderByRelationAggregateInput
  }

  export type PluginCodingHomeworkSubmissionFunctionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PluginCodingHomeworkSubmissionFunctionWhereInput | PluginCodingHomeworkSubmissionFunctionWhereInput[]
    OR?: PluginCodingHomeworkSubmissionFunctionWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionFunctionWhereInput | PluginCodingHomeworkSubmissionFunctionWhereInput[]
    submissionId?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    fileId?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    functionName?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    functionCode?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    astText?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    embedding?: JsonFilter<"PluginCodingHomeworkSubmissionFunction">
    nearestExamples?: JsonFilter<"PluginCodingHomeworkSubmissionFunction">
    divergenceScore?: FloatNullableFilter<"PluginCodingHomeworkSubmissionFunction"> | number | null
    selectedForQuestion?: BoolFilter<"PluginCodingHomeworkSubmissionFunction"> | boolean
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFunction"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFunction"> | Date | string
    submission?: XOR<PluginCodingHomeworkSubmissionRelationFilter, PluginCodingHomeworkSubmissionWhereInput>
    file?: XOR<PluginCodingHomeworkSubmissionFileRelationFilter, PluginCodingHomeworkSubmissionFileWhereInput>
    questions?: PluginCodingHomeworkChallengeQuestionListRelationFilter
  }, "id">

  export type PluginCodingHomeworkSubmissionFunctionOrderByWithAggregationInput = {
    id?: SortOrder
    submissionId?: SortOrder
    fileId?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    embedding?: SortOrder
    nearestExamples?: SortOrder
    divergenceScore?: SortOrderInput | SortOrder
    selectedForQuestion?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkSubmissionFunctionCountOrderByAggregateInput
    _avg?: PluginCodingHomeworkSubmissionFunctionAvgOrderByAggregateInput
    _max?: PluginCodingHomeworkSubmissionFunctionMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkSubmissionFunctionMinOrderByAggregateInput
    _sum?: PluginCodingHomeworkSubmissionFunctionSumOrderByAggregateInput
  }

  export type PluginCodingHomeworkSubmissionFunctionScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkSubmissionFunctionScalarWhereWithAggregatesInput | PluginCodingHomeworkSubmissionFunctionScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkSubmissionFunctionScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkSubmissionFunctionScalarWhereWithAggregatesInput | PluginCodingHomeworkSubmissionFunctionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    submissionId?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    fileId?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    functionName?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    functionCode?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    astText?: StringWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    embedding?: JsonWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction">
    nearestExamples?: JsonWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction">
    divergenceScore?: FloatNullableWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | number | null
    selectedForQuestion?: BoolWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkSubmissionFunction"> | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionWhereInput = {
    AND?: PluginCodingHomeworkChallengeQuestionWhereInput | PluginCodingHomeworkChallengeQuestionWhereInput[]
    OR?: PluginCodingHomeworkChallengeQuestionWhereInput[]
    NOT?: PluginCodingHomeworkChallengeQuestionWhereInput | PluginCodingHomeworkChallengeQuestionWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    submissionId?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    submissionFunctionId?: StringNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | string | null
    orderIndex?: IntFilter<"PluginCodingHomeworkChallengeQuestion"> | number
    questionText?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    studentAnswer?: StringNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | string | null
    answerSubmittedAt?: DateTimeNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string | null
    generationModel?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    generationPromptVersion?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    nearestExamples?: JsonFilter<"PluginCodingHomeworkChallengeQuestion">
    metadata?: JsonFilter<"PluginCodingHomeworkChallengeQuestion">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string
    submission?: XOR<PluginCodingHomeworkSubmissionRelationFilter, PluginCodingHomeworkSubmissionWhereInput>
    submissionFunction?: XOR<PluginCodingHomeworkSubmissionFunctionNullableRelationFilter, PluginCodingHomeworkSubmissionFunctionWhereInput> | null
  }

  export type PluginCodingHomeworkChallengeQuestionOrderByWithRelationInput = {
    id?: SortOrder
    submissionId?: SortOrder
    submissionFunctionId?: SortOrderInput | SortOrder
    orderIndex?: SortOrder
    questionText?: SortOrder
    studentAnswer?: SortOrderInput | SortOrder
    answerSubmittedAt?: SortOrderInput | SortOrder
    generationModel?: SortOrder
    generationPromptVersion?: SortOrder
    nearestExamples?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    submission?: PluginCodingHomeworkSubmissionOrderByWithRelationInput
    submissionFunction?: PluginCodingHomeworkSubmissionFunctionOrderByWithRelationInput
  }

  export type PluginCodingHomeworkChallengeQuestionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    submissionId_orderIndex?: PluginCodingHomeworkChallengeQuestionSubmissionIdOrderIndexCompoundUniqueInput
    AND?: PluginCodingHomeworkChallengeQuestionWhereInput | PluginCodingHomeworkChallengeQuestionWhereInput[]
    OR?: PluginCodingHomeworkChallengeQuestionWhereInput[]
    NOT?: PluginCodingHomeworkChallengeQuestionWhereInput | PluginCodingHomeworkChallengeQuestionWhereInput[]
    submissionId?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    submissionFunctionId?: StringNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | string | null
    orderIndex?: IntFilter<"PluginCodingHomeworkChallengeQuestion"> | number
    questionText?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    studentAnswer?: StringNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | string | null
    answerSubmittedAt?: DateTimeNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string | null
    generationModel?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    generationPromptVersion?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    nearestExamples?: JsonFilter<"PluginCodingHomeworkChallengeQuestion">
    metadata?: JsonFilter<"PluginCodingHomeworkChallengeQuestion">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string
    submission?: XOR<PluginCodingHomeworkSubmissionRelationFilter, PluginCodingHomeworkSubmissionWhereInput>
    submissionFunction?: XOR<PluginCodingHomeworkSubmissionFunctionNullableRelationFilter, PluginCodingHomeworkSubmissionFunctionWhereInput> | null
  }, "id" | "submissionId_orderIndex">

  export type PluginCodingHomeworkChallengeQuestionOrderByWithAggregationInput = {
    id?: SortOrder
    submissionId?: SortOrder
    submissionFunctionId?: SortOrderInput | SortOrder
    orderIndex?: SortOrder
    questionText?: SortOrder
    studentAnswer?: SortOrderInput | SortOrder
    answerSubmittedAt?: SortOrderInput | SortOrder
    generationModel?: SortOrder
    generationPromptVersion?: SortOrder
    nearestExamples?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkChallengeQuestionCountOrderByAggregateInput
    _avg?: PluginCodingHomeworkChallengeQuestionAvgOrderByAggregateInput
    _max?: PluginCodingHomeworkChallengeQuestionMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkChallengeQuestionMinOrderByAggregateInput
    _sum?: PluginCodingHomeworkChallengeQuestionSumOrderByAggregateInput
  }

  export type PluginCodingHomeworkChallengeQuestionScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkChallengeQuestionScalarWhereWithAggregatesInput | PluginCodingHomeworkChallengeQuestionScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkChallengeQuestionScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkChallengeQuestionScalarWhereWithAggregatesInput | PluginCodingHomeworkChallengeQuestionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    submissionId?: StringWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    submissionFunctionId?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | string | null
    orderIndex?: IntWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | number
    questionText?: StringWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    studentAnswer?: StringNullableWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | string | null
    answerSubmittedAt?: DateTimeNullableWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string | null
    generationModel?: StringWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    generationPromptVersion?: StringWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    nearestExamples?: JsonWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion">
    metadata?: JsonWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string
  }

  export type PluginCodingHomeworkReviewWhereInput = {
    AND?: PluginCodingHomeworkReviewWhereInput | PluginCodingHomeworkReviewWhereInput[]
    OR?: PluginCodingHomeworkReviewWhereInput[]
    NOT?: PluginCodingHomeworkReviewWhereInput | PluginCodingHomeworkReviewWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkReview"> | string
    submissionId?: StringFilter<"PluginCodingHomeworkReview"> | string
    reviewerUserId?: StringFilter<"PluginCodingHomeworkReview"> | string
    score?: FloatNullableFilter<"PluginCodingHomeworkReview"> | number | null
    maxScore?: FloatNullableFilter<"PluginCodingHomeworkReview"> | number | null
    feedback?: StringFilter<"PluginCodingHomeworkReview"> | string
    rubric?: JsonFilter<"PluginCodingHomeworkReview">
    metadata?: JsonFilter<"PluginCodingHomeworkReview">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkReview"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkReview"> | Date | string
    submission?: XOR<PluginCodingHomeworkSubmissionRelationFilter, PluginCodingHomeworkSubmissionWhereInput>
  }

  export type PluginCodingHomeworkReviewOrderByWithRelationInput = {
    id?: SortOrder
    submissionId?: SortOrder
    reviewerUserId?: SortOrder
    score?: SortOrderInput | SortOrder
    maxScore?: SortOrderInput | SortOrder
    feedback?: SortOrder
    rubric?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    submission?: PluginCodingHomeworkSubmissionOrderByWithRelationInput
  }

  export type PluginCodingHomeworkReviewWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PluginCodingHomeworkReviewWhereInput | PluginCodingHomeworkReviewWhereInput[]
    OR?: PluginCodingHomeworkReviewWhereInput[]
    NOT?: PluginCodingHomeworkReviewWhereInput | PluginCodingHomeworkReviewWhereInput[]
    submissionId?: StringFilter<"PluginCodingHomeworkReview"> | string
    reviewerUserId?: StringFilter<"PluginCodingHomeworkReview"> | string
    score?: FloatNullableFilter<"PluginCodingHomeworkReview"> | number | null
    maxScore?: FloatNullableFilter<"PluginCodingHomeworkReview"> | number | null
    feedback?: StringFilter<"PluginCodingHomeworkReview"> | string
    rubric?: JsonFilter<"PluginCodingHomeworkReview">
    metadata?: JsonFilter<"PluginCodingHomeworkReview">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkReview"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkReview"> | Date | string
    submission?: XOR<PluginCodingHomeworkSubmissionRelationFilter, PluginCodingHomeworkSubmissionWhereInput>
  }, "id">

  export type PluginCodingHomeworkReviewOrderByWithAggregationInput = {
    id?: SortOrder
    submissionId?: SortOrder
    reviewerUserId?: SortOrder
    score?: SortOrderInput | SortOrder
    maxScore?: SortOrderInput | SortOrder
    feedback?: SortOrder
    rubric?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: PluginCodingHomeworkReviewCountOrderByAggregateInput
    _avg?: PluginCodingHomeworkReviewAvgOrderByAggregateInput
    _max?: PluginCodingHomeworkReviewMaxOrderByAggregateInput
    _min?: PluginCodingHomeworkReviewMinOrderByAggregateInput
    _sum?: PluginCodingHomeworkReviewSumOrderByAggregateInput
  }

  export type PluginCodingHomeworkReviewScalarWhereWithAggregatesInput = {
    AND?: PluginCodingHomeworkReviewScalarWhereWithAggregatesInput | PluginCodingHomeworkReviewScalarWhereWithAggregatesInput[]
    OR?: PluginCodingHomeworkReviewScalarWhereWithAggregatesInput[]
    NOT?: PluginCodingHomeworkReviewScalarWhereWithAggregatesInput | PluginCodingHomeworkReviewScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PluginCodingHomeworkReview"> | string
    submissionId?: StringWithAggregatesFilter<"PluginCodingHomeworkReview"> | string
    reviewerUserId?: StringWithAggregatesFilter<"PluginCodingHomeworkReview"> | string
    score?: FloatNullableWithAggregatesFilter<"PluginCodingHomeworkReview"> | number | null
    maxScore?: FloatNullableWithAggregatesFilter<"PluginCodingHomeworkReview"> | number | null
    feedback?: StringWithAggregatesFilter<"PluginCodingHomeworkReview"> | string
    rubric?: JsonWithAggregatesFilter<"PluginCodingHomeworkReview">
    metadata?: JsonWithAggregatesFilter<"PluginCodingHomeworkReview">
    createdAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkReview"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"PluginCodingHomeworkReview"> | Date | string
  }

  export type PluginCodingHomeworkAssignmentCreateInput = {
    id?: string
    activityId: string
    promptMarkdown?: string
    promptPdfAttachmentId?: string | null
    languageKey?: string
    candidateLimit?: number
    retrievedExampleCount?: number
    questionCount?: number
    generationInstructions?: string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkAssignmentUncheckedCreateInput = {
    id?: string
    activityId: string
    promptMarkdown?: string
    promptPdfAttachmentId?: string | null
    languageKey?: string
    candidateLimit?: number
    retrievedExampleCount?: number
    questionCount?: number
    generationInstructions?: string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkAssignmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    promptMarkdown?: StringFieldUpdateOperationsInput | string
    promptPdfAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    languageKey?: StringFieldUpdateOperationsInput | string
    candidateLimit?: IntFieldUpdateOperationsInput | number
    retrievedExampleCount?: IntFieldUpdateOperationsInput | number
    questionCount?: IntFieldUpdateOperationsInput | number
    generationInstructions?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkAssignmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    promptMarkdown?: StringFieldUpdateOperationsInput | string
    promptPdfAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    languageKey?: StringFieldUpdateOperationsInput | string
    candidateLimit?: IntFieldUpdateOperationsInput | number
    retrievedExampleCount?: IntFieldUpdateOperationsInput | number
    questionCount?: IntFieldUpdateOperationsInput | number
    generationInstructions?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkAssignmentCreateManyInput = {
    id?: string
    activityId: string
    promptMarkdown?: string
    promptPdfAttachmentId?: string | null
    languageKey?: string
    candidateLimit?: number
    retrievedExampleCount?: number
    questionCount?: number
    generationInstructions?: string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkAssignmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    promptMarkdown?: StringFieldUpdateOperationsInput | string
    promptPdfAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    languageKey?: StringFieldUpdateOperationsInput | string
    candidateLimit?: IntFieldUpdateOperationsInput | number
    retrievedExampleCount?: IntFieldUpdateOperationsInput | number
    questionCount?: IntFieldUpdateOperationsInput | number
    generationInstructions?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkAssignmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    promptMarkdown?: StringFieldUpdateOperationsInput | string
    promptPdfAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    languageKey?: StringFieldUpdateOperationsInput | string
    candidateLimit?: IntFieldUpdateOperationsInput | number
    retrievedExampleCount?: IntFieldUpdateOperationsInput | number
    questionCount?: IntFieldUpdateOperationsInput | number
    generationInstructions?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginBankCodingHomeworkAssignmentCreateInput = {
    id?: string
    bankActivityId: string
    promptMarkdown?: string
    promptPdfAttachmentId?: string | null
    languageKey?: string
    candidateLimit?: number
    retrievedExampleCount?: number
    questionCount?: number
    generationInstructions?: string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginBankCodingHomeworkAssignmentUncheckedCreateInput = {
    id?: string
    bankActivityId: string
    promptMarkdown?: string
    promptPdfAttachmentId?: string | null
    languageKey?: string
    candidateLimit?: number
    retrievedExampleCount?: number
    questionCount?: number
    generationInstructions?: string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginBankCodingHomeworkAssignmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankActivityId?: StringFieldUpdateOperationsInput | string
    promptMarkdown?: StringFieldUpdateOperationsInput | string
    promptPdfAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    languageKey?: StringFieldUpdateOperationsInput | string
    candidateLimit?: IntFieldUpdateOperationsInput | number
    retrievedExampleCount?: IntFieldUpdateOperationsInput | number
    questionCount?: IntFieldUpdateOperationsInput | number
    generationInstructions?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginBankCodingHomeworkAssignmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankActivityId?: StringFieldUpdateOperationsInput | string
    promptMarkdown?: StringFieldUpdateOperationsInput | string
    promptPdfAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    languageKey?: StringFieldUpdateOperationsInput | string
    candidateLimit?: IntFieldUpdateOperationsInput | number
    retrievedExampleCount?: IntFieldUpdateOperationsInput | number
    questionCount?: IntFieldUpdateOperationsInput | number
    generationInstructions?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginBankCodingHomeworkAssignmentCreateManyInput = {
    id?: string
    bankActivityId: string
    promptMarkdown?: string
    promptPdfAttachmentId?: string | null
    languageKey?: string
    candidateLimit?: number
    retrievedExampleCount?: number
    questionCount?: number
    generationInstructions?: string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginBankCodingHomeworkAssignmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankActivityId?: StringFieldUpdateOperationsInput | string
    promptMarkdown?: StringFieldUpdateOperationsInput | string
    promptPdfAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    languageKey?: StringFieldUpdateOperationsInput | string
    candidateLimit?: IntFieldUpdateOperationsInput | number
    retrievedExampleCount?: IntFieldUpdateOperationsInput | number
    questionCount?: IntFieldUpdateOperationsInput | number
    generationInstructions?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginBankCodingHomeworkAssignmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankActivityId?: StringFieldUpdateOperationsInput | string
    promptMarkdown?: StringFieldUpdateOperationsInput | string
    promptPdfAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    languageKey?: StringFieldUpdateOperationsInput | string
    candidateLimit?: IntFieldUpdateOperationsInput | number
    retrievedExampleCount?: IntFieldUpdateOperationsInput | number
    questionCount?: IntFieldUpdateOperationsInput | number
    generationInstructions?: StringFieldUpdateOperationsInput | string
    settings?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetCreateInput = {
    id?: string
    activityId: string
    languageKey?: string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetUncheckedCreateInput = {
    id?: string
    activityId: string
    languageKey?: string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetCreateManyInput = {
    id?: string
    activityId: string
    languageKey?: string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionRequirementSetUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetCreateInput = {
    id?: string
    bankActivityId: string
    languageKey?: string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetUncheckedCreateInput = {
    id?: string
    bankActivityId: string
    languageKey?: string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankActivityId?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankActivityId?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetCreateManyInput = {
    id?: string
    bankActivityId: string
    languageKey?: string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankActivityId?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bankActivityId?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    requirements?: JsonNullValueInput | InputJsonValue
    sourceAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkAttachmentCreateInput = {
    id?: string
    ownerKind: $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId: string
    kind: $Enums.PluginCodingHomeworkAttachmentKind
    originalName: string
    storedName: string
    mimeType?: string | null
    sizeBytes: bigint | number
    sha256: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkAttachmentUncheckedCreateInput = {
    id?: string
    ownerKind: $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId: string
    kind: $Enums.PluginCodingHomeworkAttachmentKind
    originalName: string
    storedName: string
    mimeType?: string | null
    sizeBytes: bigint | number
    sha256: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkAttachmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerKind?: EnumPluginCodingHomeworkAttachmentOwnerKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId?: StringFieldUpdateOperationsInput | string
    kind?: EnumPluginCodingHomeworkAttachmentKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkAttachmentKind
    originalName?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkAttachmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerKind?: EnumPluginCodingHomeworkAttachmentOwnerKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId?: StringFieldUpdateOperationsInput | string
    kind?: EnumPluginCodingHomeworkAttachmentKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkAttachmentKind
    originalName?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkAttachmentCreateManyInput = {
    id?: string
    ownerKind: $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId: string
    kind: $Enums.PluginCodingHomeworkAttachmentKind
    originalName: string
    storedName: string
    mimeType?: string | null
    sizeBytes: bigint | number
    sha256: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkAttachmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerKind?: EnumPluginCodingHomeworkAttachmentOwnerKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId?: StringFieldUpdateOperationsInput | string
    kind?: EnumPluginCodingHomeworkAttachmentKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkAttachmentKind
    originalName?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkAttachmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    ownerKind?: EnumPluginCodingHomeworkAttachmentOwnerKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    ownerId?: StringFieldUpdateOperationsInput | string
    kind?: EnumPluginCodingHomeworkAttachmentKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkAttachmentKind
    originalName?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    mimeType?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkDocumentationSnapshotCreateInput = {
    id?: string
    activityId: string
    courseId: string
    groupId?: string | null
    contentTreeAnchorItemId?: string | null
    contentTreeFingerprint?: string
    status?: $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionCreateNestedManyWithoutSnapshotInput
    submissions?: PluginCodingHomeworkSubmissionCreateNestedManyWithoutDocumentationSnapshotInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUncheckedCreateInput = {
    id?: string
    activityId: string
    courseId: string
    groupId?: string | null
    contentTreeAnchorItemId?: string | null
    contentTreeFingerprint?: string
    status?: $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionUncheckedCreateNestedManyWithoutSnapshotInput
    submissions?: PluginCodingHomeworkSubmissionUncheckedCreateNestedManyWithoutDocumentationSnapshotInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
    groupId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeAnchorItemId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeFingerprint?: StringFieldUpdateOperationsInput | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionUpdateManyWithoutSnapshotNestedInput
    submissions?: PluginCodingHomeworkSubmissionUpdateManyWithoutDocumentationSnapshotNestedInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
    groupId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeAnchorItemId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeFingerprint?: StringFieldUpdateOperationsInput | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionUncheckedUpdateManyWithoutSnapshotNestedInput
    submissions?: PluginCodingHomeworkSubmissionUncheckedUpdateManyWithoutDocumentationSnapshotNestedInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotCreateManyInput = {
    id?: string
    activityId: string
    courseId: string
    groupId?: string | null
    contentTreeAnchorItemId?: string | null
    contentTreeFingerprint?: string
    status?: $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
    groupId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeAnchorItemId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeFingerprint?: StringFieldUpdateOperationsInput | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
    groupId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeAnchorItemId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeFingerprint?: StringFieldUpdateOperationsInput | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionCreateInput = {
    id?: string
    contentResourceId?: string | null
    sourceTitle: string
    sourceKind: string
    languageKey: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    snapshot: PluginCodingHomeworkDocumentationSnapshotCreateNestedOneWithoutReferenceFunctionsInput
  }

  export type PluginCodingHomeworkReferenceFunctionUncheckedCreateInput = {
    id?: string
    snapshotId: string
    contentResourceId?: string | null
    sourceTitle: string
    sourceKind: string
    languageKey: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    contentResourceId?: NullableStringFieldUpdateOperationsInput | string | null
    sourceTitle?: StringFieldUpdateOperationsInput | string
    sourceKind?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    snapshot?: PluginCodingHomeworkDocumentationSnapshotUpdateOneRequiredWithoutReferenceFunctionsNestedInput
  }

  export type PluginCodingHomeworkReferenceFunctionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    snapshotId?: StringFieldUpdateOperationsInput | string
    contentResourceId?: NullableStringFieldUpdateOperationsInput | string | null
    sourceTitle?: StringFieldUpdateOperationsInput | string
    sourceKind?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionCreateManyInput = {
    id?: string
    snapshotId: string
    contentResourceId?: string | null
    sourceTitle: string
    sourceKind: string
    languageKey: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    contentResourceId?: NullableStringFieldUpdateOperationsInput | string | null
    sourceTitle?: StringFieldUpdateOperationsInput | string
    sourceKind?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    snapshotId?: StringFieldUpdateOperationsInput | string
    contentResourceId?: NullableStringFieldUpdateOperationsInput | string | null
    sourceTitle?: StringFieldUpdateOperationsInput | string
    sourceKind?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionCreateInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotCreateNestedOneWithoutSubmissionsInput
    files?: PluginCodingHomeworkSubmissionFileCreateNestedManyWithoutSubmissionInput
    functions?: PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedCreateInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    documentationSnapshotId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedCreateNestedManyWithoutSubmissionInput
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewUncheckedCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotUpdateOneWithoutSubmissionsNestedInput
    files?: PluginCodingHomeworkSubmissionFileUpdateManyWithoutSubmissionNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    documentationSnapshotId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedUpdateManyWithoutSubmissionNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUncheckedUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionCreateManyInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    documentationSnapshotId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    documentationSnapshotId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionFileCreateInput = {
    id?: string
    path: string
    languageKey?: string | null
    sizeBytes: bigint | number
    sha256: string
    storedName: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    submission: PluginCodingHomeworkSubmissionCreateNestedOneWithoutFilesInput
    functions?: PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutFileInput
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedCreateInput = {
    id?: string
    submissionId: string
    path: string
    languageKey?: string | null
    sizeBytes: bigint | number
    sha256: string
    storedName: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutFileInput
  }

  export type PluginCodingHomeworkSubmissionFileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submission?: PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutFilesNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutFileNestedInput
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutFileNestedInput
  }

  export type PluginCodingHomeworkSubmissionFileCreateManyInput = {
    id?: string
    submissionId: string
    path: string
    languageKey?: string | null
    sizeBytes: bigint | number
    sha256: string
    storedName: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionFileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateInput = {
    id?: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    submission: PluginCodingHomeworkSubmissionCreateNestedOneWithoutFunctionsInput
    file: PluginCodingHomeworkSubmissionFileCreateNestedOneWithoutFunctionsInput
    questions?: PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionFunctionInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedCreateInput = {
    id?: string
    submissionId: string
    fileId: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionFunctionInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submission?: PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutFunctionsNestedInput
    file?: PluginCodingHomeworkSubmissionFileUpdateOneRequiredWithoutFunctionsNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionFunctionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionFunctionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateManyInput = {
    id?: string
    submissionId: string
    fileId: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionCreateInput = {
    id?: string
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    submission: PluginCodingHomeworkSubmissionCreateNestedOneWithoutQuestionsInput
    submissionFunction?: PluginCodingHomeworkSubmissionFunctionCreateNestedOneWithoutQuestionsInput
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedCreateInput = {
    id?: string
    submissionId: string
    submissionFunctionId?: string | null
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submission?: PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutQuestionsNestedInput
    submissionFunction?: PluginCodingHomeworkSubmissionFunctionUpdateOneWithoutQuestionsNestedInput
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    submissionFunctionId?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionCreateManyInput = {
    id?: string
    submissionId: string
    submissionFunctionId?: string | null
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    submissionFunctionId?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReviewCreateInput = {
    id?: string
    reviewerUserId: string
    score?: number | null
    maxScore?: number | null
    feedback?: string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    submission: PluginCodingHomeworkSubmissionCreateNestedOneWithoutReviewsInput
  }

  export type PluginCodingHomeworkReviewUncheckedCreateInput = {
    id?: string
    submissionId: string
    reviewerUserId: string
    score?: number | null
    maxScore?: number | null
    feedback?: string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReviewUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    reviewerUserId?: StringFieldUpdateOperationsInput | string
    score?: NullableFloatFieldUpdateOperationsInput | number | null
    maxScore?: NullableFloatFieldUpdateOperationsInput | number | null
    feedback?: StringFieldUpdateOperationsInput | string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submission?: PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutReviewsNestedInput
  }

  export type PluginCodingHomeworkReviewUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    reviewerUserId?: StringFieldUpdateOperationsInput | string
    score?: NullableFloatFieldUpdateOperationsInput | number | null
    maxScore?: NullableFloatFieldUpdateOperationsInput | number | null
    feedback?: StringFieldUpdateOperationsInput | string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReviewCreateManyInput = {
    id?: string
    submissionId: string
    reviewerUserId: string
    score?: number | null
    maxScore?: number | null
    feedback?: string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReviewUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    reviewerUserId?: StringFieldUpdateOperationsInput | string
    score?: NullableFloatFieldUpdateOperationsInput | number | null
    maxScore?: NullableFloatFieldUpdateOperationsInput | number | null
    feedback?: StringFieldUpdateOperationsInput | string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReviewUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    reviewerUserId?: StringFieldUpdateOperationsInput | string
    score?: NullableFloatFieldUpdateOperationsInput | number | null
    maxScore?: NullableFloatFieldUpdateOperationsInput | number | null
    feedback?: StringFieldUpdateOperationsInput | string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }
  export type JsonFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type PluginCodingHomeworkAssignmentCountOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    settings?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkAssignmentAvgOrderByAggregateInput = {
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
  }

  export type PluginCodingHomeworkAssignmentMaxOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkAssignmentMinOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkAssignmentSumOrderByAggregateInput = {
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type PluginBankCodingHomeworkAssignmentCountOrderByAggregateInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    settings?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginBankCodingHomeworkAssignmentAvgOrderByAggregateInput = {
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
  }

  export type PluginBankCodingHomeworkAssignmentMaxOrderByAggregateInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginBankCodingHomeworkAssignmentMinOrderByAggregateInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    promptMarkdown?: SortOrder
    promptPdfAttachmentId?: SortOrder
    languageKey?: SortOrder
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
    generationInstructions?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginBankCodingHomeworkAssignmentSumOrderByAggregateInput = {
    candidateLimit?: SortOrder
    retrievedExampleCount?: SortOrder
    questionCount?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionRequirementSetCountOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    languageKey?: SortOrder
    requirements?: SortOrder
    sourceAttachmentId?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionRequirementSetMaxOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    languageKey?: SortOrder
    sourceAttachmentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionRequirementSetMinOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    languageKey?: SortOrder
    sourceAttachmentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetCountOrderByAggregateInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    languageKey?: SortOrder
    requirements?: SortOrder
    sourceAttachmentId?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetMaxOrderByAggregateInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    languageKey?: SortOrder
    sourceAttachmentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginBankCodingHomeworkSubmissionRequirementSetMinOrderByAggregateInput = {
    id?: SortOrder
    bankActivityId?: SortOrder
    languageKey?: SortOrder
    sourceAttachmentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumPluginCodingHomeworkAttachmentOwnerKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkAttachmentOwnerKind | EnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkAttachmentOwnerKind[] | ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkAttachmentOwnerKind[] | ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkAttachmentOwnerKindFilter<$PrismaModel> | $Enums.PluginCodingHomeworkAttachmentOwnerKind
  }

  export type EnumPluginCodingHomeworkAttachmentKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkAttachmentKind | EnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkAttachmentKind[] | ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkAttachmentKind[] | ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkAttachmentKindFilter<$PrismaModel> | $Enums.PluginCodingHomeworkAttachmentKind
  }

  export type BigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type PluginCodingHomeworkAttachmentCountOrderByAggregateInput = {
    id?: SortOrder
    ownerKind?: SortOrder
    ownerId?: SortOrder
    kind?: SortOrder
    originalName?: SortOrder
    storedName?: SortOrder
    mimeType?: SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkAttachmentAvgOrderByAggregateInput = {
    sizeBytes?: SortOrder
  }

  export type PluginCodingHomeworkAttachmentMaxOrderByAggregateInput = {
    id?: SortOrder
    ownerKind?: SortOrder
    ownerId?: SortOrder
    kind?: SortOrder
    originalName?: SortOrder
    storedName?: SortOrder
    mimeType?: SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkAttachmentMinOrderByAggregateInput = {
    id?: SortOrder
    ownerKind?: SortOrder
    ownerId?: SortOrder
    kind?: SortOrder
    originalName?: SortOrder
    storedName?: SortOrder
    mimeType?: SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkAttachmentSumOrderByAggregateInput = {
    sizeBytes?: SortOrder
  }

  export type EnumPluginCodingHomeworkAttachmentOwnerKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkAttachmentOwnerKind | EnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkAttachmentOwnerKind[] | ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkAttachmentOwnerKind[] | ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkAttachmentOwnerKindWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkAttachmentOwnerKindFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkAttachmentOwnerKindFilter<$PrismaModel>
  }

  export type EnumPluginCodingHomeworkAttachmentKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkAttachmentKind | EnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkAttachmentKind[] | ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkAttachmentKind[] | ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkAttachmentKindWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkAttachmentKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkAttachmentKindFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkAttachmentKindFilter<$PrismaModel>
  }

  export type BigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type EnumPluginCodingHomeworkSnapshotStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSnapshotStatus | EnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSnapshotStatus[] | ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSnapshotStatus[] | ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSnapshotStatusFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSnapshotStatus
  }

  export type PluginCodingHomeworkReferenceFunctionListRelationFilter = {
    every?: PluginCodingHomeworkReferenceFunctionWhereInput
    some?: PluginCodingHomeworkReferenceFunctionWhereInput
    none?: PluginCodingHomeworkReferenceFunctionWhereInput
  }

  export type PluginCodingHomeworkSubmissionListRelationFilter = {
    every?: PluginCodingHomeworkSubmissionWhereInput
    some?: PluginCodingHomeworkSubmissionWhereInput
    none?: PluginCodingHomeworkSubmissionWhereInput
  }

  export type PluginCodingHomeworkReferenceFunctionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PluginCodingHomeworkDocumentationSnapshotCountOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    courseId?: SortOrder
    groupId?: SortOrder
    contentTreeAnchorItemId?: SortOrder
    contentTreeFingerprint?: SortOrder
    status?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkDocumentationSnapshotMaxOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    courseId?: SortOrder
    groupId?: SortOrder
    contentTreeAnchorItemId?: SortOrder
    contentTreeFingerprint?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkDocumentationSnapshotMinOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    courseId?: SortOrder
    groupId?: SortOrder
    contentTreeAnchorItemId?: SortOrder
    contentTreeFingerprint?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumPluginCodingHomeworkSnapshotStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSnapshotStatus | EnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSnapshotStatus[] | ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSnapshotStatus[] | ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSnapshotStatusWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSnapshotStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkSnapshotStatusFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkSnapshotStatusFilter<$PrismaModel>
  }

  export type PluginCodingHomeworkDocumentationSnapshotRelationFilter = {
    is?: PluginCodingHomeworkDocumentationSnapshotWhereInput
    isNot?: PluginCodingHomeworkDocumentationSnapshotWhereInput
  }

  export type PluginCodingHomeworkReferenceFunctionCountOrderByAggregateInput = {
    id?: SortOrder
    snapshotId?: SortOrder
    contentResourceId?: SortOrder
    sourceTitle?: SortOrder
    sourceKind?: SortOrder
    languageKey?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    embedding?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkReferenceFunctionMaxOrderByAggregateInput = {
    id?: SortOrder
    snapshotId?: SortOrder
    contentResourceId?: SortOrder
    sourceTitle?: SortOrder
    sourceKind?: SortOrder
    languageKey?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkReferenceFunctionMinOrderByAggregateInput = {
    id?: SortOrder
    snapshotId?: SortOrder
    contentResourceId?: SortOrder
    sourceTitle?: SortOrder
    sourceKind?: SortOrder
    languageKey?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumPluginCodingHomeworkSubmissionKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSubmissionKind | EnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSubmissionKind[] | ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSubmissionKind[] | ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSubmissionKindFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSubmissionKind
  }

  export type EnumPluginCodingHomeworkSubmissionStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSubmissionStatus | EnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSubmissionStatus[] | ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSubmissionStatus[] | ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSubmissionStatusFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSubmissionStatus
  }

  export type PluginCodingHomeworkDocumentationSnapshotNullableRelationFilter = {
    is?: PluginCodingHomeworkDocumentationSnapshotWhereInput | null
    isNot?: PluginCodingHomeworkDocumentationSnapshotWhereInput | null
  }

  export type PluginCodingHomeworkSubmissionFileListRelationFilter = {
    every?: PluginCodingHomeworkSubmissionFileWhereInput
    some?: PluginCodingHomeworkSubmissionFileWhereInput
    none?: PluginCodingHomeworkSubmissionFileWhereInput
  }

  export type PluginCodingHomeworkSubmissionFunctionListRelationFilter = {
    every?: PluginCodingHomeworkSubmissionFunctionWhereInput
    some?: PluginCodingHomeworkSubmissionFunctionWhereInput
    none?: PluginCodingHomeworkSubmissionFunctionWhereInput
  }

  export type PluginCodingHomeworkChallengeQuestionListRelationFilter = {
    every?: PluginCodingHomeworkChallengeQuestionWhereInput
    some?: PluginCodingHomeworkChallengeQuestionWhereInput
    none?: PluginCodingHomeworkChallengeQuestionWhereInput
  }

  export type PluginCodingHomeworkReviewListRelationFilter = {
    every?: PluginCodingHomeworkReviewWhereInput
    some?: PluginCodingHomeworkReviewWhereInput
    none?: PluginCodingHomeworkReviewWhereInput
  }

  export type PluginCodingHomeworkSubmissionFileOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFunctionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PluginCodingHomeworkChallengeQuestionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PluginCodingHomeworkReviewOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionCountOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    groupId?: SortOrder
    userId?: SortOrder
    coreAttemptId?: SortOrder
    documentationSnapshotId?: SortOrder
    zipAttachmentId?: SortOrder
    kind?: SortOrder
    status?: SortOrder
    structureValidationSummary?: SortOrder
    processingError?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionMaxOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    groupId?: SortOrder
    userId?: SortOrder
    coreAttemptId?: SortOrder
    documentationSnapshotId?: SortOrder
    zipAttachmentId?: SortOrder
    kind?: SortOrder
    status?: SortOrder
    processingError?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionMinOrderByAggregateInput = {
    id?: SortOrder
    activityId?: SortOrder
    groupId?: SortOrder
    userId?: SortOrder
    coreAttemptId?: SortOrder
    documentationSnapshotId?: SortOrder
    zipAttachmentId?: SortOrder
    kind?: SortOrder
    status?: SortOrder
    processingError?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumPluginCodingHomeworkSubmissionKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSubmissionKind | EnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSubmissionKind[] | ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSubmissionKind[] | ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSubmissionKindWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSubmissionKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkSubmissionKindFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkSubmissionKindFilter<$PrismaModel>
  }

  export type EnumPluginCodingHomeworkSubmissionStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSubmissionStatus | EnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSubmissionStatus[] | ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSubmissionStatus[] | ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSubmissionStatusWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSubmissionStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkSubmissionStatusFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkSubmissionStatusFilter<$PrismaModel>
  }

  export type PluginCodingHomeworkSubmissionRelationFilter = {
    is?: PluginCodingHomeworkSubmissionWhereInput
    isNot?: PluginCodingHomeworkSubmissionWhereInput
  }

  export type PluginCodingHomeworkSubmissionFileSubmissionIdPathCompoundUniqueInput = {
    submissionId: string
    path: string
  }

  export type PluginCodingHomeworkSubmissionFileCountOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    path?: SortOrder
    languageKey?: SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    storedName?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFileAvgOrderByAggregateInput = {
    sizeBytes?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFileMaxOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    path?: SortOrder
    languageKey?: SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    storedName?: SortOrder
    createdAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFileMinOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    path?: SortOrder
    languageKey?: SortOrder
    sizeBytes?: SortOrder
    sha256?: SortOrder
    storedName?: SortOrder
    createdAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFileSumOrderByAggregateInput = {
    sizeBytes?: SortOrder
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type PluginCodingHomeworkSubmissionFileRelationFilter = {
    is?: PluginCodingHomeworkSubmissionFileWhereInput
    isNot?: PluginCodingHomeworkSubmissionFileWhereInput
  }

  export type PluginCodingHomeworkSubmissionFunctionCountOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    fileId?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    embedding?: SortOrder
    nearestExamples?: SortOrder
    divergenceScore?: SortOrder
    selectedForQuestion?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFunctionAvgOrderByAggregateInput = {
    divergenceScore?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFunctionMaxOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    fileId?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    divergenceScore?: SortOrder
    selectedForQuestion?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFunctionMinOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    fileId?: SortOrder
    functionName?: SortOrder
    functionCode?: SortOrder
    astText?: SortOrder
    divergenceScore?: SortOrder
    selectedForQuestion?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkSubmissionFunctionSumOrderByAggregateInput = {
    divergenceScore?: SortOrder
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type PluginCodingHomeworkSubmissionFunctionNullableRelationFilter = {
    is?: PluginCodingHomeworkSubmissionFunctionWhereInput | null
    isNot?: PluginCodingHomeworkSubmissionFunctionWhereInput | null
  }

  export type PluginCodingHomeworkChallengeQuestionSubmissionIdOrderIndexCompoundUniqueInput = {
    submissionId: string
    orderIndex: number
  }

  export type PluginCodingHomeworkChallengeQuestionCountOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    submissionFunctionId?: SortOrder
    orderIndex?: SortOrder
    questionText?: SortOrder
    studentAnswer?: SortOrder
    answerSubmittedAt?: SortOrder
    generationModel?: SortOrder
    generationPromptVersion?: SortOrder
    nearestExamples?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkChallengeQuestionAvgOrderByAggregateInput = {
    orderIndex?: SortOrder
  }

  export type PluginCodingHomeworkChallengeQuestionMaxOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    submissionFunctionId?: SortOrder
    orderIndex?: SortOrder
    questionText?: SortOrder
    studentAnswer?: SortOrder
    answerSubmittedAt?: SortOrder
    generationModel?: SortOrder
    generationPromptVersion?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkChallengeQuestionMinOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    submissionFunctionId?: SortOrder
    orderIndex?: SortOrder
    questionText?: SortOrder
    studentAnswer?: SortOrder
    answerSubmittedAt?: SortOrder
    generationModel?: SortOrder
    generationPromptVersion?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkChallengeQuestionSumOrderByAggregateInput = {
    orderIndex?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type PluginCodingHomeworkReviewCountOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    reviewerUserId?: SortOrder
    score?: SortOrder
    maxScore?: SortOrder
    feedback?: SortOrder
    rubric?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkReviewAvgOrderByAggregateInput = {
    score?: SortOrder
    maxScore?: SortOrder
  }

  export type PluginCodingHomeworkReviewMaxOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    reviewerUserId?: SortOrder
    score?: SortOrder
    maxScore?: SortOrder
    feedback?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkReviewMinOrderByAggregateInput = {
    id?: SortOrder
    submissionId?: SortOrder
    reviewerUserId?: SortOrder
    score?: SortOrder
    maxScore?: SortOrder
    feedback?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type PluginCodingHomeworkReviewSumOrderByAggregateInput = {
    score?: SortOrder
    maxScore?: SortOrder
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type EnumPluginCodingHomeworkAttachmentOwnerKindFieldUpdateOperationsInput = {
    set?: $Enums.PluginCodingHomeworkAttachmentOwnerKind
  }

  export type EnumPluginCodingHomeworkAttachmentKindFieldUpdateOperationsInput = {
    set?: $Enums.PluginCodingHomeworkAttachmentKind
  }

  export type BigIntFieldUpdateOperationsInput = {
    set?: bigint | number
    increment?: bigint | number
    decrement?: bigint | number
    multiply?: bigint | number
    divide?: bigint | number
  }

  export type PluginCodingHomeworkReferenceFunctionCreateNestedManyWithoutSnapshotInput = {
    create?: XOR<PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput, PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput> | PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput[] | PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput[]
    connectOrCreate?: PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput[]
    createMany?: PluginCodingHomeworkReferenceFunctionCreateManySnapshotInputEnvelope
    connect?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkSubmissionCreateNestedManyWithoutDocumentationSnapshotInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput> | PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput[] | PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput[]
    createMany?: PluginCodingHomeworkSubmissionCreateManyDocumentationSnapshotInputEnvelope
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkReferenceFunctionUncheckedCreateNestedManyWithoutSnapshotInput = {
    create?: XOR<PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput, PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput> | PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput[] | PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput[]
    connectOrCreate?: PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput[]
    createMany?: PluginCodingHomeworkReferenceFunctionCreateManySnapshotInputEnvelope
    connect?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkSubmissionUncheckedCreateNestedManyWithoutDocumentationSnapshotInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput> | PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput[] | PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput[]
    createMany?: PluginCodingHomeworkSubmissionCreateManyDocumentationSnapshotInputEnvelope
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
  }

  export type EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput = {
    set?: $Enums.PluginCodingHomeworkSnapshotStatus
  }

  export type PluginCodingHomeworkReferenceFunctionUpdateManyWithoutSnapshotNestedInput = {
    create?: XOR<PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput, PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput> | PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput[] | PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput[]
    connectOrCreate?: PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput[]
    upsert?: PluginCodingHomeworkReferenceFunctionUpsertWithWhereUniqueWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionUpsertWithWhereUniqueWithoutSnapshotInput[]
    createMany?: PluginCodingHomeworkReferenceFunctionCreateManySnapshotInputEnvelope
    set?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
    delete?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
    connect?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
    update?: PluginCodingHomeworkReferenceFunctionUpdateWithWhereUniqueWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionUpdateWithWhereUniqueWithoutSnapshotInput[]
    updateMany?: PluginCodingHomeworkReferenceFunctionUpdateManyWithWhereWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionUpdateManyWithWhereWithoutSnapshotInput[]
    deleteMany?: PluginCodingHomeworkReferenceFunctionScalarWhereInput | PluginCodingHomeworkReferenceFunctionScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionUpdateManyWithoutDocumentationSnapshotNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput> | PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput[] | PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput[]
    upsert?: PluginCodingHomeworkSubmissionUpsertWithWhereUniqueWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionUpsertWithWhereUniqueWithoutDocumentationSnapshotInput[]
    createMany?: PluginCodingHomeworkSubmissionCreateManyDocumentationSnapshotInputEnvelope
    set?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
    delete?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
    update?: PluginCodingHomeworkSubmissionUpdateWithWhereUniqueWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionUpdateWithWhereUniqueWithoutDocumentationSnapshotInput[]
    updateMany?: PluginCodingHomeworkSubmissionUpdateManyWithWhereWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionUpdateManyWithWhereWithoutDocumentationSnapshotInput[]
    deleteMany?: PluginCodingHomeworkSubmissionScalarWhereInput | PluginCodingHomeworkSubmissionScalarWhereInput[]
  }

  export type PluginCodingHomeworkReferenceFunctionUncheckedUpdateManyWithoutSnapshotNestedInput = {
    create?: XOR<PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput, PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput> | PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput[] | PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput[]
    connectOrCreate?: PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput[]
    upsert?: PluginCodingHomeworkReferenceFunctionUpsertWithWhereUniqueWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionUpsertWithWhereUniqueWithoutSnapshotInput[]
    createMany?: PluginCodingHomeworkReferenceFunctionCreateManySnapshotInputEnvelope
    set?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
    delete?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
    connect?: PluginCodingHomeworkReferenceFunctionWhereUniqueInput | PluginCodingHomeworkReferenceFunctionWhereUniqueInput[]
    update?: PluginCodingHomeworkReferenceFunctionUpdateWithWhereUniqueWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionUpdateWithWhereUniqueWithoutSnapshotInput[]
    updateMany?: PluginCodingHomeworkReferenceFunctionUpdateManyWithWhereWithoutSnapshotInput | PluginCodingHomeworkReferenceFunctionUpdateManyWithWhereWithoutSnapshotInput[]
    deleteMany?: PluginCodingHomeworkReferenceFunctionScalarWhereInput | PluginCodingHomeworkReferenceFunctionScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateManyWithoutDocumentationSnapshotNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput> | PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput[] | PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput[]
    upsert?: PluginCodingHomeworkSubmissionUpsertWithWhereUniqueWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionUpsertWithWhereUniqueWithoutDocumentationSnapshotInput[]
    createMany?: PluginCodingHomeworkSubmissionCreateManyDocumentationSnapshotInputEnvelope
    set?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
    delete?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput | PluginCodingHomeworkSubmissionWhereUniqueInput[]
    update?: PluginCodingHomeworkSubmissionUpdateWithWhereUniqueWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionUpdateWithWhereUniqueWithoutDocumentationSnapshotInput[]
    updateMany?: PluginCodingHomeworkSubmissionUpdateManyWithWhereWithoutDocumentationSnapshotInput | PluginCodingHomeworkSubmissionUpdateManyWithWhereWithoutDocumentationSnapshotInput[]
    deleteMany?: PluginCodingHomeworkSubmissionScalarWhereInput | PluginCodingHomeworkSubmissionScalarWhereInput[]
  }

  export type PluginCodingHomeworkDocumentationSnapshotCreateNestedOneWithoutReferenceFunctionsInput = {
    create?: XOR<PluginCodingHomeworkDocumentationSnapshotCreateWithoutReferenceFunctionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutReferenceFunctionsInput>
    connectOrCreate?: PluginCodingHomeworkDocumentationSnapshotCreateOrConnectWithoutReferenceFunctionsInput
    connect?: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpdateOneRequiredWithoutReferenceFunctionsNestedInput = {
    create?: XOR<PluginCodingHomeworkDocumentationSnapshotCreateWithoutReferenceFunctionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutReferenceFunctionsInput>
    connectOrCreate?: PluginCodingHomeworkDocumentationSnapshotCreateOrConnectWithoutReferenceFunctionsInput
    upsert?: PluginCodingHomeworkDocumentationSnapshotUpsertWithoutReferenceFunctionsInput
    connect?: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    update?: XOR<XOR<PluginCodingHomeworkDocumentationSnapshotUpdateToOneWithWhereWithoutReferenceFunctionsInput, PluginCodingHomeworkDocumentationSnapshotUpdateWithoutReferenceFunctionsInput>, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateWithoutReferenceFunctionsInput>
  }

  export type PluginCodingHomeworkDocumentationSnapshotCreateNestedOneWithoutSubmissionsInput = {
    create?: XOR<PluginCodingHomeworkDocumentationSnapshotCreateWithoutSubmissionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutSubmissionsInput>
    connectOrCreate?: PluginCodingHomeworkDocumentationSnapshotCreateOrConnectWithoutSubmissionsInput
    connect?: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
  }

  export type PluginCodingHomeworkSubmissionFileCreateNestedManyWithoutSubmissionInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput[] | PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkSubmissionFileCreateManySubmissionInputEnvelope
    connect?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutSubmissionInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput[] | PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkSubmissionFunctionCreateManySubmissionInputEnvelope
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionInput = {
    create?: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput[] | PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkChallengeQuestionCreateManySubmissionInputEnvelope
    connect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkReviewCreateNestedManyWithoutSubmissionInput = {
    create?: XOR<PluginCodingHomeworkReviewCreateWithoutSubmissionInput, PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkReviewCreateWithoutSubmissionInput[] | PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkReviewCreateManySubmissionInputEnvelope
    connect?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedCreateNestedManyWithoutSubmissionInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput[] | PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkSubmissionFileCreateManySubmissionInputEnvelope
    connect?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutSubmissionInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput[] | PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkSubmissionFunctionCreateManySubmissionInputEnvelope
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionInput = {
    create?: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput[] | PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkChallengeQuestionCreateManySubmissionInputEnvelope
    connect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkReviewUncheckedCreateNestedManyWithoutSubmissionInput = {
    create?: XOR<PluginCodingHomeworkReviewCreateWithoutSubmissionInput, PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkReviewCreateWithoutSubmissionInput[] | PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkReviewCreateManySubmissionInputEnvelope
    connect?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
  }

  export type EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput = {
    set?: $Enums.PluginCodingHomeworkSubmissionKind
  }

  export type EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput = {
    set?: $Enums.PluginCodingHomeworkSubmissionStatus
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpdateOneWithoutSubmissionsNestedInput = {
    create?: XOR<PluginCodingHomeworkDocumentationSnapshotCreateWithoutSubmissionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutSubmissionsInput>
    connectOrCreate?: PluginCodingHomeworkDocumentationSnapshotCreateOrConnectWithoutSubmissionsInput
    upsert?: PluginCodingHomeworkDocumentationSnapshotUpsertWithoutSubmissionsInput
    disconnect?: PluginCodingHomeworkDocumentationSnapshotWhereInput | boolean
    delete?: PluginCodingHomeworkDocumentationSnapshotWhereInput | boolean
    connect?: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    update?: XOR<XOR<PluginCodingHomeworkDocumentationSnapshotUpdateToOneWithWhereWithoutSubmissionsInput, PluginCodingHomeworkDocumentationSnapshotUpdateWithoutSubmissionsInput>, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateWithoutSubmissionsInput>
  }

  export type PluginCodingHomeworkSubmissionFileUpdateManyWithoutSubmissionNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput[] | PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput[]
    upsert?: PluginCodingHomeworkSubmissionFileUpsertWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileUpsertWithWhereUniqueWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkSubmissionFileCreateManySubmissionInputEnvelope
    set?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
    delete?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
    connect?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
    update?: PluginCodingHomeworkSubmissionFileUpdateWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileUpdateWithWhereUniqueWithoutSubmissionInput[]
    updateMany?: PluginCodingHomeworkSubmissionFileUpdateManyWithWhereWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileUpdateManyWithWhereWithoutSubmissionInput[]
    deleteMany?: PluginCodingHomeworkSubmissionFileScalarWhereInput | PluginCodingHomeworkSubmissionFileScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutSubmissionNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput[] | PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput[]
    upsert?: PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkSubmissionFunctionCreateManySubmissionInputEnvelope
    set?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    delete?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    update?: PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutSubmissionInput[]
    updateMany?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutSubmissionInput[]
    deleteMany?: PluginCodingHomeworkSubmissionFunctionScalarWhereInput | PluginCodingHomeworkSubmissionFunctionScalarWhereInput[]
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionNestedInput = {
    create?: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput[] | PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput[]
    upsert?: PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkChallengeQuestionCreateManySubmissionInputEnvelope
    set?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    delete?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    connect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    update?: PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionInput[]
    updateMany?: PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionInput[]
    deleteMany?: PluginCodingHomeworkChallengeQuestionScalarWhereInput | PluginCodingHomeworkChallengeQuestionScalarWhereInput[]
  }

  export type PluginCodingHomeworkReviewUpdateManyWithoutSubmissionNestedInput = {
    create?: XOR<PluginCodingHomeworkReviewCreateWithoutSubmissionInput, PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkReviewCreateWithoutSubmissionInput[] | PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput[]
    upsert?: PluginCodingHomeworkReviewUpsertWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkReviewUpsertWithWhereUniqueWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkReviewCreateManySubmissionInputEnvelope
    set?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
    delete?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
    connect?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
    update?: PluginCodingHomeworkReviewUpdateWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkReviewUpdateWithWhereUniqueWithoutSubmissionInput[]
    updateMany?: PluginCodingHomeworkReviewUpdateManyWithWhereWithoutSubmissionInput | PluginCodingHomeworkReviewUpdateManyWithWhereWithoutSubmissionInput[]
    deleteMany?: PluginCodingHomeworkReviewScalarWhereInput | PluginCodingHomeworkReviewScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedUpdateManyWithoutSubmissionNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput[] | PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput[]
    upsert?: PluginCodingHomeworkSubmissionFileUpsertWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileUpsertWithWhereUniqueWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkSubmissionFileCreateManySubmissionInputEnvelope
    set?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
    delete?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
    connect?: PluginCodingHomeworkSubmissionFileWhereUniqueInput | PluginCodingHomeworkSubmissionFileWhereUniqueInput[]
    update?: PluginCodingHomeworkSubmissionFileUpdateWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileUpdateWithWhereUniqueWithoutSubmissionInput[]
    updateMany?: PluginCodingHomeworkSubmissionFileUpdateManyWithWhereWithoutSubmissionInput | PluginCodingHomeworkSubmissionFileUpdateManyWithWhereWithoutSubmissionInput[]
    deleteMany?: PluginCodingHomeworkSubmissionFileScalarWhereInput | PluginCodingHomeworkSubmissionFileScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutSubmissionNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput[] | PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput[]
    upsert?: PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkSubmissionFunctionCreateManySubmissionInputEnvelope
    set?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    delete?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    update?: PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutSubmissionInput[]
    updateMany?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutSubmissionInput | PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutSubmissionInput[]
    deleteMany?: PluginCodingHomeworkSubmissionFunctionScalarWhereInput | PluginCodingHomeworkSubmissionFunctionScalarWhereInput[]
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionNestedInput = {
    create?: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput[] | PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput[]
    upsert?: PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkChallengeQuestionCreateManySubmissionInputEnvelope
    set?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    delete?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    connect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    update?: PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionInput[]
    updateMany?: PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionInput | PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionInput[]
    deleteMany?: PluginCodingHomeworkChallengeQuestionScalarWhereInput | PluginCodingHomeworkChallengeQuestionScalarWhereInput[]
  }

  export type PluginCodingHomeworkReviewUncheckedUpdateManyWithoutSubmissionNestedInput = {
    create?: XOR<PluginCodingHomeworkReviewCreateWithoutSubmissionInput, PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput> | PluginCodingHomeworkReviewCreateWithoutSubmissionInput[] | PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput[]
    connectOrCreate?: PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput | PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput[]
    upsert?: PluginCodingHomeworkReviewUpsertWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkReviewUpsertWithWhereUniqueWithoutSubmissionInput[]
    createMany?: PluginCodingHomeworkReviewCreateManySubmissionInputEnvelope
    set?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
    delete?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
    connect?: PluginCodingHomeworkReviewWhereUniqueInput | PluginCodingHomeworkReviewWhereUniqueInput[]
    update?: PluginCodingHomeworkReviewUpdateWithWhereUniqueWithoutSubmissionInput | PluginCodingHomeworkReviewUpdateWithWhereUniqueWithoutSubmissionInput[]
    updateMany?: PluginCodingHomeworkReviewUpdateManyWithWhereWithoutSubmissionInput | PluginCodingHomeworkReviewUpdateManyWithWhereWithoutSubmissionInput[]
    deleteMany?: PluginCodingHomeworkReviewScalarWhereInput | PluginCodingHomeworkReviewScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionCreateNestedOneWithoutFilesInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutFilesInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutFilesInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutFilesInput
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutFileInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput> | PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput[] | PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput | PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput[]
    createMany?: PluginCodingHomeworkSubmissionFunctionCreateManyFileInputEnvelope
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutFileInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput> | PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput[] | PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput | PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput[]
    createMany?: PluginCodingHomeworkSubmissionFunctionCreateManyFileInputEnvelope
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutFilesNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutFilesInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutFilesInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutFilesInput
    upsert?: PluginCodingHomeworkSubmissionUpsertWithoutFilesInput
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput
    update?: XOR<XOR<PluginCodingHomeworkSubmissionUpdateToOneWithWhereWithoutFilesInput, PluginCodingHomeworkSubmissionUpdateWithoutFilesInput>, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutFilesInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutFileNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput> | PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput[] | PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput | PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput[]
    upsert?: PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutFileInput | PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutFileInput[]
    createMany?: PluginCodingHomeworkSubmissionFunctionCreateManyFileInputEnvelope
    set?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    delete?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    update?: PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutFileInput | PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutFileInput[]
    updateMany?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutFileInput | PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutFileInput[]
    deleteMany?: PluginCodingHomeworkSubmissionFunctionScalarWhereInput | PluginCodingHomeworkSubmissionFunctionScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutFileNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput> | PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput[] | PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput[]
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput | PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput[]
    upsert?: PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutFileInput | PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutFileInput[]
    createMany?: PluginCodingHomeworkSubmissionFunctionCreateManyFileInputEnvelope
    set?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    delete?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput | PluginCodingHomeworkSubmissionFunctionWhereUniqueInput[]
    update?: PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutFileInput | PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutFileInput[]
    updateMany?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutFileInput | PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutFileInput[]
    deleteMany?: PluginCodingHomeworkSubmissionFunctionScalarWhereInput | PluginCodingHomeworkSubmissionFunctionScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionCreateNestedOneWithoutFunctionsInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutFunctionsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutFunctionsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutFunctionsInput
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput
  }

  export type PluginCodingHomeworkSubmissionFileCreateNestedOneWithoutFunctionsInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutFunctionsInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutFunctionsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutFunctionsInput
    connect?: PluginCodingHomeworkSubmissionFileWhereUniqueInput
  }

  export type PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionFunctionInput = {
    create?: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput> | PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput[] | PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput[]
    connectOrCreate?: PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput[]
    createMany?: PluginCodingHomeworkChallengeQuestionCreateManySubmissionFunctionInputEnvelope
    connect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionFunctionInput = {
    create?: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput> | PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput[] | PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput[]
    connectOrCreate?: PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput[]
    createMany?: PluginCodingHomeworkChallengeQuestionCreateManySubmissionFunctionInputEnvelope
    connect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutFunctionsNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutFunctionsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutFunctionsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutFunctionsInput
    upsert?: PluginCodingHomeworkSubmissionUpsertWithoutFunctionsInput
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput
    update?: XOR<XOR<PluginCodingHomeworkSubmissionUpdateToOneWithWhereWithoutFunctionsInput, PluginCodingHomeworkSubmissionUpdateWithoutFunctionsInput>, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutFunctionsInput>
  }

  export type PluginCodingHomeworkSubmissionFileUpdateOneRequiredWithoutFunctionsNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutFunctionsInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutFunctionsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutFunctionsInput
    upsert?: PluginCodingHomeworkSubmissionFileUpsertWithoutFunctionsInput
    connect?: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    update?: XOR<XOR<PluginCodingHomeworkSubmissionFileUpdateToOneWithWhereWithoutFunctionsInput, PluginCodingHomeworkSubmissionFileUpdateWithoutFunctionsInput>, PluginCodingHomeworkSubmissionFileUncheckedUpdateWithoutFunctionsInput>
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionFunctionNestedInput = {
    create?: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput> | PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput[] | PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput[]
    connectOrCreate?: PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput[]
    upsert?: PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionFunctionInput[]
    createMany?: PluginCodingHomeworkChallengeQuestionCreateManySubmissionFunctionInputEnvelope
    set?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    delete?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    connect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    update?: PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionFunctionInput[]
    updateMany?: PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionFunctionInput[]
    deleteMany?: PluginCodingHomeworkChallengeQuestionScalarWhereInput | PluginCodingHomeworkChallengeQuestionScalarWhereInput[]
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionFunctionNestedInput = {
    create?: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput> | PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput[] | PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput[]
    connectOrCreate?: PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput[]
    upsert?: PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionFunctionInput[]
    createMany?: PluginCodingHomeworkChallengeQuestionCreateManySubmissionFunctionInputEnvelope
    set?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    disconnect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    delete?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    connect?: PluginCodingHomeworkChallengeQuestionWhereUniqueInput | PluginCodingHomeworkChallengeQuestionWhereUniqueInput[]
    update?: PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionFunctionInput[]
    updateMany?: PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionFunctionInput[]
    deleteMany?: PluginCodingHomeworkChallengeQuestionScalarWhereInput | PluginCodingHomeworkChallengeQuestionScalarWhereInput[]
  }

  export type PluginCodingHomeworkSubmissionCreateNestedOneWithoutQuestionsInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutQuestionsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutQuestionsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutQuestionsInput
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateNestedOneWithoutQuestionsInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutQuestionsInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutQuestionsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutQuestionsInput
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutQuestionsNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutQuestionsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutQuestionsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutQuestionsInput
    upsert?: PluginCodingHomeworkSubmissionUpsertWithoutQuestionsInput
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput
    update?: XOR<XOR<PluginCodingHomeworkSubmissionUpdateToOneWithWhereWithoutQuestionsInput, PluginCodingHomeworkSubmissionUpdateWithoutQuestionsInput>, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutQuestionsInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateOneWithoutQuestionsNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutQuestionsInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutQuestionsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutQuestionsInput
    upsert?: PluginCodingHomeworkSubmissionFunctionUpsertWithoutQuestionsInput
    disconnect?: PluginCodingHomeworkSubmissionFunctionWhereInput | boolean
    delete?: PluginCodingHomeworkSubmissionFunctionWhereInput | boolean
    connect?: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    update?: XOR<XOR<PluginCodingHomeworkSubmissionFunctionUpdateToOneWithWhereWithoutQuestionsInput, PluginCodingHomeworkSubmissionFunctionUpdateWithoutQuestionsInput>, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutQuestionsInput>
  }

  export type PluginCodingHomeworkSubmissionCreateNestedOneWithoutReviewsInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutReviewsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutReviewsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutReviewsInput
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput
  }

  export type PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutReviewsNestedInput = {
    create?: XOR<PluginCodingHomeworkSubmissionCreateWithoutReviewsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutReviewsInput>
    connectOrCreate?: PluginCodingHomeworkSubmissionCreateOrConnectWithoutReviewsInput
    upsert?: PluginCodingHomeworkSubmissionUpsertWithoutReviewsInput
    connect?: PluginCodingHomeworkSubmissionWhereUniqueInput
    update?: XOR<XOR<PluginCodingHomeworkSubmissionUpdateToOneWithWhereWithoutReviewsInput, PluginCodingHomeworkSubmissionUpdateWithoutReviewsInput>, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutReviewsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }
  export type NestedJsonFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumPluginCodingHomeworkAttachmentOwnerKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkAttachmentOwnerKind | EnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkAttachmentOwnerKind[] | ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkAttachmentOwnerKind[] | ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkAttachmentOwnerKindFilter<$PrismaModel> | $Enums.PluginCodingHomeworkAttachmentOwnerKind
  }

  export type NestedEnumPluginCodingHomeworkAttachmentKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkAttachmentKind | EnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkAttachmentKind[] | ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkAttachmentKind[] | ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkAttachmentKindFilter<$PrismaModel> | $Enums.PluginCodingHomeworkAttachmentKind
  }

  export type NestedBigIntFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntFilter<$PrismaModel> | bigint | number
  }

  export type NestedEnumPluginCodingHomeworkAttachmentOwnerKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkAttachmentOwnerKind | EnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkAttachmentOwnerKind[] | ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkAttachmentOwnerKind[] | ListEnumPluginCodingHomeworkAttachmentOwnerKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkAttachmentOwnerKindWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkAttachmentOwnerKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkAttachmentOwnerKindFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkAttachmentOwnerKindFilter<$PrismaModel>
  }

  export type NestedEnumPluginCodingHomeworkAttachmentKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkAttachmentKind | EnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkAttachmentKind[] | ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkAttachmentKind[] | ListEnumPluginCodingHomeworkAttachmentKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkAttachmentKindWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkAttachmentKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkAttachmentKindFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkAttachmentKindFilter<$PrismaModel>
  }

  export type NestedBigIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedBigIntFilter<$PrismaModel>
    _min?: NestedBigIntFilter<$PrismaModel>
    _max?: NestedBigIntFilter<$PrismaModel>
  }

  export type NestedEnumPluginCodingHomeworkSnapshotStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSnapshotStatus | EnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSnapshotStatus[] | ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSnapshotStatus[] | ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSnapshotStatusFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSnapshotStatus
  }

  export type NestedEnumPluginCodingHomeworkSnapshotStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSnapshotStatus | EnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSnapshotStatus[] | ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSnapshotStatus[] | ListEnumPluginCodingHomeworkSnapshotStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSnapshotStatusWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSnapshotStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkSnapshotStatusFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkSnapshotStatusFilter<$PrismaModel>
  }

  export type NestedEnumPluginCodingHomeworkSubmissionKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSubmissionKind | EnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSubmissionKind[] | ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSubmissionKind[] | ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSubmissionKindFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSubmissionKind
  }

  export type NestedEnumPluginCodingHomeworkSubmissionStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSubmissionStatus | EnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSubmissionStatus[] | ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSubmissionStatus[] | ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSubmissionStatusFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSubmissionStatus
  }

  export type NestedEnumPluginCodingHomeworkSubmissionKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSubmissionKind | EnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSubmissionKind[] | ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSubmissionKind[] | ListEnumPluginCodingHomeworkSubmissionKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSubmissionKindWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSubmissionKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkSubmissionKindFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkSubmissionKindFilter<$PrismaModel>
  }

  export type NestedEnumPluginCodingHomeworkSubmissionStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PluginCodingHomeworkSubmissionStatus | EnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    in?: $Enums.PluginCodingHomeworkSubmissionStatus[] | ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.PluginCodingHomeworkSubmissionStatus[] | ListEnumPluginCodingHomeworkSubmissionStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumPluginCodingHomeworkSubmissionStatusWithAggregatesFilter<$PrismaModel> | $Enums.PluginCodingHomeworkSubmissionStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPluginCodingHomeworkSubmissionStatusFilter<$PrismaModel>
    _max?: NestedEnumPluginCodingHomeworkSubmissionStatusFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput = {
    id?: string
    contentResourceId?: string | null
    sourceTitle: string
    sourceKind: string
    languageKey: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput = {
    id?: string
    contentResourceId?: string | null
    sourceTitle: string
    sourceKind: string
    languageKey: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionCreateOrConnectWithoutSnapshotInput = {
    where: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    create: XOR<PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput, PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput>
  }

  export type PluginCodingHomeworkReferenceFunctionCreateManySnapshotInputEnvelope = {
    data: PluginCodingHomeworkReferenceFunctionCreateManySnapshotInput | PluginCodingHomeworkReferenceFunctionCreateManySnapshotInput[]
    skipDuplicates?: boolean
  }

  export type PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    files?: PluginCodingHomeworkSubmissionFileCreateNestedManyWithoutSubmissionInput
    functions?: PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedCreateNestedManyWithoutSubmissionInput
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewUncheckedCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionCreateOrConnectWithoutDocumentationSnapshotInput = {
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput>
  }

  export type PluginCodingHomeworkSubmissionCreateManyDocumentationSnapshotInputEnvelope = {
    data: PluginCodingHomeworkSubmissionCreateManyDocumentationSnapshotInput | PluginCodingHomeworkSubmissionCreateManyDocumentationSnapshotInput[]
    skipDuplicates?: boolean
  }

  export type PluginCodingHomeworkReferenceFunctionUpsertWithWhereUniqueWithoutSnapshotInput = {
    where: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    update: XOR<PluginCodingHomeworkReferenceFunctionUpdateWithoutSnapshotInput, PluginCodingHomeworkReferenceFunctionUncheckedUpdateWithoutSnapshotInput>
    create: XOR<PluginCodingHomeworkReferenceFunctionCreateWithoutSnapshotInput, PluginCodingHomeworkReferenceFunctionUncheckedCreateWithoutSnapshotInput>
  }

  export type PluginCodingHomeworkReferenceFunctionUpdateWithWhereUniqueWithoutSnapshotInput = {
    where: PluginCodingHomeworkReferenceFunctionWhereUniqueInput
    data: XOR<PluginCodingHomeworkReferenceFunctionUpdateWithoutSnapshotInput, PluginCodingHomeworkReferenceFunctionUncheckedUpdateWithoutSnapshotInput>
  }

  export type PluginCodingHomeworkReferenceFunctionUpdateManyWithWhereWithoutSnapshotInput = {
    where: PluginCodingHomeworkReferenceFunctionScalarWhereInput
    data: XOR<PluginCodingHomeworkReferenceFunctionUpdateManyMutationInput, PluginCodingHomeworkReferenceFunctionUncheckedUpdateManyWithoutSnapshotInput>
  }

  export type PluginCodingHomeworkReferenceFunctionScalarWhereInput = {
    AND?: PluginCodingHomeworkReferenceFunctionScalarWhereInput | PluginCodingHomeworkReferenceFunctionScalarWhereInput[]
    OR?: PluginCodingHomeworkReferenceFunctionScalarWhereInput[]
    NOT?: PluginCodingHomeworkReferenceFunctionScalarWhereInput | PluginCodingHomeworkReferenceFunctionScalarWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    snapshotId?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    contentResourceId?: StringNullableFilter<"PluginCodingHomeworkReferenceFunction"> | string | null
    sourceTitle?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    sourceKind?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    languageKey?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    functionName?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    functionCode?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    astText?: StringFilter<"PluginCodingHomeworkReferenceFunction"> | string
    embedding?: JsonFilter<"PluginCodingHomeworkReferenceFunction">
    metadata?: JsonFilter<"PluginCodingHomeworkReferenceFunction">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkReferenceFunction"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkReferenceFunction"> | Date | string
  }

  export type PluginCodingHomeworkSubmissionUpsertWithWhereUniqueWithoutDocumentationSnapshotInput = {
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
    update: XOR<PluginCodingHomeworkSubmissionUpdateWithoutDocumentationSnapshotInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutDocumentationSnapshotInput>
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutDocumentationSnapshotInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutDocumentationSnapshotInput>
  }

  export type PluginCodingHomeworkSubmissionUpdateWithWhereUniqueWithoutDocumentationSnapshotInput = {
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
    data: XOR<PluginCodingHomeworkSubmissionUpdateWithoutDocumentationSnapshotInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutDocumentationSnapshotInput>
  }

  export type PluginCodingHomeworkSubmissionUpdateManyWithWhereWithoutDocumentationSnapshotInput = {
    where: PluginCodingHomeworkSubmissionScalarWhereInput
    data: XOR<PluginCodingHomeworkSubmissionUpdateManyMutationInput, PluginCodingHomeworkSubmissionUncheckedUpdateManyWithoutDocumentationSnapshotInput>
  }

  export type PluginCodingHomeworkSubmissionScalarWhereInput = {
    AND?: PluginCodingHomeworkSubmissionScalarWhereInput | PluginCodingHomeworkSubmissionScalarWhereInput[]
    OR?: PluginCodingHomeworkSubmissionScalarWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionScalarWhereInput | PluginCodingHomeworkSubmissionScalarWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    activityId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    groupId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    userId?: StringFilter<"PluginCodingHomeworkSubmission"> | string
    coreAttemptId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    documentationSnapshotId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    zipAttachmentId?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFilter<"PluginCodingHomeworkSubmission"> | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFilter<"PluginCodingHomeworkSubmission"> | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonFilter<"PluginCodingHomeworkSubmission">
    processingError?: StringNullableFilter<"PluginCodingHomeworkSubmission"> | string | null
    metadata?: JsonFilter<"PluginCodingHomeworkSubmission">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmission"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkSubmission"> | Date | string
  }

  export type PluginCodingHomeworkDocumentationSnapshotCreateWithoutReferenceFunctionsInput = {
    id?: string
    activityId: string
    courseId: string
    groupId?: string | null
    contentTreeAnchorItemId?: string | null
    contentTreeFingerprint?: string
    status?: $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    submissions?: PluginCodingHomeworkSubmissionCreateNestedManyWithoutDocumentationSnapshotInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutReferenceFunctionsInput = {
    id?: string
    activityId: string
    courseId: string
    groupId?: string | null
    contentTreeAnchorItemId?: string | null
    contentTreeFingerprint?: string
    status?: $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    submissions?: PluginCodingHomeworkSubmissionUncheckedCreateNestedManyWithoutDocumentationSnapshotInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotCreateOrConnectWithoutReferenceFunctionsInput = {
    where: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    create: XOR<PluginCodingHomeworkDocumentationSnapshotCreateWithoutReferenceFunctionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutReferenceFunctionsInput>
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpsertWithoutReferenceFunctionsInput = {
    update: XOR<PluginCodingHomeworkDocumentationSnapshotUpdateWithoutReferenceFunctionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateWithoutReferenceFunctionsInput>
    create: XOR<PluginCodingHomeworkDocumentationSnapshotCreateWithoutReferenceFunctionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutReferenceFunctionsInput>
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpdateToOneWithWhereWithoutReferenceFunctionsInput = {
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
    data: XOR<PluginCodingHomeworkDocumentationSnapshotUpdateWithoutReferenceFunctionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateWithoutReferenceFunctionsInput>
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpdateWithoutReferenceFunctionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
    groupId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeAnchorItemId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeFingerprint?: StringFieldUpdateOperationsInput | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submissions?: PluginCodingHomeworkSubmissionUpdateManyWithoutDocumentationSnapshotNestedInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateWithoutReferenceFunctionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
    groupId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeAnchorItemId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeFingerprint?: StringFieldUpdateOperationsInput | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submissions?: PluginCodingHomeworkSubmissionUncheckedUpdateManyWithoutDocumentationSnapshotNestedInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotCreateWithoutSubmissionsInput = {
    id?: string
    activityId: string
    courseId: string
    groupId?: string | null
    contentTreeAnchorItemId?: string | null
    contentTreeFingerprint?: string
    status?: $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionCreateNestedManyWithoutSnapshotInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutSubmissionsInput = {
    id?: string
    activityId: string
    courseId: string
    groupId?: string | null
    contentTreeAnchorItemId?: string | null
    contentTreeFingerprint?: string
    status?: $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionUncheckedCreateNestedManyWithoutSnapshotInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotCreateOrConnectWithoutSubmissionsInput = {
    where: PluginCodingHomeworkDocumentationSnapshotWhereUniqueInput
    create: XOR<PluginCodingHomeworkDocumentationSnapshotCreateWithoutSubmissionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutSubmissionsInput>
  }

  export type PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput = {
    id?: string
    path: string
    languageKey?: string | null
    sizeBytes: bigint | number
    sha256: string
    storedName: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    functions?: PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutFileInput
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput = {
    id?: string
    path: string
    languageKey?: string | null
    sizeBytes: bigint | number
    sha256: string
    storedName: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutFileInput
  }

  export type PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutSubmissionInput = {
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkSubmissionFileCreateManySubmissionInputEnvelope = {
    data: PluginCodingHomeworkSubmissionFileCreateManySubmissionInput | PluginCodingHomeworkSubmissionFileCreateManySubmissionInput[]
    skipDuplicates?: boolean
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput = {
    id?: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    file: PluginCodingHomeworkSubmissionFileCreateNestedOneWithoutFunctionsInput
    questions?: PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionFunctionInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput = {
    id?: string
    fileId: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionFunctionInput
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutSubmissionInput = {
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateManySubmissionInputEnvelope = {
    data: PluginCodingHomeworkSubmissionFunctionCreateManySubmissionInput | PluginCodingHomeworkSubmissionFunctionCreateManySubmissionInput[]
    skipDuplicates?: boolean
  }

  export type PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput = {
    id?: string
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    submissionFunction?: PluginCodingHomeworkSubmissionFunctionCreateNestedOneWithoutQuestionsInput
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput = {
    id?: string
    submissionFunctionId?: string | null
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionInput = {
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    create: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkChallengeQuestionCreateManySubmissionInputEnvelope = {
    data: PluginCodingHomeworkChallengeQuestionCreateManySubmissionInput | PluginCodingHomeworkChallengeQuestionCreateManySubmissionInput[]
    skipDuplicates?: boolean
  }

  export type PluginCodingHomeworkReviewCreateWithoutSubmissionInput = {
    id?: string
    reviewerUserId: string
    score?: number | null
    maxScore?: number | null
    feedback?: string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput = {
    id?: string
    reviewerUserId: string
    score?: number | null
    maxScore?: number | null
    feedback?: string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReviewCreateOrConnectWithoutSubmissionInput = {
    where: PluginCodingHomeworkReviewWhereUniqueInput
    create: XOR<PluginCodingHomeworkReviewCreateWithoutSubmissionInput, PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkReviewCreateManySubmissionInputEnvelope = {
    data: PluginCodingHomeworkReviewCreateManySubmissionInput | PluginCodingHomeworkReviewCreateManySubmissionInput[]
    skipDuplicates?: boolean
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpsertWithoutSubmissionsInput = {
    update: XOR<PluginCodingHomeworkDocumentationSnapshotUpdateWithoutSubmissionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateWithoutSubmissionsInput>
    create: XOR<PluginCodingHomeworkDocumentationSnapshotCreateWithoutSubmissionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedCreateWithoutSubmissionsInput>
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpdateToOneWithWhereWithoutSubmissionsInput = {
    where?: PluginCodingHomeworkDocumentationSnapshotWhereInput
    data: XOR<PluginCodingHomeworkDocumentationSnapshotUpdateWithoutSubmissionsInput, PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateWithoutSubmissionsInput>
  }

  export type PluginCodingHomeworkDocumentationSnapshotUpdateWithoutSubmissionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
    groupId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeAnchorItemId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeFingerprint?: StringFieldUpdateOperationsInput | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionUpdateManyWithoutSnapshotNestedInput
  }

  export type PluginCodingHomeworkDocumentationSnapshotUncheckedUpdateWithoutSubmissionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    courseId?: StringFieldUpdateOperationsInput | string
    groupId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeAnchorItemId?: NullableStringFieldUpdateOperationsInput | string | null
    contentTreeFingerprint?: StringFieldUpdateOperationsInput | string
    status?: EnumPluginCodingHomeworkSnapshotStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSnapshotStatus
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    referenceFunctions?: PluginCodingHomeworkReferenceFunctionUncheckedUpdateManyWithoutSnapshotNestedInput
  }

  export type PluginCodingHomeworkSubmissionFileUpsertWithWhereUniqueWithoutSubmissionInput = {
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    update: XOR<PluginCodingHomeworkSubmissionFileUpdateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFileUncheckedUpdateWithoutSubmissionInput>
    create: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkSubmissionFileUpdateWithWhereUniqueWithoutSubmissionInput = {
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    data: XOR<PluginCodingHomeworkSubmissionFileUpdateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFileUncheckedUpdateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkSubmissionFileUpdateManyWithWhereWithoutSubmissionInput = {
    where: PluginCodingHomeworkSubmissionFileScalarWhereInput
    data: XOR<PluginCodingHomeworkSubmissionFileUpdateManyMutationInput, PluginCodingHomeworkSubmissionFileUncheckedUpdateManyWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkSubmissionFileScalarWhereInput = {
    AND?: PluginCodingHomeworkSubmissionFileScalarWhereInput | PluginCodingHomeworkSubmissionFileScalarWhereInput[]
    OR?: PluginCodingHomeworkSubmissionFileScalarWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionFileScalarWhereInput | PluginCodingHomeworkSubmissionFileScalarWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    submissionId?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    path?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    languageKey?: StringNullableFilter<"PluginCodingHomeworkSubmissionFile"> | string | null
    sizeBytes?: BigIntFilter<"PluginCodingHomeworkSubmissionFile"> | bigint | number
    sha256?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    storedName?: StringFilter<"PluginCodingHomeworkSubmissionFile"> | string
    metadata?: JsonFilter<"PluginCodingHomeworkSubmissionFile">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFile"> | Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutSubmissionInput = {
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    update: XOR<PluginCodingHomeworkSubmissionFunctionUpdateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutSubmissionInput>
    create: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutSubmissionInput = {
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    data: XOR<PluginCodingHomeworkSubmissionFunctionUpdateWithoutSubmissionInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutSubmissionInput = {
    where: PluginCodingHomeworkSubmissionFunctionScalarWhereInput
    data: XOR<PluginCodingHomeworkSubmissionFunctionUpdateManyMutationInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionScalarWhereInput = {
    AND?: PluginCodingHomeworkSubmissionFunctionScalarWhereInput | PluginCodingHomeworkSubmissionFunctionScalarWhereInput[]
    OR?: PluginCodingHomeworkSubmissionFunctionScalarWhereInput[]
    NOT?: PluginCodingHomeworkSubmissionFunctionScalarWhereInput | PluginCodingHomeworkSubmissionFunctionScalarWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    submissionId?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    fileId?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    functionName?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    functionCode?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    astText?: StringFilter<"PluginCodingHomeworkSubmissionFunction"> | string
    embedding?: JsonFilter<"PluginCodingHomeworkSubmissionFunction">
    nearestExamples?: JsonFilter<"PluginCodingHomeworkSubmissionFunction">
    divergenceScore?: FloatNullableFilter<"PluginCodingHomeworkSubmissionFunction"> | number | null
    selectedForQuestion?: BoolFilter<"PluginCodingHomeworkSubmissionFunction"> | boolean
    createdAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFunction"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkSubmissionFunction"> | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionInput = {
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    update: XOR<PluginCodingHomeworkChallengeQuestionUpdateWithoutSubmissionInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateWithoutSubmissionInput>
    create: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionInput = {
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    data: XOR<PluginCodingHomeworkChallengeQuestionUpdateWithoutSubmissionInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionInput = {
    where: PluginCodingHomeworkChallengeQuestionScalarWhereInput
    data: XOR<PluginCodingHomeworkChallengeQuestionUpdateManyMutationInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkChallengeQuestionScalarWhereInput = {
    AND?: PluginCodingHomeworkChallengeQuestionScalarWhereInput | PluginCodingHomeworkChallengeQuestionScalarWhereInput[]
    OR?: PluginCodingHomeworkChallengeQuestionScalarWhereInput[]
    NOT?: PluginCodingHomeworkChallengeQuestionScalarWhereInput | PluginCodingHomeworkChallengeQuestionScalarWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    submissionId?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    submissionFunctionId?: StringNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | string | null
    orderIndex?: IntFilter<"PluginCodingHomeworkChallengeQuestion"> | number
    questionText?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    studentAnswer?: StringNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | string | null
    answerSubmittedAt?: DateTimeNullableFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string | null
    generationModel?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    generationPromptVersion?: StringFilter<"PluginCodingHomeworkChallengeQuestion"> | string
    nearestExamples?: JsonFilter<"PluginCodingHomeworkChallengeQuestion">
    metadata?: JsonFilter<"PluginCodingHomeworkChallengeQuestion">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkChallengeQuestion"> | Date | string
  }

  export type PluginCodingHomeworkReviewUpsertWithWhereUniqueWithoutSubmissionInput = {
    where: PluginCodingHomeworkReviewWhereUniqueInput
    update: XOR<PluginCodingHomeworkReviewUpdateWithoutSubmissionInput, PluginCodingHomeworkReviewUncheckedUpdateWithoutSubmissionInput>
    create: XOR<PluginCodingHomeworkReviewCreateWithoutSubmissionInput, PluginCodingHomeworkReviewUncheckedCreateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkReviewUpdateWithWhereUniqueWithoutSubmissionInput = {
    where: PluginCodingHomeworkReviewWhereUniqueInput
    data: XOR<PluginCodingHomeworkReviewUpdateWithoutSubmissionInput, PluginCodingHomeworkReviewUncheckedUpdateWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkReviewUpdateManyWithWhereWithoutSubmissionInput = {
    where: PluginCodingHomeworkReviewScalarWhereInput
    data: XOR<PluginCodingHomeworkReviewUpdateManyMutationInput, PluginCodingHomeworkReviewUncheckedUpdateManyWithoutSubmissionInput>
  }

  export type PluginCodingHomeworkReviewScalarWhereInput = {
    AND?: PluginCodingHomeworkReviewScalarWhereInput | PluginCodingHomeworkReviewScalarWhereInput[]
    OR?: PluginCodingHomeworkReviewScalarWhereInput[]
    NOT?: PluginCodingHomeworkReviewScalarWhereInput | PluginCodingHomeworkReviewScalarWhereInput[]
    id?: StringFilter<"PluginCodingHomeworkReview"> | string
    submissionId?: StringFilter<"PluginCodingHomeworkReview"> | string
    reviewerUserId?: StringFilter<"PluginCodingHomeworkReview"> | string
    score?: FloatNullableFilter<"PluginCodingHomeworkReview"> | number | null
    maxScore?: FloatNullableFilter<"PluginCodingHomeworkReview"> | number | null
    feedback?: StringFilter<"PluginCodingHomeworkReview"> | string
    rubric?: JsonFilter<"PluginCodingHomeworkReview">
    metadata?: JsonFilter<"PluginCodingHomeworkReview">
    createdAt?: DateTimeFilter<"PluginCodingHomeworkReview"> | Date | string
    updatedAt?: DateTimeFilter<"PluginCodingHomeworkReview"> | Date | string
  }

  export type PluginCodingHomeworkSubmissionCreateWithoutFilesInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotCreateNestedOneWithoutSubmissionsInput
    functions?: PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedCreateWithoutFilesInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    documentationSnapshotId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewUncheckedCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionCreateOrConnectWithoutFilesInput = {
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutFilesInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutFilesInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput = {
    id?: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    submission: PluginCodingHomeworkSubmissionCreateNestedOneWithoutFunctionsInput
    questions?: PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionFunctionInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput = {
    id?: string
    submissionId: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionFunctionInput
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutFileInput = {
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateManyFileInputEnvelope = {
    data: PluginCodingHomeworkSubmissionFunctionCreateManyFileInput | PluginCodingHomeworkSubmissionFunctionCreateManyFileInput[]
    skipDuplicates?: boolean
  }

  export type PluginCodingHomeworkSubmissionUpsertWithoutFilesInput = {
    update: XOR<PluginCodingHomeworkSubmissionUpdateWithoutFilesInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutFilesInput>
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutFilesInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutFilesInput>
    where?: PluginCodingHomeworkSubmissionWhereInput
  }

  export type PluginCodingHomeworkSubmissionUpdateToOneWithWhereWithoutFilesInput = {
    where?: PluginCodingHomeworkSubmissionWhereInput
    data: XOR<PluginCodingHomeworkSubmissionUpdateWithoutFilesInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutFilesInput>
  }

  export type PluginCodingHomeworkSubmissionUpdateWithoutFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotUpdateOneWithoutSubmissionsNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateWithoutFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    documentationSnapshotId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUncheckedUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUpsertWithWhereUniqueWithoutFileInput = {
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    update: XOR<PluginCodingHomeworkSubmissionFunctionUpdateWithoutFileInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutFileInput>
    create: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutFileInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutFileInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateWithWhereUniqueWithoutFileInput = {
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    data: XOR<PluginCodingHomeworkSubmissionFunctionUpdateWithoutFileInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutFileInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateManyWithWhereWithoutFileInput = {
    where: PluginCodingHomeworkSubmissionFunctionScalarWhereInput
    data: XOR<PluginCodingHomeworkSubmissionFunctionUpdateManyMutationInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutFileInput>
  }

  export type PluginCodingHomeworkSubmissionCreateWithoutFunctionsInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotCreateNestedOneWithoutSubmissionsInput
    files?: PluginCodingHomeworkSubmissionFileCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedCreateWithoutFunctionsInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    documentationSnapshotId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewUncheckedCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionCreateOrConnectWithoutFunctionsInput = {
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutFunctionsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutFunctionsInput>
  }

  export type PluginCodingHomeworkSubmissionFileCreateWithoutFunctionsInput = {
    id?: string
    path: string
    languageKey?: string | null
    sizeBytes: bigint | number
    sha256: string
    storedName: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    submission: PluginCodingHomeworkSubmissionCreateNestedOneWithoutFilesInput
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutFunctionsInput = {
    id?: string
    submissionId: string
    path: string
    languageKey?: string | null
    sizeBytes: bigint | number
    sha256: string
    storedName: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionFileCreateOrConnectWithoutFunctionsInput = {
    where: PluginCodingHomeworkSubmissionFileWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutFunctionsInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutFunctionsInput>
  }

  export type PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput = {
    id?: string
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    submission: PluginCodingHomeworkSubmissionCreateNestedOneWithoutQuestionsInput
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput = {
    id?: string
    submissionId: string
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionCreateOrConnectWithoutSubmissionFunctionInput = {
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    create: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput>
  }

  export type PluginCodingHomeworkChallengeQuestionCreateManySubmissionFunctionInputEnvelope = {
    data: PluginCodingHomeworkChallengeQuestionCreateManySubmissionFunctionInput | PluginCodingHomeworkChallengeQuestionCreateManySubmissionFunctionInput[]
    skipDuplicates?: boolean
  }

  export type PluginCodingHomeworkSubmissionUpsertWithoutFunctionsInput = {
    update: XOR<PluginCodingHomeworkSubmissionUpdateWithoutFunctionsInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutFunctionsInput>
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutFunctionsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutFunctionsInput>
    where?: PluginCodingHomeworkSubmissionWhereInput
  }

  export type PluginCodingHomeworkSubmissionUpdateToOneWithWhereWithoutFunctionsInput = {
    where?: PluginCodingHomeworkSubmissionWhereInput
    data: XOR<PluginCodingHomeworkSubmissionUpdateWithoutFunctionsInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutFunctionsInput>
  }

  export type PluginCodingHomeworkSubmissionUpdateWithoutFunctionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotUpdateOneWithoutSubmissionsNestedInput
    files?: PluginCodingHomeworkSubmissionFileUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateWithoutFunctionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    documentationSnapshotId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUncheckedUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFileUpsertWithoutFunctionsInput = {
    update: XOR<PluginCodingHomeworkSubmissionFileUpdateWithoutFunctionsInput, PluginCodingHomeworkSubmissionFileUncheckedUpdateWithoutFunctionsInput>
    create: XOR<PluginCodingHomeworkSubmissionFileCreateWithoutFunctionsInput, PluginCodingHomeworkSubmissionFileUncheckedCreateWithoutFunctionsInput>
    where?: PluginCodingHomeworkSubmissionFileWhereInput
  }

  export type PluginCodingHomeworkSubmissionFileUpdateToOneWithWhereWithoutFunctionsInput = {
    where?: PluginCodingHomeworkSubmissionFileWhereInput
    data: XOR<PluginCodingHomeworkSubmissionFileUpdateWithoutFunctionsInput, PluginCodingHomeworkSubmissionFileUncheckedUpdateWithoutFunctionsInput>
  }

  export type PluginCodingHomeworkSubmissionFileUpdateWithoutFunctionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submission?: PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutFilesNestedInput
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedUpdateWithoutFunctionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUpsertWithWhereUniqueWithoutSubmissionFunctionInput = {
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    update: XOR<PluginCodingHomeworkChallengeQuestionUpdateWithoutSubmissionFunctionInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateWithoutSubmissionFunctionInput>
    create: XOR<PluginCodingHomeworkChallengeQuestionCreateWithoutSubmissionFunctionInput, PluginCodingHomeworkChallengeQuestionUncheckedCreateWithoutSubmissionFunctionInput>
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateWithWhereUniqueWithoutSubmissionFunctionInput = {
    where: PluginCodingHomeworkChallengeQuestionWhereUniqueInput
    data: XOR<PluginCodingHomeworkChallengeQuestionUpdateWithoutSubmissionFunctionInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateWithoutSubmissionFunctionInput>
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateManyWithWhereWithoutSubmissionFunctionInput = {
    where: PluginCodingHomeworkChallengeQuestionScalarWhereInput
    data: XOR<PluginCodingHomeworkChallengeQuestionUpdateManyMutationInput, PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionFunctionInput>
  }

  export type PluginCodingHomeworkSubmissionCreateWithoutQuestionsInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotCreateNestedOneWithoutSubmissionsInput
    files?: PluginCodingHomeworkSubmissionFileCreateNestedManyWithoutSubmissionInput
    functions?: PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedCreateWithoutQuestionsInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    documentationSnapshotId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedCreateNestedManyWithoutSubmissionInput
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutSubmissionInput
    reviews?: PluginCodingHomeworkReviewUncheckedCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionCreateOrConnectWithoutQuestionsInput = {
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutQuestionsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutQuestionsInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateWithoutQuestionsInput = {
    id?: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    submission: PluginCodingHomeworkSubmissionCreateNestedOneWithoutFunctionsInput
    file: PluginCodingHomeworkSubmissionFileCreateNestedOneWithoutFunctionsInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutQuestionsInput = {
    id?: string
    submissionId: string
    fileId: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateOrConnectWithoutQuestionsInput = {
    where: PluginCodingHomeworkSubmissionFunctionWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutQuestionsInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutQuestionsInput>
  }

  export type PluginCodingHomeworkSubmissionUpsertWithoutQuestionsInput = {
    update: XOR<PluginCodingHomeworkSubmissionUpdateWithoutQuestionsInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutQuestionsInput>
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutQuestionsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutQuestionsInput>
    where?: PluginCodingHomeworkSubmissionWhereInput
  }

  export type PluginCodingHomeworkSubmissionUpdateToOneWithWhereWithoutQuestionsInput = {
    where?: PluginCodingHomeworkSubmissionWhereInput
    data: XOR<PluginCodingHomeworkSubmissionUpdateWithoutQuestionsInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutQuestionsInput>
  }

  export type PluginCodingHomeworkSubmissionUpdateWithoutQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotUpdateOneWithoutSubmissionsNestedInput
    files?: PluginCodingHomeworkSubmissionFileUpdateManyWithoutSubmissionNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateWithoutQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    documentationSnapshotId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedUpdateManyWithoutSubmissionNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUncheckedUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUpsertWithoutQuestionsInput = {
    update: XOR<PluginCodingHomeworkSubmissionFunctionUpdateWithoutQuestionsInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutQuestionsInput>
    create: XOR<PluginCodingHomeworkSubmissionFunctionCreateWithoutQuestionsInput, PluginCodingHomeworkSubmissionFunctionUncheckedCreateWithoutQuestionsInput>
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateToOneWithWhereWithoutQuestionsInput = {
    where?: PluginCodingHomeworkSubmissionFunctionWhereInput
    data: XOR<PluginCodingHomeworkSubmissionFunctionUpdateWithoutQuestionsInput, PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutQuestionsInput>
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateWithoutQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submission?: PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutFunctionsNestedInput
    file?: PluginCodingHomeworkSubmissionFileUpdateOneRequiredWithoutFunctionsNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutQuestionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionCreateWithoutReviewsInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotCreateNestedOneWithoutSubmissionsInput
    files?: PluginCodingHomeworkSubmissionFileCreateNestedManyWithoutSubmissionInput
    functions?: PluginCodingHomeworkSubmissionFunctionCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedCreateWithoutReviewsInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    documentationSnapshotId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedCreateNestedManyWithoutSubmissionInput
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedCreateNestedManyWithoutSubmissionInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedCreateNestedManyWithoutSubmissionInput
  }

  export type PluginCodingHomeworkSubmissionCreateOrConnectWithoutReviewsInput = {
    where: PluginCodingHomeworkSubmissionWhereUniqueInput
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutReviewsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutReviewsInput>
  }

  export type PluginCodingHomeworkSubmissionUpsertWithoutReviewsInput = {
    update: XOR<PluginCodingHomeworkSubmissionUpdateWithoutReviewsInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutReviewsInput>
    create: XOR<PluginCodingHomeworkSubmissionCreateWithoutReviewsInput, PluginCodingHomeworkSubmissionUncheckedCreateWithoutReviewsInput>
    where?: PluginCodingHomeworkSubmissionWhereInput
  }

  export type PluginCodingHomeworkSubmissionUpdateToOneWithWhereWithoutReviewsInput = {
    where?: PluginCodingHomeworkSubmissionWhereInput
    data: XOR<PluginCodingHomeworkSubmissionUpdateWithoutReviewsInput, PluginCodingHomeworkSubmissionUncheckedUpdateWithoutReviewsInput>
  }

  export type PluginCodingHomeworkSubmissionUpdateWithoutReviewsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    documentationSnapshot?: PluginCodingHomeworkDocumentationSnapshotUpdateOneWithoutSubmissionsNestedInput
    files?: PluginCodingHomeworkSubmissionFileUpdateManyWithoutSubmissionNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateWithoutReviewsInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    documentationSnapshotId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedUpdateManyWithoutSubmissionNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkReferenceFunctionCreateManySnapshotInput = {
    id?: string
    contentResourceId?: string | null
    sourceTitle: string
    sourceKind: string
    languageKey: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionCreateManyDocumentationSnapshotInput = {
    id?: string
    activityId: string
    groupId: string
    userId: string
    coreAttemptId?: string | null
    zipAttachmentId?: string | null
    kind?: $Enums.PluginCodingHomeworkSubmissionKind
    status?: $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionUpdateWithoutSnapshotInput = {
    id?: StringFieldUpdateOperationsInput | string
    contentResourceId?: NullableStringFieldUpdateOperationsInput | string | null
    sourceTitle?: StringFieldUpdateOperationsInput | string
    sourceKind?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionUncheckedUpdateWithoutSnapshotInput = {
    id?: StringFieldUpdateOperationsInput | string
    contentResourceId?: NullableStringFieldUpdateOperationsInput | string | null
    sourceTitle?: StringFieldUpdateOperationsInput | string
    sourceKind?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReferenceFunctionUncheckedUpdateManyWithoutSnapshotInput = {
    id?: StringFieldUpdateOperationsInput | string
    contentResourceId?: NullableStringFieldUpdateOperationsInput | string | null
    sourceTitle?: StringFieldUpdateOperationsInput | string
    sourceKind?: StringFieldUpdateOperationsInput | string
    languageKey?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionUpdateWithoutDocumentationSnapshotInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    files?: PluginCodingHomeworkSubmissionFileUpdateManyWithoutSubmissionNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateWithoutDocumentationSnapshotInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    files?: PluginCodingHomeworkSubmissionFileUncheckedUpdateManyWithoutSubmissionNestedInput
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutSubmissionNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionNestedInput
    reviews?: PluginCodingHomeworkReviewUncheckedUpdateManyWithoutSubmissionNestedInput
  }

  export type PluginCodingHomeworkSubmissionUncheckedUpdateManyWithoutDocumentationSnapshotInput = {
    id?: StringFieldUpdateOperationsInput | string
    activityId?: StringFieldUpdateOperationsInput | string
    groupId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    coreAttemptId?: NullableStringFieldUpdateOperationsInput | string | null
    zipAttachmentId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPluginCodingHomeworkSubmissionKindFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionKind
    status?: EnumPluginCodingHomeworkSubmissionStatusFieldUpdateOperationsInput | $Enums.PluginCodingHomeworkSubmissionStatus
    structureValidationSummary?: JsonNullValueInput | InputJsonValue
    processingError?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionFileCreateManySubmissionInput = {
    id?: string
    path: string
    languageKey?: string | null
    sizeBytes: bigint | number
    sha256: string
    storedName: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateManySubmissionInput = {
    id?: string
    fileId: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionCreateManySubmissionInput = {
    id?: string
    submissionFunctionId?: string | null
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkReviewCreateManySubmissionInput = {
    id?: string
    reviewerUserId: string
    score?: number | null
    maxScore?: number | null
    feedback?: string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionFileUpdateWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    functions?: PluginCodingHomeworkSubmissionFunctionUpdateManyWithoutFileNestedInput
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedUpdateWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    functions?: PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutFileNestedInput
  }

  export type PluginCodingHomeworkSubmissionFileUncheckedUpdateManyWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    path?: StringFieldUpdateOperationsInput | string
    languageKey?: NullableStringFieldUpdateOperationsInput | string | null
    sizeBytes?: BigIntFieldUpdateOperationsInput | bigint | number
    sha256?: StringFieldUpdateOperationsInput | string
    storedName?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    file?: PluginCodingHomeworkSubmissionFileUpdateOneRequiredWithoutFunctionsNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionFunctionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionFunctionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    fileId?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submissionFunction?: PluginCodingHomeworkSubmissionFunctionUpdateOneWithoutQuestionsNestedInput
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedUpdateWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionFunctionId?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionFunctionId?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReviewUpdateWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    reviewerUserId?: StringFieldUpdateOperationsInput | string
    score?: NullableFloatFieldUpdateOperationsInput | number | null
    maxScore?: NullableFloatFieldUpdateOperationsInput | number | null
    feedback?: StringFieldUpdateOperationsInput | string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReviewUncheckedUpdateWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    reviewerUserId?: StringFieldUpdateOperationsInput | string
    score?: NullableFloatFieldUpdateOperationsInput | number | null
    maxScore?: NullableFloatFieldUpdateOperationsInput | number | null
    feedback?: StringFieldUpdateOperationsInput | string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkReviewUncheckedUpdateManyWithoutSubmissionInput = {
    id?: StringFieldUpdateOperationsInput | string
    reviewerUserId?: StringFieldUpdateOperationsInput | string
    score?: NullableFloatFieldUpdateOperationsInput | number | null
    maxScore?: NullableFloatFieldUpdateOperationsInput | number | null
    feedback?: StringFieldUpdateOperationsInput | string
    rubric?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionCreateManyFileInput = {
    id?: string
    submissionId: string
    functionName: string
    functionCode: string
    astText: string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: number | null
    selectedForQuestion?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkSubmissionFunctionUpdateWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submission?: PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutFunctionsNestedInput
    questions?: PluginCodingHomeworkChallengeQuestionUpdateManyWithoutSubmissionFunctionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    questions?: PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionFunctionNestedInput
  }

  export type PluginCodingHomeworkSubmissionFunctionUncheckedUpdateManyWithoutFileInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    functionName?: StringFieldUpdateOperationsInput | string
    functionCode?: StringFieldUpdateOperationsInput | string
    astText?: StringFieldUpdateOperationsInput | string
    embedding?: JsonNullValueInput | InputJsonValue
    nearestExamples?: JsonNullValueInput | InputJsonValue
    divergenceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    selectedForQuestion?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionCreateManySubmissionFunctionInput = {
    id?: string
    submissionId: string
    orderIndex: number
    questionText: string
    studentAnswer?: string | null
    answerSubmittedAt?: Date | string | null
    generationModel: string
    generationPromptVersion: string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUpdateWithoutSubmissionFunctionInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    submission?: PluginCodingHomeworkSubmissionUpdateOneRequiredWithoutQuestionsNestedInput
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedUpdateWithoutSubmissionFunctionInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PluginCodingHomeworkChallengeQuestionUncheckedUpdateManyWithoutSubmissionFunctionInput = {
    id?: StringFieldUpdateOperationsInput | string
    submissionId?: StringFieldUpdateOperationsInput | string
    orderIndex?: IntFieldUpdateOperationsInput | number
    questionText?: StringFieldUpdateOperationsInput | string
    studentAnswer?: NullableStringFieldUpdateOperationsInput | string | null
    answerSubmittedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    generationModel?: StringFieldUpdateOperationsInput | string
    generationPromptVersion?: StringFieldUpdateOperationsInput | string
    nearestExamples?: JsonNullValueInput | InputJsonValue
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use PluginCodingHomeworkDocumentationSnapshotCountOutputTypeDefaultArgs instead
     */
    export type PluginCodingHomeworkDocumentationSnapshotCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkDocumentationSnapshotCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkSubmissionCountOutputTypeDefaultArgs instead
     */
    export type PluginCodingHomeworkSubmissionCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkSubmissionCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkSubmissionFileCountOutputTypeDefaultArgs instead
     */
    export type PluginCodingHomeworkSubmissionFileCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkSubmissionFileCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkSubmissionFunctionCountOutputTypeDefaultArgs instead
     */
    export type PluginCodingHomeworkSubmissionFunctionCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkSubmissionFunctionCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkAssignmentDefaultArgs instead
     */
    export type PluginCodingHomeworkAssignmentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkAssignmentDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginBankCodingHomeworkAssignmentDefaultArgs instead
     */
    export type PluginBankCodingHomeworkAssignmentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginBankCodingHomeworkAssignmentDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkSubmissionRequirementSetDefaultArgs instead
     */
    export type PluginCodingHomeworkSubmissionRequirementSetArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkSubmissionRequirementSetDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginBankCodingHomeworkSubmissionRequirementSetDefaultArgs instead
     */
    export type PluginBankCodingHomeworkSubmissionRequirementSetArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginBankCodingHomeworkSubmissionRequirementSetDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkAttachmentDefaultArgs instead
     */
    export type PluginCodingHomeworkAttachmentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkAttachmentDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkDocumentationSnapshotDefaultArgs instead
     */
    export type PluginCodingHomeworkDocumentationSnapshotArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkDocumentationSnapshotDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkReferenceFunctionDefaultArgs instead
     */
    export type PluginCodingHomeworkReferenceFunctionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkReferenceFunctionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkSubmissionDefaultArgs instead
     */
    export type PluginCodingHomeworkSubmissionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkSubmissionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkSubmissionFileDefaultArgs instead
     */
    export type PluginCodingHomeworkSubmissionFileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkSubmissionFileDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkSubmissionFunctionDefaultArgs instead
     */
    export type PluginCodingHomeworkSubmissionFunctionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkSubmissionFunctionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkChallengeQuestionDefaultArgs instead
     */
    export type PluginCodingHomeworkChallengeQuestionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkChallengeQuestionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PluginCodingHomeworkReviewDefaultArgs instead
     */
    export type PluginCodingHomeworkReviewArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PluginCodingHomeworkReviewDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}