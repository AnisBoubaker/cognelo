import type { ReactNode } from "react";
import { CourseTimeProvider } from "@/components/course-time-provider";

export default async function CourseLayout({ children, params }: { children: ReactNode; params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseTimeProvider key={courseId} courseId={courseId}>{children}</CourseTimeProvider>;
}
