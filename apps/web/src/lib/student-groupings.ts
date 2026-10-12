import type { SubjectTeachingLanguage } from "@cognelo/contracts";
import { translateMessage } from "./i18n";

export function nextStudentTeamName(existingNames: string[], teachingLanguage: SubjectTeachingLanguage) {
  const names = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  let number = existingNames.length + 1;
  let name: string;
  do {
    name = translateMessage(teachingLanguage, "studentGroupings.defaultTeamName", { number: number++ });
  } while (names.has(name.toLowerCase()));
  return name;
}

export function randomlyAssignStudents<T extends { participantIds: string[] }>(
  teams: T[], studentIds: string[], random: () => number = Math.random
): T[] {
  if (!teams.length) return [];
  const result = teams.map((team) => ({ ...team, participantIds: [] as string[] }));
  const shuffledStudents = [...studentIds];
  // Fisher–Yates keeps every student equally likely to occupy each slot.
  for (let index = shuffledStudents.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffledStudents[index], shuffledStudents[other]] = [shuffledStudents[other]!, shuffledStudents[index]!];
  }
  // Vary the starting team so the same teams do not always receive the extra students.
  const offset = Math.floor(random() * result.length);
  shuffledStudents.forEach((id, index) => result[(index + offset) % result.length]!.participantIds.push(id));
  result.forEach((team) => team.participantIds.sort());
  return result;
}
