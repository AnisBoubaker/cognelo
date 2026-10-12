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

export function randomlyAssignStudents<T extends { participantIds: string[]; capacity: number }>(
  teams: T[], studentIds: string[], scope: "unassigned" | "all", random: () => number = Math.random
): T[] {
  const result = teams.map((team) => ({ ...team, participantIds: scope === "all" ? [] as string[] : [...team.participantIds] }));
  const assigned = new Set(result.flatMap((team) => team.participantIds));
  const shuffledStudents = studentIds.filter((id) => !assigned.has(id));
  for (let index = shuffledStudents.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffledStudents[index], shuffledStudents[other]] = [shuffledStudents[other]!, shuffledStudents[index]!];
  }
  for (const id of shuffledStudents) {
    const available = result.filter((team) => team.participantIds.length < team.capacity);
    if (!available.length) break;
    const smallest = Math.min(...available.map((team) => team.participantIds.length));
    const candidates = available.filter((team) => team.participantIds.length === smallest);
    candidates[Math.floor(random() * candidates.length)]!.participantIds.push(id);
  }
  result.forEach((team) => team.participantIds.sort());
  return result;
}

export function toTeamChoiceLocalDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
