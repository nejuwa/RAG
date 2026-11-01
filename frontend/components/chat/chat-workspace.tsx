"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { MessageInput } from "@/components/chat/message-input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, api } from "@/lib/api";
import type { ChatSession, Message } from "@/types/api";

const LAST_SESSION_KEY = "chatbot.lastSessionId";

export function ChatWorkspace() {
  const router = useRouter();
  const { user, loading: authLoading, error: connectionError, logout } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const loadSessions = useCallback(async (preferredId?: string | null) => {
    const page = await api.sessions.list({ limit: 50 });
    setSessions(page.items);
    const storedId = typeof window === "undefined" ? null : window.localStorage.getItem(LAST_SESSION_KEY);
    const desiredId = preferredId ?? storedId;
    const chosen = page.items.find((session) => session.id === desiredId) ?? page.items[0] ?? null;
    setActiveSessionId(chosen?.id ?? null);
    return chosen?.id ?? null;
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    try {
      const page = await api.messages.list(sessionId, { limit: 50 });
      setMessages(page.items);
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace("/login");
      }
      setError(cause instanceof Error ? cause.message : "Could not load conversation.");
    } finally {
      setLoadingMessages(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    setLoadingSessions(true);
    void api.sessions.list({ limit: 50 })
      .then((page) => {
        if (cancelled) return;
        setSessions(page.items);
        const storedId = window.localStorage.getItem(LAST_SESSION_KEY);
        const chosen = page.items.find((session) => session.id === storedId) ?? page.items[0] ?? null;
        setActiveSessionId(chosen?.id ?? null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) router.replace("/login");
        setError(cause instanceof Error ? cause.message : "Could not load conversations.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    window.localStorage.setItem(LAST_SESSION_KEY, activeSessionId);
    void loadMessages(activeSessionId);
  }, [activeSessionId, loadMessages]);

  const createChat = useCallback(async () => {
    setError(null);
    try {
      const created = await api.sessions.create({ type: "AI", title: "New chat" });
      setSessions((current) => [created, ...current.filter((session) => session.id !== created.id)]);
      setActiveSessionId(created.id);
      setMessages([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a conversation.");
    }
  }, []);

  async function sendMessage(content: string) {
    setSending(true);
    setStreamingText("");
    setError(null);
    let sessionId = activeSessionId;
    try {
      if (!sessionId) {
        const created = await api.sessions.create({ type: "AI", title: "New chat" });
        sessionId = created.id;
        setSessions((current) => [created, ...current]);
        setActiveSessionId(created.id);
      }

      const selected = sessions.find((session) => session.id === sessionId);
      if (!selected || selected.type === "AI") {
        await api.ai.chat(sessionId, content, {
          onToken: (delta) => setStreamingText((current) => current + delta),
        });
      } else {
        const aiParticipant = selected.users.find(
          (participant) => participant.user.email === "ai-assistant@system.invalid",
        );
        const createdMessage = await api.messages.send(sessionId, {
          content,
          ...(aiParticipant ? { receiverId: aiParticipant.user.id } : {}),
        });
        setMessages((current) => [...current, createdMessage]);
      }

      const [history, refreshedSessions] = await Promise.all([
        api.messages.list(sessionId, { limit: 50 }),
        api.sessions.list({ limit: 50 }),
      ]);
      setMessages(history.items);
      setSessions(refreshedSessions.items);
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace("/login");
      }
      setError(cause instanceof Error ? cause.message : "The AI could not complete this response.");
      if (sessionId) {
        try {
          const history = await api.messages.list(sessionId, { limit: 50 });
          setMessages(history.items);
        } catch {
          // Keep the original request failure visible; history can be refreshed from the banner.
        }
      }
      throw cause;
    } finally {
      setSending(false);
      setStreamingText("");
    }
  }

  async function signOut() {
    setError(null);
    try {
      await logout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    }
  }

  if (authLoading || (!user && !connectionError)) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <Spinner label="Loading your workspace…" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg content-center gap-4 px-4">
        <ErrorBanner message={connectionError ?? "Sign in to open your conversations."} />
        <Button onClick={() => router.push("/login")}>Go to sign in</Button>
      </main>
    );
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-canvas desktop:flex-row">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        user={user}
        loading={loadingSessions}
        onNewChat={createChat}
        onSelect={setActiveSessionId}
        onLogout={signOut}
      />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="hidden h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-6 desktop:flex">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-ink">{activeSession?.title ?? "Your workspace"}</h1>
            {activeSession && (
              <p className="mt-1 text-xs text-muted">
                {activeSession.type === "AI" ? "AI conversation" : `${activeSession.users.length} participants`}
              </p>
            )}
          </div>
          <span className="text-xs text-muted">Private workspace</span>
        </header>
        {error && (
          <div className="px-4 pt-4 tablet:px-8">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={() => {
                if (activeSessionId) void loadMessages(activeSessionId);
                else void loadSessions();
              }}
            />
          </div>
        )}
        <ChatWindow
          messages={messages}
          streamingText={streamingText}
          loading={loadingMessages}
          sending={sending}
          conversationTitle={activeSession?.title}
        />
        <div className="shrink-0 border-t border-line bg-canvas px-3 py-3 mobile:px-5 mobile:py-4 tablet:px-8">
          <MessageInput sending={sending} onSend={sendMessage} />
        </div>
      </section>
    </main>
  );
}
