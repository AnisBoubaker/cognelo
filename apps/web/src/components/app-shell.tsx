"use client";

import { ContextMenu } from "@cognelo/activity-ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { AppIcon } from "@/components/app-icon";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useI18n } from "@/lib/i18n";
import { getPrimaryLandingPath } from "@/lib/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!loading && user?.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!loading && user && !user.mustChangePassword && user.emailVerified === false) {
      router.replace("/verify-email");
    }
  }, [loading, router, user]);

  if (loading) {
    return <main className="page">{t("common.loading")}</main>;
  }

  if (!user) {
    return <main className="page">{t("common.redirecting")}</main>;
  }

  if (user.mustChangePassword) {
    return <main className="page">{t("common.redirecting")}</main>;
  }

  if (user.emailVerified === false) {
    return <main className="page">{t("common.redirecting")}</main>;
  }

  const canCreateCourses =
    user.roles.includes("course_manager") || user.roles.includes("teacher") || user.roles.includes("admin");
  const navItems = [
    ...(canCreateCourses ? [{ href: "/subjects", label: t("nav.subjects") }] : []),
    ...(canCreateCourses ? [{ href: "/activity-banks", label: t("nav.activityBanks") }] : []),
    { href: "/courses", label: t("nav.courses") },
    ...(canCreateCourses ? [{ href: "/courses/new", label: t("nav.newCourse") }] : [])
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <BrandLogo href={getPrimaryLandingPath(user)} />
        <div className="topbar-actions">
          <nav aria-label="Primary" className="nav nav-primary">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href);
              return (
                <Link key={item.href} className={isActive ? "is-active" : undefined} href={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="account-menu">
            <button
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="menu"
              aria-label={t("nav.accountMenu")}
              className="secondary account-trigger"
              type="button"
              onClick={(event) => {
                setAccountMenuAnchor(event.currentTarget);
                setIsAccountMenuOpen((current) => !current);
              }}
            >
              <span className="account-trigger-label">
                <span className="account-trigger-title">{t("nav.account")}</span>
                <span className="account-trigger-email">{user.email}</span>
              </span>
              <span aria-hidden="true" className={`account-trigger-chevron ${isAccountMenuOpen ? "is-open" : ""}`}>
                <ChevronIcon />
              </span>
            </button>
            <ContextMenu
              anchor={accountMenuAnchor}
              className="account-popover"
              open={isAccountMenuOpen}
              onClose={() => {
                setIsAccountMenuOpen(false);
                setAccountMenuAnchor(null);
              }}
            >
                <div className="account-popover-header">
                  <strong>{user.email}</strong>
                </div>
                <div className="account-popover-section">
                  <LocaleSwitcher showLabel />
                </div>
                <div className="account-popover-section">
                  <Link
                    className="button secondary account-settings-link"
                    href="/settings/profile"
                    role="menuitem"
                    onClick={() => setIsAccountMenuOpen(false)}
                  >
                    {t("nav.settings")}
                  </Link>
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
            </ContextMenu>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function ChevronIcon() {
  return <AppIcon name="chevronDown" size={16} />;
}
