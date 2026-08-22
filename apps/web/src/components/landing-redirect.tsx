"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";
import { getAuthenticatedLandingPath } from "@/lib/navigation";

export function LandingRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? getAuthenticatedLandingPath(user) : "/login");
  }, [loading, router, user]);

  return <main className="page">{loading ? t("common.loading") : t("common.redirecting")}</main>;
}
