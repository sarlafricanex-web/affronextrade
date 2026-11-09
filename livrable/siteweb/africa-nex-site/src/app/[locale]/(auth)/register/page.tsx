"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Alert, Divider, Field, SubmitButton, TextInput } from "@/components/auth/fields";

type Role = "producer" | "buyer";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [role, setRole] = useState<Role>("producer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("errorWeakPassword"));
    if (!consent) return setError(t("errorConsent"));

    setLoading(true);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", `/${locale}/dashboard`);
    const { data, error: signUpError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), role, locale, phone: phone.trim() },
        emailRedirectTo: callback.toString(),
      },
    });
    if (signUpError) {
      const taken = signUpError.code === "user_already_exists" || signUpError.code === "email_exists";
      setError(taken ? t("errorEmailTaken") : signUpError.code === "weak_password" ? t("errorWeakPassword") : t("errorGeneric"));
      setLoading(false);
      return;
    }
    if (data.session) {
      router.replace("/dashboard");
      return;
    }
    // Confirmation d'email active (en production) : la session arrive apres le clic dans l'email.
    setCheckEmail(true);
    setLoading(false);
  }

  if (checkEmail) {
    return (
      <AuthShell>
        <div className="flex flex-col gap-6">
          <h1 className="font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("registerTitle")}</h1>
          <Alert tone="success">{t("checkEmail")}</Alert>
          <Link href="/login" className="text-sm font-semibold underline">{t("backToLogin")}</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <div>
          <h1 className="font-extrabold" style={{ fontSize: "var(--step-title)", lineHeight: 1 }}>{t("registerTitle")}</h1>
          <p className="mt-3" style={{ color: "var(--muted)" }}>{t("registerSubtitle")}</p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>{t("youAre")}</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            {(["producer", "buyer"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => setRole(value)}
                className="text-start p-4"
                style={{ background: "white", border: role === value ? "2px solid var(--accent)" : "1px solid var(--field-b)" }}
              >
                <span className="block font-bold">{t(value === "producer" ? "roleProducer" : "roleBuyer")}</span>
                <span className="mt-1 block text-sm" style={{ color: "var(--muted)" }}>
                  {t(value === "producer" ? "roleProducerDesc" : "roleBuyerDesc")}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <GoogleButton role={role} onError={() => setError(t("errorGeneric"))} />
        <Divider label={t("or")} />

        <Field label={t("fullName")}>
          <TextInput id="register-name" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={t("email")}>
          <TextInput id="register-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("password")} hint={t("passwordHint")}>
          <TextInput id="register-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t("phone")}>
          <TextInput id="register-phone" type="tel" autoComplete="tel" placeholder="+213" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>

        <label className="flex items-start gap-3 text-sm" style={{ color: "var(--muted)" }}>
          <input id="register-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          <span>
            {t("consentBefore")}{" "}
            <Link href="/legal" className="font-semibold underline" style={{ color: "var(--ink)" }}>{t("consentLink")}</Link>
          </span>
        </label>

        <SubmitButton loading={loading}>{loading ? t("loading") : t("createAccount")}</SubmitButton>

        <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-semibold underline" style={{ color: "var(--ink)" }}>{t("signIn")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
