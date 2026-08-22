"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useAuth } from "@/components/auth-provider";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getAuthenticatedLandingPath } from "@/lib/navigation";

export default function VerifyEmailPage() {
  const { user, loading, logout, refresh } = useAuth();
  const router = useRouter();
  const { locale, ready: localeReady, t } = useI18n();
  const initialRequestStarted = useRef(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const interval = window.setInterval(() => {
      setRetryAfterSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [retryAfterSeconds]);

  const sendCode = useCallback(async () => {
    setError("");
    setSending(true);
    try {
      const result = await api.requestEmailVerification({ locale });
      setRetryAfterSeconds(result.retryAfterSeconds);
      setStatus(result.sent ? t("emailVerification.sent") : t("emailVerification.recentlySent"));
    } catch (err) {
      setStatus("");
      setError(emailVerificationError(err, t));
    } finally {
      setSending(false);
    }
  }, [locale, t]);

  useEffect(() => {
    if (loading || !localeReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.mustChangePassword) {
      router.replace("/change-password");
      return;
    }
    if (user.emailVerified !== false) {
      router.replace(getAuthenticatedLandingPath(user));
      return;
    }
    if (!initialRequestStarted.current) {
      initialRequestStarted.current = true;
      void sendCode();
    }
  }, [loading, localeReady, router, sendCode, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setVerifying(true);
    try {
      await api.verifyEmailAddress({ code });
      await refresh();
      if (user) {
        router.replace(getAuthenticatedLandingPath({ ...user, emailVerified: true }));
      }
    } catch (err) {
      setError(emailVerificationError(err, t));
    } finally {
      setVerifying(false);
    }
  }

  if (loading || !localeReady || !user || user.mustChangePassword || user.emailVerified !== false) {
    return <main className="page">{t("common.redirecting")}</main>;
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="stack">
          <div className="row">
            <button className="secondary" type="button" onClick={async () => { await logout(); router.replace("/login"); }}>
              {t("common.logout")}
            </button>
            <div style={{ flex: 1 }} />
            <LocaleSwitcher />
          </div>
          <div className="login-brand-block">
            <BrandLogo priority size="hero" />
            <p className="eyebrow">{t("emailVerification.eyebrow")}</p>
            <h1>{t("emailVerification.title")}</h1>
            <p className="muted">{t("emailVerification.help", { email: user.email })}</p>
          </div>
          <form className="form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="verificationCode">{t("emailVerification.code")}</label>
              <input
                autoComplete="one-time-code"
                autoFocus
                id="verificationCode"
                inputMode="numeric"
                maxLength={6}
                minLength={6}
                pattern="[0-9]{6}"
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <p className="muted">{t("emailVerification.expires")}</p>
            {status ? <p className="success-message" role="status">{status}</p> : null}
            {error ? <p className="error" role="alert">{error}</p> : null}
            <button className="login-submit-button" disabled={verifying || code.length !== 6} type="submit">
              {verifying ? t("emailVerification.verifying") : t("emailVerification.verify")}
            </button>
            <button className="secondary" disabled={sending || retryAfterSeconds > 0} type="button" onClick={() => void sendCode()}>
              {sending
                ? t("emailVerification.sending")
                : retryAfterSeconds > 0
                  ? t("emailVerification.resendCountdown", { seconds: retryAfterSeconds })
                  : t("emailVerification.resend")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function emailVerificationError(
  error: unknown,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (error instanceof ApiError) {
    const keyByCode: Record<string, string> = {
      EMAIL_VERIFICATION_CODE_MISSING: "emailVerification.missing",
      EMAIL_VERIFICATION_CODE_EXPIRED: "emailVerification.expired",
      EMAIL_VERIFICATION_CODE_INCORRECT: "emailVerification.incorrect",
      EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED: "emailVerification.attemptsExceeded",
      EMAIL_DELIVERY_NOT_CONFIGURED: "emailVerification.deliveryUnavailable",
      EMAIL_DELIVERY_FAILED: "emailVerification.deliveryFailed",
      EMAIL_ENCRYPTION_KEY_MISSING: "emailVerification.deliveryUnavailable"
    };
    const key = error.code ? keyByCode[error.code] : undefined;
    if (key) return t(key);
  }
  return error instanceof Error ? error.message : t("emailVerification.error");
}
