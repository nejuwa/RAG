"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { AppearanceControls, useLanguage } from "@/lib/i18n";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const { reloadUser } = useAuth();
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void reloadUser()
      .then(() => router.replace("/workspace"))
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : t("Google sign-in could not be completed."));
      });
    return () => {
      active = false;
    };
  }, [reloadUser, router, t]);

  return (
    <main className="relative mx-auto grid min-h-dvh max-w-lg content-center gap-5 px-4">
      <div className="absolute right-4 top-4">
        <AppearanceControls />
      </div>
      {error ? (
        <>
          <ErrorBanner message={error} />
          <a className="text-sm font-medium text-accent underline underline-offset-4" href="/login">
            {t("Return to sign in")}
          </a>
        </>
      ) : (
        <Spinner label={t("Finishing Google sign-in…")} />
      )}
    </main>
  );
}
