"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useI18n } from "@/lib/i18n";

export default function EditCoursePage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    router.replace(`/courses/${params.courseId}?tab=settings&section=general`);
  }, [params.courseId, router]);

  return (
    <AppShell>
      <main className="page stack">
        <p>{t("common.redirecting")}</p>
      </main>
    </AppShell>
  );
}
