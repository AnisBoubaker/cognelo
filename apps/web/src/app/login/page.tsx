"use client";

import { AppIcon } from "@/components/app-icon";

import { useNotifications } from "@cognelo/activity-ui";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getAuthenticatedLandingPath, safeLoginReturnPath } from "@/lib/navigation";

export default function LoginPage() {
  const { login, activateAccount } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "activate">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { error: notifyError } = useNotifications();
  const showError = (key: Parameters<typeof t>[0]) => notifyError(t(key));
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      router.replace(loginReturnPath() ?? getAuthenticatedLandingPath(user));
    } catch (err) {
      if (err instanceof ApiError && err.systemCode) notifyError(err.message);
      else showError(err instanceof ApiError && err.code === "SESSION_NOT_ESTABLISHED" ? "login.sessionNotEstablished" : err instanceof ApiError && err.code === "RATE_LIMIT_EXCEEDED" ? "login.rateLimited" : "login.error");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (new TextEncoder().encode(password).byteLength > 72) { showError("login.passwordTooLong"); return; }
      const user = await activateAccount({ email, password, confirmPassword });
      router.replace(loginReturnPath() ?? getAuthenticatedLandingPath(user));
    } catch (err) {
      if (err instanceof ApiError && err.systemCode) notifyError(err.message);
      else showError(err instanceof ApiError && err.code === "SESSION_NOT_ESTABLISHED" ? "login.sessionNotEstablished" : err instanceof ApiError && err.code === "RATE_LIMIT_EXCEEDED" ? "login.rateLimited" : "login.activationError");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="stack">
          <div className="row">
            <div style={{ flex: 1 }} />
            <LocaleSwitcher />
          </div>
          <div className="login-brand-block">
            <BrandLogo priority size="hero" />
            <h1>{mode === "login" ? t("login.title") : t("login.activateTitle")}</h1>
            <p className="muted">{mode === "login" ? t("login.subtitle") : t("login.activateSubtitle")}</p>
          </div>
          <div className="login-mode-toggle" role="tablist" aria-label={t("login.modeLabel")}>
            <button
              aria-selected={mode === "login"}
              className={mode === "login" ? "is-active" : ""}
              type="button"
              onClick={() => setMode("login")}
            >
              {t("login.submit")}
            </button>
            <button
              aria-selected={mode === "activate"}
              className={mode === "activate" ? "is-active" : ""}
              type="button"
              onClick={() => setMode("activate")}
            >
              {t("login.activateCta")}
            </button>
          </div>
          <form className="form" onSubmit={mode === "login" ? handleLogin : handleActivate}>
            <div className="field">
              <label htmlFor="email">{t("login.email")}</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">{t("login.password")}</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {mode === "activate" ? (
              <div className="field">
                <label htmlFor="confirmPassword">{t("login.confirmPassword")}</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            ) : null}
            <button className="login-submit-button" type="submit" disabled={loading}>
              <AppIcon name={mode === "login" ? "login" : "activate"} />
              {loading ? t("login.submitting") : mode === "login" ? t("login.submit") : t("login.activateSubmit")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function loginReturnPath() {
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");
  return safeLoginReturnPath(returnTo, window.location.origin);
}
