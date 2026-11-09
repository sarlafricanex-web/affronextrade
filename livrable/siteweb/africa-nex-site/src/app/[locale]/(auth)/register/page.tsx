"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Alert, ConfirmPasswordField, Divider, Field, PasswordInput, SubmitButton, TextInput } from "@/components/auth/fields";
import { PhoneField } from "@/components/phone/PhoneField";
import { isValidPhone } from "@/lib/phone";

type Role = "producer" | "buyer";

// Sur telephone, le message en haut du formulaire peut etre hors de vue :
// le curseur va aussi dans le champ a corriger.
const focusField = (id: string) => document.getElementById(id)?.focus();

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [role, setRole] = useState<Role>("producer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [checkConfirm, setCheckConfirm] = useState(false);
  const [phone, setPhone] = useState(""); // format international : +213555123456
  const [checkPhone, setCheckPhone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      focusField("register-password");
      return setError(t("errorWeakPassword"));
    }
    if (password !== confirm) {
      setCheckConfirm(true);
      return focusField("register-confirm");
    }
    // Telephone obligatoire (contact par WhatsApp, puis SMS en v2). Les comptes Google le
    // donneront a l'etape de configuration du compte.
    if (!phone || !isValidPhone(phone)) {
      setCheckPhone(true);
      return focusField("register-phone");
    }
    if (!consent) {
      focusField("register-consent");
      return setError(t("errorConsent"));
    }

    setLoading(true);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", `/${locale}/dashboard`);
    const { data, error: signUpError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), role, locale, phone },
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
        <Field label={t("password")} hint={t("passwordHint")} htmlFor="register-password">
          <PasswordInput id="register-password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ConfirmPasswordField id="register-confirm" password={password} value={confirm} onChange={setConfirm} forceCheck={checkConfirm} />
        <Field label={t("phone")} htmlFor="register-phone">
          <PhoneField id="register-phone" required onChange={setPhone} forceCheck={checkPhone} />
        </Field>

        <label className="flex items-start gap-3 text-sm" style={{ color: "var(--muted)" }}>
          <input id="register-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          <span>
            {t("consentBefore")}{" "}
            <Link href="/legal" className="font-semibold underline" style={{ color: "var(--ink)" }}>{t("consentLink")}</Link>
          </span>
        </label>

        {/* Formulaire long : le message s'affiche pres du bouton, la ou se porte le regard a l'envoi. */}
        {error && <Alert tone="error">{error}</Alert>}
        <SubmitButton loading={loading}>{loading ? t("loading") : t("createAccount")}</SubmitButton>

        <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-semibold underline" style={{ color: "var(--ink)" }}>{t("signIn")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
