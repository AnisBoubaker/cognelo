CREATE TABLE "PluginCodingExerciseReferenceSolution" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "validationSummary" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginCodingExerciseReferenceSolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluginCodingExerciseReferenceSolution_activityId_key" ON "PluginCodingExerciseReferenceSolution"("activityId");

ALTER TABLE "PluginCodingExerciseReferenceSolution"
ADD CONSTRAINT "PluginCodingExerciseReferenceSolution_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
