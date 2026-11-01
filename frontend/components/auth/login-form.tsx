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

export function LoginForm() {
  const { t } = useLanguage();
  const { login, loading: authLoading, error: connectionError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : t("Could not sign in. Check that the backend is running."),
      );
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
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{t("Welcome back")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{t("Sign in to continue your research.")}</p>
      {(error || connectionError) && (
        <div className="mt-6">
          <ErrorBanner message={error ?? connectionError ?? ""} />
        </div>
      )}
      <form className="mt-7 grid gap-5" onSubmit={submit}>
        <Input
          label={t("Email")}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={authLoading || busy}
        />
        <Input
          label={t("Password")}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={authLoading || busy}
        />
        <Button type="submit" fullWidth disabled={authLoading || busy}>
          {busy ? <Spinner label={t("Signing in…")} /> : t("Sign in")}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">
        {t("New here?")}{" "}
        <Link href="/register" className="font-medium text-accent underline-offset-4 hover:underline">
          {t("Create an account")}
        </Link>
      </p>
    </section>
  );
}
