"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  const roles = user?.roles.join(", ") ?? "";

  return (
    <AppShell>
      <main className="page stack">
        <section>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
          <p className="muted">Roles: {roles}</p>
        </section>
        <section className="grid">
          <Link className="card" href="/courses">
            <span className="eyebrow">Courses</span>
            <h2>Manage learning spaces</h2>
            <p className="muted">Create, publish, archive, and open the course workspace.</p>
          </Link>
          <article className="card">
            <span className="eyebrow">Activities</span>
            <h2>Plugin-ready foundation</h2>
            <p className="muted">Attach placeholders now, then add homework graders, quizzes, and tutoring modules later.</p>
          </article>
          <article className="card">
            <span className="eyebrow">Research</span>
            <h2>Metadata first</h2>
            <p className="muted">Activities carry configurable metadata from the start.</p>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
