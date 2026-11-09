"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert, Field, SubmitButton, TextInput } from "@/components/auth/fields";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setLoading(true);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", `/${locale}/reset-password`);
    await createClient().auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
    // Message identique que le compte existe ou non : on ne revele pas les adresses inscrites.
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("forgotTitle")}</h1>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{t("forgotText")}</p>
        </div>
        {sent ? (
          <Alert tone="success">{t("forgotSent")}</Alert>
        ) : (
          <>
            <Field label={t("email")}>
              <TextInput id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <SubmitButton loading={loading}>{loading ? t("loading") : t("sendLink")}</SubmitButton>
          </>
        )}
        <Link href="/login" className="text-sm font-semibold underline">{t("backToLogin")}</Link>
      </form>
    </AuthShell>
  );
}
