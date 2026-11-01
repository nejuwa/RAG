"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ApiError, api } from "@/lib/api";
import { AppearanceControls, useLanguage } from "@/lib/i18n";

interface GuestExchange {
  id: number;
  question: string;
  answer: string;
}

export default function GuestAskPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [exchanges, setExchanges] = useState<GuestExchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges, busy]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = query.trim();
    if (question.length < 3 || busy) return;

    setBusy(true);
    setError(null);
    setQuery("");
    try {
      const result = await api.guest.ask(question);
      nextId.current += 1;
      setExchanges((current) => [
        ...current,
        { id: nextId.current, question, answer: result.answer },
      ]);
    } catch (cause) {
      setQuery(question);
      setError(
        cause instanceof ApiError
          ? cause.message
          : t("Could not get an answer. Check that the backend is running and try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface/95 px-4 shadow-sm backdrop-blur mobile:px-6">
        <Link
          href="/"
          aria-label={t("መረጃAI home")}
          className="font-serif text-xl font-bold tracking-tight text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          መረጃAI
        </Link>
        <AppearanceControls />
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] flex-1 gap-4 p-3 tablet:p-5 lg:min-h-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-sm lg:min-h-0">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-white shadow-md shadow-accent/20">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path d="M12 3.5 14.15 9.85 20.5 12l-6.35 2.15L12 20.5l-2.15-6.35L3.5 12l6.35-2.15L12 3.5Z" fill="currentColor" />
                <circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" opacity=".72" />
              </svg>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("Sign in")}
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("Create account")}
            </Link>
          </div>
        </aside>

        <section className="flex min-h-[72dvh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm lg:h-[calc(100dvh-6.5rem)]">
          <div className="flex h-14 shrink-0 items-center border-b border-line px-4 mobile:px-6">
            <div>
              <h2 className="font-semibold">{t("New guest chat")}</h2>
            </div>
          </div>

          {error && (
            <div className="px-4 pt-4 mobile:px-6" role="alert">
              <ErrorBanner message={error} />
            </div>
          )}

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 mobile:px-6" aria-live="polite">
            {exchanges.length === 0 && !busy && (
              <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-dashed border-line p-6 text-center">
                <h3 className="font-semibold">{t("What would you like to know?")}</h3>
              </div>
            )}
            {exchanges.map((exchange) => (
              <div key={exchange.id} className="space-y-4">
                <article className="ml-auto max-w-3xl rounded-2xl rounded-br-sm bg-accent-soft px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{exchange.question}</p>
                </article>
                <article className="max-w-3xl rounded-2xl rounded-bl-sm border border-line bg-canvas px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-accent">መረጃAI</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-ink">{exchange.answer}</p>
                </article>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-3 text-sm text-muted" role="status">
                <span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" />
                {t("Thinking")}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="shrink-0 border-t border-line p-4 mobile:p-5" onSubmit={(event) => void submit(event)}>
            <label htmlFor="guest-question" className="sr-only">{t("Your question")}</label>
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
              <textarea
                id="guest-question"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={2000}
                minLength={3}
                required
                placeholder={t("Ask a question…")}
                className="max-h-40 min-h-10 flex-1 resize-y border-0 bg-transparent px-3 py-2 text-sm leading-6 outline-none focus:ring-0"
              />
              <button
                type="submit"
                disabled={busy || query.trim().length < 3}
                aria-label={busy ? t("Thinking") : t("Ask")}
                title={busy ? t("Thinking") : t("Ask")}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
