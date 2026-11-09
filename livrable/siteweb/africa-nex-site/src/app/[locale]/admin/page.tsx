"use client";

import { useState, useCallback } from "react";

interface Submission {
  id: number;
  name: string;
  email: string;
  company: string;
  country: string;
  phone: string;
  whatsapp: string;
  message: string;
  created_at: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${password}` }),
    [password]
  );

  async function login() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/submissions?limit=100", {
        headers: headers(),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur");
        return;
      }
      const data = await res.json();
      setSubmissions(data.submissions);
      setTotal(data.total);
      setAuthed(true);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/submissions?limit=500", {
        headers: headers(),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    const res = await fetch("/api/admin/export", { headers: headers() });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-africanex-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <div style={{ paddingTop: "5rem" }}>
        <section
          className="flex flex-col items-center justify-center"
          style={{ padding: "var(--section-gap) var(--page-margin)", minHeight: "60svh" }}
        >
          <div style={{ maxWidth: 380, width: "100%" }}>
            <h1
              className="font-extrabold mb-2"
              style={{ fontSize: "var(--step-title)", lineHeight: 1 }}
            >
              Admin
            </h1>
            <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
              Entrez le mot de passe administrateur
            </p>
            {error && (
              <p className="mb-4 text-sm" style={{ color: "#dc2626" }}>{error}</p>
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="Mot de passe"
              className="w-full px-4 py-3 text-sm mb-4"
              style={{ background: "var(--field-a)", border: "none", outline: "none" }}
            />
            <button
              onClick={login}
              disabled={loading || !password}
              className="w-full text-sm font-semibold py-3 disabled:opacity-50"
              style={{ background: "var(--ink)", color: "var(--ground)" }}
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: "5rem" }}>
      <section style={{ padding: "2rem var(--page-margin)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1
              className="font-extrabold"
              style={{ fontSize: "var(--step-title)", lineHeight: 1 }}
            >
              Contacts
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {total} soumission{total !== 1 ? "s" : ""} au total
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={refresh}
              disabled={loading}
              className="text-xs font-medium px-4 py-2"
              style={{ border: "1px solid var(--field-b)", background: "transparent" }}
            >
              {loading ? "..." : "Actualiser"}
            </button>
            <button
              onClick={exportExcel}
              className="text-xs font-medium px-4 py-2"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Exporter Excel
            </button>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div
            className="text-center py-16"
            style={{ color: "var(--muted)" }}
          >
            <p className="text-lg">Aucune soumission pour le moment</p>
            <p className="text-sm mt-2">
              Les contacts apparaitront ici des qu&apos;un visiteur remplira le formulaire.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--field-b)" }}>
                  <th className="text-left py-3 px-3 font-semibold">Date</th>
                  <th className="text-left py-3 px-3 font-semibold">Nom</th>
                  <th className="text-left py-3 px-3 font-semibold">Email</th>
                  <th className="text-left py-3 px-3 font-semibold hidden md:table-cell">Entreprise</th>
                  <th className="text-left py-3 px-3 font-semibold hidden lg:table-cell">Pays</th>
                  <th className="text-left py-3 px-3 font-semibold hidden lg:table-cell">Tel</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer"
                    style={{ borderBottom: "1px solid var(--field-b)" }}
                    onClick={() => setSelected(s)}
                  >
                    <td className="py-3 px-3 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {new Date(s.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 font-medium">{s.name}</td>
                    <td className="py-3 px-3">
                      <a href={`mailto:${s.email}`} className="underline">{s.email}</a>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell">{s.company || "-"}</td>
                    <td className="py-3 px-3 hidden lg:table-cell">{s.country || "-"}</td>
                    <td className="py-3 px-3 hidden lg:table-cell">{s.phone || "-"}</td>
                    <td className="py-3 px-3">
                      <button
                        className="text-xs px-2 py-1"
                        style={{ color: "var(--accent)" }}
                        onClick={(e) => { e.stopPropagation(); setSelected(s); }}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setSelected(null)}
          >
            <div
              className="mx-4 w-full max-w-lg rounded-lg overflow-hidden"
              style={{ background: "var(--ground)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--field-b)" }}>
                <h2 className="font-bold text-lg">{selected.name}</h2>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xl leading-none"
                  style={{ color: "var(--muted)" }}
                >
                  &times;
                </button>
              </div>
              <div className="px-6 py-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-semibold" style={{ color: "var(--muted)" }}>Email</p>
                    <a href={`mailto:${selected.email}`} className="underline">{selected.email}</a>
                  </div>
                  {selected.company && (
                    <div>
                      <p className="font-semibold" style={{ color: "var(--muted)" }}>Entreprise</p>
                      <p>{selected.company}</p>
                    </div>
                  )}
                  {selected.country && (
                    <div>
                      <p className="font-semibold" style={{ color: "var(--muted)" }}>Pays</p>
                      <p>{selected.country}</p>
                    </div>
                  )}
                  {selected.phone && (
                    <div>
                      <p className="font-semibold" style={{ color: "var(--muted)" }}>Telephone</p>
                      <p>{selected.phone}</p>
                    </div>
                  )}
                  {selected.whatsapp && (
                    <div>
                      <p className="font-semibold" style={{ color: "var(--muted)" }}>WhatsApp</p>
                      <a href={`https://wa.me/${selected.whatsapp.replace(/\D/g, "")}`} className="underline" target="_blank" rel="noopener noreferrer">
                        {selected.whatsapp}
                      </a>
                    </div>
                  )}
                </div>
                {selected.message && (
                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--muted)" }}>Message</p>
                    <p
                      className="whitespace-pre-wrap px-3 py-2 rounded"
                      style={{ background: "var(--field-a)" }}
                    >
                      {selected.message}
                    </p>
                  </div>
                )}
                <p className="text-xs pt-2" style={{ color: "var(--muted)" }}>
                  Recu le {new Date(selected.created_at).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="px-6 py-4 flex gap-2" style={{ borderTop: "1px solid var(--field-b)" }}>
                <a
                  href={`mailto:${selected.email}`}
                  className="text-xs font-semibold px-4 py-2"
                  style={{ background: "var(--ink)", color: "var(--ground)" }}
                >
                  Repondre par email
                </a>
                {selected.whatsapp && (
                  <a
                    href={`https://wa.me/${selected.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold px-4 py-2"
                    style={{ background: "#25D366", color: "white" }}
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
