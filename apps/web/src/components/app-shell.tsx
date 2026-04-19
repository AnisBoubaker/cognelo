"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useI18n } from "@/lib/i18n";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  if (loading) {
    return <main className="page">{t("common.loading")}</main>;
  }

  if (!user) {
    return <main className="page">{t("common.redirecting")}</main>;
  }

  const canCreateCourses = user.roles.includes("teacher") || user.roles.includes("admin");
  const navItems = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/courses", label: t("nav.courses") },
    ...(canCreateCourses ? [{ href: "/courses/new", label: t("nav.newCourse") }] : [])
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <BrandLogo href="/dashboard" />
        <div className="topbar-actions">
          <nav aria-label="Primary" className="nav nav-primary">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link key={item.href} className={isActive ? "is-active" : undefined} href={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="account-menu" ref={accountMenuRef}>
            <button
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="menu"
              aria-label={t("nav.accountMenu")}
              className="secondary account-trigger"
              type="button"
              onClick={() => setIsAccountMenuOpen((current) => !current)}
            >
              <span className="account-trigger-label">
                <span className="account-trigger-title">{t("nav.account")}</span>
                <span className="account-trigger-email">{user.email}</span>
              </span>
              <span aria-hidden="true" className={`account-trigger-chevron ${isAccountMenuOpen ? "is-open" : ""}`}>
                <ChevronIcon />
              </span>
            </button>
            {isAccountMenuOpen ? (
              <div className="account-popover" role="menu">
                <div className="account-popover-header">
                  <strong>{user.email}</strong>
                </div>
                <div className="account-popover-section">
                  <LocaleSwitcher showLabel />
                </div>
                <div className="account-popover-section">
                  <button
                    className="secondary account-logout"
                    type="button"
                    onClick={async () => {
                      setIsAccountMenuOpen(false);
                      await logout();
                      router.replace("/login");
                    }}
                  >
                    {t("common.logout")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
