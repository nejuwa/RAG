"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChatSession, User } from "@/types/api";
import { Button } from "@/components/ui/button";

export function ChatSidebar({
  sessions,
  activeSessionId,
  user,
  loading,
  onNewChat,
  onSelect,
  onLogout,
}: {
  sessions: ChatSession[];
  activeSessionId: string | null;
  user: User;
  loading: boolean;
  onNewChat: () => Promise<void>;
  onSelect: (id: string) => void;
  onLogout: () => Promise<void>;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function createChat() {
    setBusy(true);
    try {
      await onNewChat();
      setDrawerOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const sidebar = (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-line bg-[#f2f3ef]">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.12em] text-accent">CHATBOT</Link>
        <Button type="button" variant="quiet" className="min-h-9 px-2 desktop:hidden" aria-label="Close conversation menu" onClick={() => setDrawerOpen(false)}>
          Close
        </Button>
      </div>
      <div className="p-3">
        <Button type="button" fullWidth variant="secondary" onClick={() => void createChat()} disabled={busy}>
          <span aria-hidden="true">＋</span>
          {busy ? "Creating…" : "New chat"}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
        <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Your conversations</h2>
        {loading ? (
          <div className="grid gap-2 p-2" aria-label="Loading conversations">
            <div className="h-11 rounded-md bg-line/70" />
            <div className="h-11 rounded-md bg-line/70" />
            <div className="h-11 rounded-md bg-line/70" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-3 py-3 text-sm leading-6 text-muted">Your conversations will appear here.</p>
        ) : (
          <ul className="grid gap-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(session.id);
                    setDrawerOpen(false);
                  }}
                  aria-current={activeSessionId === session.id ? "page" : undefined}
                  className={`min-h-11 w-full rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${activeSessionId === session.id ? "bg-accent-soft font-medium text-ink" : "text-muted hover:bg-white hover:text-ink"}`}
                >
                  <span className="block truncate">{session.title || "New chat"}</span>
                  <span className="mt-1 block truncate text-xs font-normal text-muted">
                    {session.messages?.[0]?.content ?? "No messages yet"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-accent" aria-hidden="true">
            {(user.displayName?.[0] ?? user.email[0] ?? "U").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{user.displayName || user.email}</span>
            <span className="block truncate text-xs text-muted">{user.email}</span>
          </span>
        </div>
        <Button type="button" variant="quiet" fullWidth className="justify-start" onClick={() => void onLogout()}>
          Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full w-72 shrink-0 desktop:block">{sidebar}</div>
      <div className="flex h-14 shrink-0 items-center border-b border-line bg-surface px-4 desktop:hidden">
        <Button type="button" variant="quiet" className="min-h-10 px-2" aria-label="Open conversation menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
          <span aria-hidden="true" className="text-xl">☰</span>
          <span className="sr-only">Open conversations</span>
        </Button>
        <span className="ml-3 truncate text-sm font-semibold text-ink">
          {sessions.find((session) => session.id === activeSessionId)?.title ?? "Chatbot"}
        </span>
        <Button type="button" variant="quiet" className="ml-auto min-h-10 px-2" onClick={() => void createChat()} disabled={busy}>
          <span aria-hidden="true" className="text-xl">＋</span>
          <span className="sr-only">New chat</span>
        </Button>
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 desktop:hidden">
          <button type="button" className="absolute inset-0 cursor-default bg-black/25" aria-label="Close conversation menu" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 h-full w-[min(20rem,86vw)] border-r border-line bg-surface">
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}
