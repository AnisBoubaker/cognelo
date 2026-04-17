"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const roles = user?.roles.map((role) => t(`roles.${role}`)).join(", ") ?? "";

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel stack">
          <div className="hero-meta">
            <p className="eyebrow">{t("dashboard.eyebrow")}</p>
            <h1>{t("dashboard.welcome")}{user?.name ? `, ${user.name}` : ""}</h1>
            <p className="muted">{t("dashboard.roles", { roles })}</p>
          </div>
        </section>
        <section className="grid">
          <Link className="card" href="/courses">
            <span className="eyebrow">{t("dashboard.coursesEyebrow")}</span>
            <h2>{t("dashboard.coursesTitle")}</h2>
            <p className="muted">{t("dashboard.coursesText")}</p>
          </Link>
          <article className="card">
            <span className="eyebrow">{t("dashboard.activitiesEyebrow")}</span>
            <h2>{t("dashboard.activitiesTitle")}</h2>
            <p className="muted">{t("dashboard.activitiesText")}</p>
          </article>
          <article className="card">
            <span className="eyebrow">{t("dashboard.researchEyebrow")}</span>
            <h2>{t("dashboard.researchTitle")}</h2>
            <p className="muted">{t("dashboard.researchText")}</p>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
