"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// La session est lue dans le navigateur : les pages vitrine restent statiques.
export function AuthNav({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const t = useTranslations("auth");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setSignedIn(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  if (signedIn === null) {
    return <span className={className} aria-hidden="true" style={{ visibility: "hidden" }}>{t("signIn")}</span>;
  }

  return (
    <Link href={signedIn ? "/dashboard" : "/login"} onClick={onNavigate} className={className} style={{ color: "var(--ink)" }}>
      {signedIn ? t("mySpace") : t("signIn")}
    </Link>
  );
}
