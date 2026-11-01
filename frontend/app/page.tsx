"use client";

import Link from "next/link";
import { AppearanceControls, useLanguage } from "@/lib/i18n";
import { StarfieldBackground } from "@/components/home/starfield-background";

function BrandMark() {
  return (
    <div className="relative flex h-44 w-44 items-center justify-center mobile:h-56 mobile:w-56">
      <div className="absolute inset-0 rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute inset-3 rounded-full border border-accent/15" />
      <div className="absolute inset-0 animate-[spin_24s_linear_infinite] rounded-full border border-transparent border-t-accent/80 motion-reduce:animate-none" />
      <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.4rem] border border-white/70 bg-gradient-to-br from-[#78a984] via-accent to-[#304f3b] text-white shadow-[0_0_70px_rgba(73,107,86,0.28)] mobile:h-40 mobile:w-40 mobile:rounded-[2.8rem]">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-20 w-20 mobile:h-24 mobile:w-24">
          <path d="M12 2.5 14.8 9.2 21.5 12l-6.7 2.8L12 21.5l-2.8-6.7L2.5 12l6.7-2.8L12 2.5Z" fill="currentColor" />
          <circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" opacity=".72" />
        </svg>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-surface text-ink transition-colors">
      <StarfieldBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[1500px] justify-end px-5 pt-5 mobile:px-8 mobile:pt-8">
        <AppearanceControls />
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center desktop:flex-row desktop:gap-20 desktop:px-16 desktop:py-16 desktop:text-left">
        <div className="shrink-0">
          <BrandMark />
        </div>
        <div className="max-w-4xl">
          <h1 className="font-serif text-6xl font-semibold tracking-tight text-accent [filter:drop-shadow(0_0_24px_rgba(73,107,86,0.22))] mobile:text-7xl desktop:text-8xl wide:text-9xl">መረጃAI</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted mobile:text-xl mobile:leading-9 wide:text-2xl wide:leading-10">
            {t("Bring your sources together, ask better questions, and explore answers grounded in your research.")}
          </p>
          <div className="mt-9 flex flex-col gap-4 mobile:flex-row desktop:mt-11">
            <Link
              href="/ask"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#5e896a] to-accent px-8 py-4 text-base font-semibold text-white shadow-[0_12px_40px_rgba(73,107,86,0.22)] transition hover:-translate-y-0.5 hover:from-[#6d9b78] hover:to-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mobile:min-w-48 mobile:text-lg"
            >
              {t("Ask")}
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-14 items-center justify-center rounded-xl border border-line bg-surface/80 px-8 py-4 text-base font-semibold text-ink transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mobile:min-w-48 mobile:text-lg"
            >
              {t("Create account")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 h-8" />
    </main>
  );
}
