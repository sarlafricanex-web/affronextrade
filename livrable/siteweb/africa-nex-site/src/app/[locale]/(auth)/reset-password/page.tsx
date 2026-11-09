"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert, ConfirmPasswordField, Field, PasswordInput, SubmitButton } from "@/components/auth/fields";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [checkConfirm, setCheckConfirm] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      document.getElementById("reset-password")?.focus();
      return setError(t("errorWeakPassword"));
    }
    if (password !== confirm) {
      setCheckConfirm(true);
      document.getElementById("reset-confirm")?.focus();
      return;
    }

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
            <Field label={t("newPassword")} hint={t("passwordHint")} htmlFor="reset-password">
              <PasswordInput id="reset-password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ConfirmPasswordField id="reset-confirm" password={password} value={confirm} onChange={setConfirm} forceCheck={checkConfirm} />
            <SubmitButton loading={loading}>{loading ? t("loading") : t("save")}</SubmitButton>
          </>
        )}
      </form>
    </AuthShell>
  );
}
