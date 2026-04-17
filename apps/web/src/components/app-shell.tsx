"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  if (loading) {
    return <main className="page">Loading...</main>;
  }

  if (!user) {
    router.replace("/login");
    return <main className="page">Redirecting...</main>;
  }

  const canCreateCourses = user.roles.includes("teacher") || user.roles.includes("admin");

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          Cognara
        </Link>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/courses">Courses</Link>
          {canCreateCourses ? <Link href="/courses/new">New course</Link> : null}
          <span className="muted">{user.email}</span>
          <button
            className="secondary"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            Logout
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}
