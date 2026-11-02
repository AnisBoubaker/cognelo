/** Safe to share with the editor: no private source text or server dependencies. */
export type TeacherSolutionSelection = {
  files: ReadonlyArray<{ path: string }>;
  functions: ReadonlyArray<{ key: string; sourcePath: string; functionName: string; signature?: { returnType: string; parameterTypes: string[] } }>;
};
type Requirements = {
  requiredFiles: Array<{ path: string; description?: string }>;
  requiredFunctions: Array<{ name: string; filePath?: string; returnType?: string; parameterTypes?: string[]; required?: boolean; description?: string }>;
};

/** Keep unrelated hand-authored requirements; remove only references to removed solution items. */
export function reconcileTeacherSolutionRequirements<T extends Requirements>(requirements: T, previous: TeacherSolutionSelection, next: TeacherSolutionSelection): T {
  const remainingFiles = new Set(next.files.map(file => file.path));
  const removedFiles = new Set(previous.files.filter(file => !remainingFiles.has(file.path)).map(file => file.path));
  return {
    ...requirements,
    requiredFiles: requirements.requiredFiles.filter(file => !removedFiles.has(file.path)),
    requiredFunctions: requirements.requiredFunctions.flatMap(requirement => {
      if (requirement.filePath && removedFiles.has(requirement.filePath)) return [];
      const matches = (fn: TeacherSolutionSelection["functions"][number]) => fn.functionName === requirement.name && (!requirement.filePath || fn.sourcePath === requirement.filePath);
      if (!previous.functions.some(matches)) return [requirement];
      const remaining = next.functions.filter(matches);
      if (!remaining.length) return [];
      return [{ ...requirement, ...(remaining.length === 1 ? remaining[0].signature : {}) }];
    })
  };
}
