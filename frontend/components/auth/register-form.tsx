"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AppearanceControls, useLanguage } from "@/lib/i18n";

export function RegisterForm() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(t("Passwords do not match."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({ displayName, email, password });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t("Could not create your account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-line bg-surface p-6 mobile:p-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold tracking-wide text-accent">መረጃAI</Link>
        <AppearanceControls />
      </div>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{t("Create your account")}</h1>
      {error && <div className="mt-6"><ErrorBanner message={error} /></div>}
      <form className="mt-7 grid gap-5" onSubmit={submit}>
        <Input label={t("Display name")} name="displayName" autoComplete="name" required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={busy} />
        <Input label={t("Email")} name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
        <Input label={t("Password")} name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} hint={t("Use at least 8 characters.")} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        <Input
          label={t("Confirm password")}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={busy}
          error={confirmPassword && password !== confirmPassword ? t("Passwords do not match.") : undefined}
        />
        <Button type="submit" fullWidth disabled={busy}>{busy ? <Spinner label={t("Creating account…")} /> : t("Create account")}</Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">
        {t("Already registered?")} <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">{t("Sign in")}</Link>
      </p>
    </section>
  );
}
