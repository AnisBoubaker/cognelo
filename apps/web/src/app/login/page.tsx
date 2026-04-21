"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { login, activateAccount } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "activate">("login");
  const [email, setEmail] = useState("teacher@cognelo.local");
  const [password, setPassword] = useState("Password123!");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.code === "PENDING_ACCOUNT_SETUP") {
        setMode("activate");
      }
      setError(err instanceof Error ? err.message : t("login.error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await activateAccount({ email, password, confirmPassword });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.activationError"));
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
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              {t("login.submit")}
            </button>
            <button
              aria-selected={mode === "activate"}
              className={mode === "activate" ? "is-active" : ""}
              type="button"
              onClick={() => {
                setMode("activate");
                setError("");
              }}
            >
              {t("login.activateCta")}
            </button>
          </div>
          <form className="form" onSubmit={mode === "login" ? handleLogin : handleActivate}>
            <div className="field">
              <label htmlFor="email">{t("login.email")}</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">{t("login.password")}</label>
              <input
                id="password"
                type="password"
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
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" disabled={loading}>
              {loading ? t("login.submitting") : mode === "login" ? t("login.submit") : t("login.activateSubmit")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
