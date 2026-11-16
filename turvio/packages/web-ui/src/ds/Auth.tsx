"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "./cn";
import { useDsLabels } from "./Labels";
import { Input } from "./Input";
import { ThemeSwitch } from "./Theme";
import { TurvioLockup } from "./Wordmark";

/** Full-page layout for sign-in flows – TURVIO NEXT hero language (violet glow, masked grid). */
export function AuthLayout({ product, title, subtitle, children, footer }: { product: string; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const L = useDsLabels();
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_0%,rgba(117,91,255,.32)_0%,rgba(52,120,255,.12)_40%,transparent_72%),radial-gradient(50%_50%_at_0%_100%,rgba(24,217,232,.10)_0%,transparent_70%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(var(--hero-line)_1px,transparent_1px),linear-gradient(90deg,var(--hero-line)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_70%_at_75%_10%,#000_0%,transparent_70%)]"
      />
      <div className="relative w-full max-w-[420px] animate-nx-view">
        <div className="mb-8 flex flex-col items-center gap-3">
          <TurvioLockup height={30} />
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-nx-violet-text">{product}</span>
        </div>
        <div className="rounded-[22px] border border-line-strong bg-surface p-6 shadow-overlay sm:p-8">
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[13px] text-muted">{footer}</div>}
        <p className="mt-8 text-center text-xs font-semibold text-muted">{L.auth.tagline}</p>
      </div>
      <div className="absolute end-4 top-4">
        <ThemeSwitch />
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
          {label}
        </label>
        {hint}
      </div>
      {children}
      {error && (
        <p className="text-xs text-danger-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormAlert({ tone = "danger", children }: { tone?: "danger" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium",
        tone === "danger" ? "border-nx-coral/30 bg-danger-soft text-danger-ink" : "border-nx-mint/30 bg-success-soft text-success-ink",
      )}
    >
      {tone === "danger" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  const L = useDsLabels();
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required aria-invalid={invalid} className="h-10 pe-10" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute end-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        aria-label={show ? L.auth.hidePassword : L.auth.showPassword}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: { error?: { message?: string; code?: string } } & Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: { code: "network" } } };
  }
}

type AuthText = ReturnType<typeof useDsLabels>["auth"];
/** Known error codes in the app's language; otherwise the server's message, else the fallback. */
const pick = (A: AuthText, r: { status: number; data: { error?: { message?: string; code?: string } } }, fallback: string) =>
  r.status === 0 ? A.noConnection : (A.errors[r.data.error?.code ?? ""] ?? r.data.error?.message ?? fallback);

const safeNext = (next: string | null | undefined, fallback: string) => (next && next.startsWith("/") && !next.startsWith("//") ? next : fallback);

export function LoginForm({ product, next, home = "/" }: { product: string; next?: string | null; home?: string }) {
  const L = useDsLabels();
  const A = L.auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "code">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/login", { email, password });
    if (r.ok && r.data.mfaRequired) {
      setBusy(false);
      setPassword("");
      setStep("code");
      return;
    }
    if (r.ok) {
      window.location.assign(safeNext(next, home));
      return;
    }
    setBusy(false);
    setError(pick(A, r, (r.status === 400 ? A.invalidLogin : A.signInFailed)));
  };
  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/mfa/verify", { code: code.replace(/\s/g, "") });
    if (r.ok) {
      window.location.assign(safeNext(next, home));
      return;
    }
    setBusy(false);
    setCode("");
    if (r.status === 401 || r.status === 429) {
      // The sign-in step is used up: start again with the password.
      setStep("password");
      setError(pick(A, r, A.signInAgain));
      return;
    }
    setError(pick(A, r, A.codeWrong));
  };
  if (step === "code") {
    return (
      <AuthLayout product={product} title={A.twoStepTitle} subtitle={A.twoStepSubtitle}>
        <form onSubmit={submitCode} className="flex flex-col gap-4" noValidate>
          {error && <FormAlert>{error}</FormAlert>}
          <Field label={A.authCode} htmlFor="otp">
            <OtpInput id="otp" value={code} onChange={setCode} />
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={busy || code.replace(/\s/g, "").length !== 6} className="mt-1 w-full">
            {busy && <Loader2 className="animate-spin" />}
            {busy ? A.checking : A.verify}
          </Button>
          <button type="button" onClick={() => (setStep("password"), setError(null), setCode(""))} className="text-[13px] font-medium text-nx-violet-text hover:underline">
            {A.differentAccount}
          </button>
        </form>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout product={product} title={A.signIn} subtitle={A.signInSubtitle}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <FormAlert>{error}</FormAlert>}
        <Field label={A.email} htmlFor="email">
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus className="h-10" />
        </Field>
        <Field
          label={A.password}
          htmlFor="password"
          hint={
            <a href="/forgot-password" className="text-xs font-medium text-nx-violet-text hover:underline">
              {A.forgotPassword}
            </a>
          }
        >
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        <Button type="submit" variant="primary" size="lg" disabled={busy || !email || !password} className="mt-1 w-full">
          {busy && <Loader2 className="animate-spin" />}
          {busy ? A.signingIn : A.signIn}
        </Button>
      </form>
    </AuthLayout>
  );
}

function OtpInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d\s]/g, "").slice(0, 7))}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      placeholder="123 456"
      required
      autoFocus
      className="h-11 text-center font-mono text-lg tracking-[0.3em]"
    />
  );
}

/** Groups a base32 key in blocks of four for manual entry. */
export const groupKey = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

/**
 * Two-step verification (TOTP) settings: shows the status, starts enrolment
 * (key + otpauth link – no QR library) and confirms it with a first code.
 */
export function MfaSetupForm({ product, next, home = "/", required }: { product: string; next?: string | null; home?: string; required?: boolean }) {
  const A = useDsLabels().auth;
  const [status, setStatus] = useState<{ enabled: boolean } | null>(null);
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/turvio/v1/auth/mfa", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent("/security")}`);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) setStatus({ enabled: !!data.enabled });
        else setError(A.errors[data.error?.code ?? ""] ?? data.error?.message ?? A.securityLoadFailed);
      })
      .catch(() => alive && setError(A.noConnection));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await postJson("/api/turvio/v1/auth/mfa/enroll", {});
    setBusy(false);
    if (r.ok) setEnrollment({ secret: String(r.data.secret), otpauthUrl: String(r.data.otpauthUrl) });
    else setError(pick(A, r, A.setupStartFailed));
  };
  const activate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/mfa/activate", { code: code.replace(/\s/g, "") });
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setStatus({ enabled: true });
      return;
    }
    setCode("");
    setError(pick(A, r, A.codeWrong));
  };
  const copy = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const target = safeNext(next, home);

  return (
    <AuthLayout
      product={product}
      title={A.twoStepTitle}
      subtitle={A.mfaSubtitle}
      footer={
        <a href={target} className="inline-flex items-center gap-1 font-medium text-nx-violet-text hover:underline">
          <ArrowLeft className="size-3.5 rtl:rotate-180" /> {A.back}
        </a>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        {required && !status?.enabled && (
          <FormAlert>{A.mfaRequired}</FormAlert>
        )}
        {status === null && !error && (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 className="size-4 animate-spin" /> {A.loading}
          </p>
        )}
        {status?.enabled && (
          <>
            <FormAlert tone="success">{done ? A.mfaNowOn : A.mfaIsOn}</FormAlert>
            <Button variant="primary" size="lg" className="w-full" onClick={() => window.location.assign(target)}>
              {A.continue}
            </Button>
          </>
        )}
        {status && !status.enabled && !enrollment && (
          <>
            <p className="text-[13px] text-ink-2">
              {A.needApp}
            </p>
            <Button variant="primary" size="lg" className="w-full" onClick={start} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {A.setUpMfa}
            </Button>
          </>
        )}
        {status && !status.enabled && enrollment && (
          <form onSubmit={activate} className="flex flex-col gap-4" noValidate>
            <ol className="flex list-decimal flex-col gap-3 ps-5 text-[13px] text-ink-2">
              <li>
                {A.onYourPhone}{" "}
                <a href={enrollment.otpauthUrl} className="font-medium text-nx-violet-text hover:underline">
                  {A.addToApp}
                </a>
                {A.orEnterKey}
                <div className="mt-2 flex items-center gap-2">
                  <code data-testid="mfa-secret" className="flex-1 select-all rounded-md border border-line bg-surface-2 px-2.5 py-2 font-mono text-[13px] tracking-wider text-ink">
                    {groupKey(enrollment.secret)}
                  </code>
                  <Button type="button" variant="secondary" size="sm" onClick={copy}>
                    {copied ? A.copied : A.copy}
                  </Button>
                </div>
              </li>
              <li>{A.enterCode}</li>
            </ol>
            <Field label={A.authCode} htmlFor="otp">
              <OtpInput id="otp" value={code} onChange={setCode} />
            </Field>
            <Button type="submit" variant="primary" size="lg" disabled={busy || code.replace(/\s/g, "").length !== 6} className="w-full">
              {busy && <Loader2 className="animate-spin" />}
              {A.turnOn}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

export function ForgotPasswordForm({ product }: { product: string }) {
  const A = useDsLabels().auth;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/forgot", { email });
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(pick(A, r, A.emailSendFailed));
  };
  return (
    <AuthLayout
      product={product}
      title={A.resetTitle}
      subtitle={A.resetSubtitle}
      footer={
        <a href="/login" className="inline-flex items-center gap-1 font-medium text-nx-violet-text hover:underline">
          <ArrowLeft className="size-3.5 rtl:rotate-180" /> {A.backToSignIn}
        </a>
      }
    >
      {sent ? (
        <FormAlert tone="success">{A.resetSent(email)}</FormAlert>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label={A.email} htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus className="h-10" />
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={busy || !email} className="w-full">
            {busy && <Loader2 className="animate-spin" />}
            {A.sendResetLink}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

function passwordHint(pw: string, A: { pwTooShort: string; pwNeedsNumber: string }): string | null {
  if (!pw) return null;
  if (pw.length < 12) return A.pwTooShort;
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return A.pwNeedsNumber;
  return null;
}

export function ResetPasswordForm({ product, token }: { product: string; token: string | null }) {
  const A = useDsLabels().auth;
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weak = passwordHint(pw, A);
  const mismatch = pw2 && pw !== pw2 ? A.pwMismatch : null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (weak || mismatch) return;
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/reset", { token, password: pw });
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(pick(A, r, A.pwChangeFailed));
  };
  return (
    <AuthLayout product={product} title={A.newPasswordTitle} footer={<a href="/login" className="font-medium text-nx-violet-text hover:underline">{A.backToSignIn}</a>}>
      {!token ? (
        <FormAlert>{A.resetIncomplete}</FormAlert>
      ) : done ? (
        <div className="flex flex-col gap-4">
          <FormAlert tone="success">{A.pwChanged}</FormAlert>
          <Button variant="primary" size="lg" className="w-full" onClick={() => window.location.assign("/login")}>
            {A.signIn}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label={A.newPassword} htmlFor="pw" error={weak}>
            <PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="new-password" invalid={!!weak} />
          </Field>
          <Field label={A.repeatPassword} htmlFor="pw2" error={mismatch}>
            <PasswordInput id="pw2" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={!!mismatch} />
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={busy || !pw || !!weak || pw !== pw2} className="w-full">
            {busy && <Loader2 className="animate-spin" />}
            {A.setNewPassword}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

interface InviteInfo {
  organizationName: string;
  email: string;
  role: string;
  state: "open" | "accepted" | "expired" | "revoked";
}

export function AcceptInviteForm({ product, token, home = "/" }: { product: string; token: string | null; home?: string }) {
  const A = useDsLabels().auth;
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverDone, setDriverDone] = useState(false);
  useEffect(() => {
    if (!token) return;
    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? setInfo(await r.json()) : setLoadError(A.inviteMissing)))
      .catch(() => setLoadError(A.noConnectionShort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  const weak = passwordHint(pw, A);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/accept", { token, password: pw, displayName: name || undefined });
    setBusy(false);
    if (!r.ok) return setError(pick(A, r, A.inviteFailed));
    if (info?.role === "driver") setDriverDone(true);
    else window.location.assign(home);
  };
  return (
    <AuthLayout product={product} title={A.joinTitle} subtitle={info ? A.invitedTo(<strong className="font-semibold text-ink">{info.organizationName}</strong>, A.role(info.role)) : undefined}>
      {!token || loadError ? (
        <FormAlert>{loadError ?? A.inviteIncomplete}</FormAlert>
      ) : !info ? (
        <div className="flex justify-center py-6 text-muted">
          <Loader2 className="size-5 animate-spin" aria-label={A.loadingInvite} />
        </div>
      ) : info.state !== "open" ? (
        <FormAlert>{A.inviteState(info.state)}</FormAlert>
      ) : driverDone ? (
        <FormAlert tone="success">{A.driverDone(info.email)}</FormAlert>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label={A.email} htmlFor="email">
            <Input id="email" value={info.email} readOnly className="h-10 bg-surface-2 text-muted" />
          </Field>
          <Field label={A.yourName} htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-10" />
          </Field>
          <Field label={A.password} htmlFor="pw" error={weak} hint={<span className="text-2xs text-subtle">{A.existingAccount}</span>}>
            <PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="new-password" invalid={!!weak} />
          </Field>
          <Button type="submit" variant="primary" size="lg" disabled={busy || !pw || !!weak} className="w-full">
            {busy && <Loader2 className="animate-spin" />}
            {A.acceptInvite}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
