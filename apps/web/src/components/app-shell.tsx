"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useI18n } from "@/lib/i18n";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  if (loading) {
    return <main className="page">{t("common.loading")}</main>;
  }

  if (!user) {
    router.replace("/login");
    return <main className="page">{t("common.redirecting")}</main>;
  }

  const canCreateCourses = user.roles.includes("teacher") || user.roles.includes("admin");

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          Cognara
        </Link>
        <nav className="nav">
          <Link href="/dashboard">{t("nav.dashboard")}</Link>
          <Link href="/courses">{t("nav.courses")}</Link>
          {canCreateCourses ? <Link href="/courses/new">{t("nav.newCourse")}</Link> : null}
          <LocaleSwitcher />
          <span className="muted">{user.email}</span>
          <button
            className="secondary"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            {t("common.logout")}
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}
