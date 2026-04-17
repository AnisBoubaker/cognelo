"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("teacher@cognara.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.error"));
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
          <div>
            <p className="eyebrow">Cognara</p>
            <h1>{t("login.title")}</h1>
            <p className="muted">{t("login.subtitle")}</p>
          </div>
          <form className="form" onSubmit={handleSubmit}>
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
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" disabled={loading}>
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
