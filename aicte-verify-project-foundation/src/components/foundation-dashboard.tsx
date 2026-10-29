"use client";

import { useMemo, useState } from "react";

type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "officer" | "institution";
  institutionId: string | null;
  mfaEnabled: boolean;
  createdAt?: string;
};

type FoundationSummary = {
  principle: string;
  note: string;
  categories: Array<{ id: string; key: string; name: string; description: string }>;
  checklistItems: Array<{ id: string; categoryId: string; title: string; documentType: string; required: boolean }>;
  institutions: Array<{ id: string; code: string; name: string; state: string; status: string }>;
  totals: {
    records: number;
    applications: number;
    tamperIndicators: number;
  };
};

type AccessLog = {
  id: number;
  action: string;
  resource: string;
  httpMethod: string;
  success: boolean;
  ipAddress: string | null;
  userEmail: string | null;
  userRole: string | null;
  createdAt: string;
};

const copy = {
  en: {
    title: "AICTE-VERIFY • Phase 1 Foundation",
    subtitle: "AI recommends • Evidence explains • Officials decide",
    warning: "No auto-reject: Every flag is an indicator, not proof.",
    bootstrap: "Load YAML rules + synthetic dataset",
    me: "My profile",
    logout: "Logout",
    login: "Login",
    register: "Register",
    email: "Email",
    fullName: "Full name",
    password: "Password",
    institutionCode: "Institution code (optional)",
    mfaSetup: "Enable MFA (TOTP)",
    mfaCode: "MFA code",
    verifyMfa: "Verify MFA",
    refresh: "Refresh summary",
    logs: "Access logs",
    categories: "Application categories",
    institutions: "Institutions",
    checklist: "Checklist items",
  },
  hi: {
    title: "AICTE-VERIFY • चरण 1 आधार",
    subtitle: "AI सुझाव देता है • साक्ष्य समझाता है • अधिकारी निर्णय लेते हैं",
    warning: "कोई ऑटो-रिजेक्ट नहीं: हर फ्लैग केवल संकेतक है, प्रमाण नहीं।",
    bootstrap: "YAML नियम + सिंथेटिक डेटा लोड करें",
    me: "मेरी प्रोफ़ाइल",
    logout: "लॉगआउट",
    login: "लॉगिन",
    register: "रजिस्टर",
    email: "ईमेल",
    fullName: "पूरा नाम",
    password: "पासवर्ड",
    institutionCode: "संस्थान कोड (वैकल्पिक)",
    mfaSetup: "MFA (TOTP) सक्षम करें",
    mfaCode: "MFA कोड",
    verifyMfa: "MFA सत्यापित करें",
    refresh: "सारांश रीफ्रेश करें",
    logs: "एक्सेस लॉग",
    categories: "आवेदन श्रेणियाँ",
    institutions: "संस्थान",
    checklist: "चेकलिस्ट आइटम",
  },
};

export function FoundationDashboard() {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [summary, setSummary] = useState<FoundationSummary | null>(null);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [message, setMessage] = useState<string>("Click bootstrap to initialize Phase 1 data.");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [institutionCode, setInstitutionCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [loginNeedsMfa, setLoginNeedsMfa] = useState(false);

  const t = useMemo(() => copy[lang], [lang]);

  async function api<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Request failed");
    }
    return data as T;
  }

  async function bootstrap() {
    try {
      const data = await api<{ summary: Record<string, number> }>("/api/admin/bootstrap", {
        method: "POST",
      });
      setMessage(`Bootstrap complete: ${JSON.stringify(data.summary)}`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function loadMeAndSummary() {
    try {
      const me = await api<{ user: SessionUser }>("/api/auth/me");
      setUser(me.user);
      const foundation = await api<FoundationSummary>("/api/foundation/summary");
      setSummary(foundation);
      setMessage("Loaded current user and foundation summary.");
    } catch (error) {
      setUser(null);
      setSummary(null);
      setMessage((error as Error).message);
    }
  }

  async function login() {
    try {
      const data = await api<{ user?: SessionUser; requiresMfa?: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, mfaCode: mfaCode || undefined }),
      });

      if (data.requiresMfa) {
        setLoginNeedsMfa(true);
        setMessage("MFA required. Enter TOTP code and login again.");
        return;
      }

      setLoginNeedsMfa(false);
      setMfaCode("");
      setMessage("Login successful.");
      await loadMeAndSummary();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function register() {
    try {
      await api<{ user: SessionUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName, institutionCode: institutionCode || undefined }),
      });
      setMessage("Registered and logged in.");
      await loadMeAndSummary();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function logout() {
    try {
      await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
      setUser(null);
      setSummary(null);
      setLogs([]);
      setMessage("Logged out.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function initMfa() {
    try {
      const data = await api<{ otpAuthUrl: string; secret: string }>("/api/auth/mfa/setup", {
        method: "POST",
      });
      setMessage(`MFA secret generated. Add this URI in Authenticator app: ${data.otpAuthUrl}`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function verifyMfa() {
    try {
      await api<{ ok: boolean }>("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: mfaCode }),
      });
      setMessage("MFA enabled successfully.");
      await loadMeAndSummary();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function loadLogs() {
    try {
      const data = await api<{ logs: AccessLog[] }>("/api/admin/access-logs");
      setLogs(data.logs);
      setMessage("Loaded access logs.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{t.title}</h1>
              <p className="text-sm text-slate-600">{t.subtitle}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-1" onClick={() => setLang("en")}>EN</button>
              <button className="rounded-md border px-3 py-1" onClick={() => setLang("hi")}>हिं</button>
            </div>
          </div>
          <p className="mt-3 rounded-md bg-amber-100 p-2 text-sm text-amber-900">{t.warning}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Auth</h2>
            <div className="grid gap-2">
              <input className="rounded-md border p-2" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="rounded-md border p-2" placeholder={t.fullName} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className="rounded-md border p-2" placeholder={t.password} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input
                className="rounded-md border p-2"
                placeholder={t.institutionCode}
                value={institutionCode}
                onChange={(e) => setInstitutionCode(e.target.value)}
              />
              {loginNeedsMfa ? (
                <input className="rounded-md border p-2" placeholder={t.mfaCode} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md bg-slate-900 px-3 py-2 text-white" onClick={login}>{t.login}</button>
              <button className="rounded-md bg-slate-700 px-3 py-2 text-white" onClick={register}>{t.register}</button>
              <button className="rounded-md border px-3 py-2" onClick={loadMeAndSummary}>{t.refresh}</button>
              <button className="rounded-md border px-3 py-2" onClick={logout}>{t.logout}</button>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Phase 1 Controls</h2>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-indigo-600 px-3 py-2 text-white" onClick={bootstrap}>{t.bootstrap}</button>
              <button className="rounded-md border px-3 py-2" onClick={initMfa}>{t.mfaSetup}</button>
              <input className="rounded-md border p-2" placeholder={t.mfaCode} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
              <button className="rounded-md border px-3 py-2" onClick={verifyMfa}>{t.verifyMfa}</button>
              <button className="rounded-md border px-3 py-2" onClick={loadLogs}>{t.logs}</button>
            </div>
            <p className="mt-4 text-sm text-slate-600">{t.me}: {user ? `${user.fullName} (${user.role})` : "not logged in"}</p>
          </section>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-700">{message}</p>
        </div>

        {summary ? (
          <div className="grid gap-5 md:grid-cols-3">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-medium">{t.categories}</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {summary.categories.map((cat) => (
                  <li key={cat.id} className="rounded bg-slate-50 p-2">{cat.name}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-medium">{t.institutions}</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {summary.institutions.map((inst) => (
                  <li key={inst.id} className="rounded bg-slate-50 p-2">{inst.code} • {inst.name}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-medium">{t.checklist}</h3>
              <p className="mt-2 text-sm">Total: {summary.checklistItems.length}</p>
              <p className="mt-1 text-sm">Applications: {summary.totals.applications}</p>
              <p className="mt-1 text-sm">Records: {summary.totals.records}</p>
              <p className="mt-1 text-sm">Tamper indicators: {summary.totals.tamperIndicators}</p>
            </section>
          </div>
        ) : null}

        {logs.length > 0 ? (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-medium">{t.logs}</h3>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">Time</th>
                    <th className="p-2">User</th>
                    <th className="p-2">Action</th>
                    <th className="p-2">Resource</th>
                    <th className="p-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="p-2">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-2">{log.userEmail ?? "system"}</td>
                      <td className="p-2">{log.action}</td>
                      <td className="p-2">{log.resource}</td>
                      <td className="p-2">{log.success ? "success" : "failed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
