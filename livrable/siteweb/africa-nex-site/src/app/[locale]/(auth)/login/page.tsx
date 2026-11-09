"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/next-path";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Alert, Divider, Field, PasswordInput, SubmitButton, TextInput } from "@/components/auth/fields";

// Lien de connexion ou de reinitialisation invalide : signale par /auth/callback (?error=link).
function LinkErrorNotice() {
  const t = useTranslations("auth");
  return useSearchParams().get("error") ? <Alert tone="error">{t("errorLinkExpired")}</Alert> : null;
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.code === "invalid_credentials" ? t("errorInvalidCredentials") : t("errorGeneric"));
      setLoading(false);
      return;
    }
    // Rechargement complet : les pages serveur relisent la nouvelle session.
    window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get("next"), locale));
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <div>
          <h1 className="font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("loginTitle")}</h1>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{t("loginSubtitle")}</p>
        </div>

        <Suspense fallback={null}>
          <LinkErrorNotice />
        </Suspense>
        {error && <Alert tone="error">{error}</Alert>}

        <GoogleButton onError={() => setError(t("errorGeneric"))} />
        <Divider label={t("or")} />

        <Field label={t("email")}>
          <TextInput id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("password")} htmlFor="login-password">
          <PasswordInput id="login-password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Link href="/forgot-password" className="self-end text-sm font-semibold underline">{t("forgotLink")}</Link>

        <SubmitButton loading={loading}>{loading ? t("loading") : t("signIn")}</SubmitButton>

        <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
          {t("noAccount")}{" "}
          <Link href="/register" className="font-semibold underline" style={{ color: "var(--ink)" }}>{t("createLink")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
