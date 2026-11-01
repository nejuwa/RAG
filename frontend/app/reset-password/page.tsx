"use client";

import Link from "next/link";
import { AppearanceControls, useLanguage } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-surface p-6 mobile:p-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold tracking-wide text-accent">{t("መረጃAI")}</Link>
          <AppearanceControls />
        </div>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{t("Password recovery unavailable")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {t("Email-based password recovery is not configured in this MVP. Contact the workspace operator for account help.")}
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-accent underline">
          {t("Return to sign in")}
        </Link>
      </section>
    </main>
  );
}
