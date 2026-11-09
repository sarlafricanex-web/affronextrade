"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert, Field, SubmitButton, TextInput } from "@/components/auth/fields";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("errorWeakPassword"));
    if (password !== confirm) return setError(t("errorMismatch"));

    setLoading(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      // Sans session de reinitialisation valide, le lien recu par email a expire.
      if (updateError.name === "AuthSessionMissingError") setExpired(true);
      else setError(updateError.code === "weak_password" ? t("errorWeakPassword") : t("errorGeneric"));
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <h1 className="font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("resetTitle")}</h1>
        {expired ? (
          <>
            <Alert tone="error">{t("errorLinkExpired")}</Alert>
            <Link href="/forgot-password" className="text-sm font-semibold underline">{t("sendLink")}</Link>
          </>
        ) : (
          <>
            {error && <Alert tone="error">{error}</Alert>}
            <Field label={t("newPassword")} hint={t("passwordHint")}>
              <TextInput id="reset-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label={t("confirmPassword")}>
              <TextInput id="reset-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <SubmitButton loading={loading}>{loading ? t("loading") : t("save")}</SubmitButton>
          </>
        )}
      </form>
    </AuthShell>
  );
}
