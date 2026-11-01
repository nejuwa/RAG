"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, api } from "@/lib/api";
import { AppearanceControls, useLanguage } from "@/lib/i18n";
import type {
  ResearchCitation,
  ResearchCollection,
  ResearchConversation,
  ResearchMessage,
  ResearchSource,
} from "@/types/research";

const ACTIVE_CONVERSATION_KEY = "ria.activeConversationId";
const SELECTED_COLLECTION_KEY = "ria.selectedCollectionId";
const COLLECTION_SCOPE_KEY = "ria.collectionScopeIds";
const INGESTING_STATUSES = new Set(["queued", "processing"]);

type WorkspaceView = "collections" | "chat";

export function ResearchWorkspace({ view = "collections" }: { view?: WorkspaceView }) {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { t } = useLanguage();
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [scopeCollectionIds, setScopeCollectionIds] = useState<string[]>([]);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [conversations, setConversations] = useState<ResearchConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [query, setQuery] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [urls, setUrls] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sourceAction, setSourceAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const queryInput = useRef<HTMLTextAreaElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );
  const hasPendingIngestion = sources.some((source) => INGESTING_STATUSES.has(source.status));

  const loadConversation = useCallback(async (id: string) => {
    const conversation = await api.researchConversations.get(id);
    setActiveConversationId(id);
    setMessages(conversation.messages);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        let nextCollections = await api.researchCollections.list();
        if (nextCollections.length === 0) {
          const created = await api.researchCollections.create(t("My research"));
          nextCollections = [created];
        }
        if (cancelled) return;
        setCollections(nextCollections);
        const preferredCollectionId = window.localStorage.getItem(SELECTED_COLLECTION_KEY);
        const selectedCollectionId = nextCollections.some((item) => item.id === preferredCollectionId)
          ? preferredCollectionId
          : nextCollections[0]?.id ?? null;
        setSelectedCollectionId(selectedCollectionId);

        const allCollectionIds = nextCollections.map((item) => item.id);
        let savedScopeIds: string[] = [];
        let hasSavedScope = false;
        try {
          const parsed: unknown = JSON.parse(
            window.localStorage.getItem(COLLECTION_SCOPE_KEY) ?? "[]",
          );
          if (Array.isArray(parsed)) {
            savedScopeIds = parsed.filter(
              (id): id is string => typeof id === "string" && allCollectionIds.includes(id),
            );
            hasSavedScope = parsed.length === 0 || savedScopeIds.length > 0;
          }
        } catch {
          savedScopeIds = [];
        }
        setScopeCollectionIds(hasSavedScope ? savedScopeIds : allCollectionIds);

        if (view === "chat") {
          let nextConversations = await api.researchConversations.list();
          if (nextConversations.length === 0) {
            const created = await api.researchConversations.create();
            nextConversations = [created];
          }
          if (cancelled) return;
          setConversations(nextConversations);
          const preferredConversationId = window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
          const selectedConversation =
            nextConversations.find((item) => item.id === preferredConversationId) ?? nextConversations[0];
          if (selectedConversation) {
            const detail = await api.researchConversations.get(selectedConversation.id);
            if (!cancelled) {
              setActiveConversationId(selectedConversation.id);
              setMessages(detail.messages);
            }
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : t("Could not load the research workspace."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router, view, t]);

  useEffect(() => {
    if (loading) return;
    if (selectedCollectionId) {
      window.localStorage.setItem(SELECTED_COLLECTION_KEY, selectedCollectionId);
    }
    window.localStorage.setItem(COLLECTION_SCOPE_KEY, JSON.stringify(scopeCollectionIds));
  }, [loading, selectedCollectionId, scopeCollectionIds]);

  const refreshSources = useCallback(async () => {
    if (!selectedCollectionId) {
      setSources([]);
      return;
    }
    const nextSources = await api.researchSources.list(selectedCollectionId);
    setSources(nextSources);
  }, [selectedCollectionId]);

  useEffect(() => {
    if (!user || !selectedCollectionId) return;
    let cancelled = false;
    void refreshSources().catch((cause: unknown) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : t("Could not load sources."));
      }
    });
    const interval = hasPendingIngestion
      ? window.setInterval(() => {
          void refreshSources().catch((cause: unknown) => {
            if (!cancelled) {
              setError(cause instanceof Error ? cause.message : t("Could not refresh source status."));
            }
          });
        }, 3000)
      : undefined;
    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [user, selectedCollectionId, refreshSources, hasPendingIngestion, t]);

  async function addCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = collectionName.trim();
    if (!name) return;
    setError(null);
    try {
      const created = await api.researchCollections.create(name);
      setCollections((current) => [created, ...current]);
      setSelectedCollectionId(created.id);
      setScopeCollectionIds((current) => [...current, created.id]);
      setCollectionName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not create the collection."));
    }
  }

  async function renameCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameId || !renameValue.trim()) return;
    setError(null);
    try {
      const updated = await api.researchCollections.rename(renameId, renameValue.trim());
      setCollections((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setRenameId(null);
      setRenameValue("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not rename the collection."));
    }
  }

  async function deleteCollection(collection: ResearchCollection) {
    if (!window.confirm(t('Delete "{name}" and all of its sources?', { name: collection.name }))) return;
    setError(null);
    try {
      await api.researchCollections.delete(collection.id);
      const remaining = collections.filter((item) => item.id !== collection.id);
      setCollections(remaining);
      setScopeCollectionIds((current) => current.filter((id) => id !== collection.id));
      if (selectedCollectionId === collection.id) setSelectedCollectionId(remaining[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not delete the collection."));
    }
  }

  async function uploadSelectedFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCollectionId || !file) return;
    setSourceAction(true);
    setError(null);
    try {
      await api.researchSources.upload(selectedCollectionId, file);
      setCollections((current) =>
        current.map((item) =>
          item.id === selectedCollectionId ? { ...item, source_count: item.source_count + 1 } : item,
        ),
      );
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      router.push("/workspace/chat");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not upload this file."));
    } finally {
      setSourceAction(false);
    }
  }

  async function addUrls(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCollectionId) return;
    const values = urls.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
    if (values.length === 0) return;
    setSourceAction(true);
    setError(null);
    try {
      await api.researchSources.addUrls(selectedCollectionId, values);
      setCollections((current) =>
        current.map((item) =>
          item.id === selectedCollectionId
            ? { ...item, source_count: item.source_count + values.length }
            : item,
        ),
      );
      setUrls("");
      router.push("/workspace/chat");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not add these URLs."));
    } finally {
      setSourceAction(false);
    }
  }

  async function retrySource(source: ResearchSource) {
    setError(null);
    try {
      await api.researchSources.retry(source.id);
      await refreshSources();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not retry ingestion."));
    }
  }

  async function deleteSource(source: ResearchSource) {
    if (!window.confirm(t('Remove "{name}" from this collection?', { name: source.title }))) return;
    setError(null);
    try {
      await api.researchSources.delete(source.id);
      await refreshSources();
      setCollections((current) =>
        current.map((item) =>
          item.id === source.collection_id
            ? { ...item, source_count: Math.max(0, item.source_count - 1) }
            : item,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not remove this source."));
    }
  }

  async function createConversation() {
    setError(null);
    try {
      const created = await api.researchConversations.create();
      setConversations((current) => [created, ...current]);
      setActiveConversationId(created.id);
      setMessages([]);
      window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not start a new conversation."));
    }
  }

  async function deleteConversation(conversation: ResearchConversation) {
    if (conversations.length < 2) return;
    if (!window.confirm(t('Delete "{name}"?', { name: conversation.title }))) return;
    setError(null);
    try {
      await api.researchConversations.delete(conversation.id);
      const remaining = conversations.filter((item) => item.id !== conversation.id);
      setConversations(remaining);
      if (renameConversationId === conversation.id) setRenameConversationId(null);
      if (conversation.id === activeConversationId && remaining[0]) {
        await loadConversation(remaining[0].id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not delete the conversation."));
    }
  }

  async function renameCurrentConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameConversationId || !conversationTitle.trim()) return;
    setError(null);
    try {
      const updated = await api.researchConversations.rename(
        renameConversationId,
        conversationTitle.trim(),
      );
      setConversations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setRenameConversationId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not rename this conversation."));
    }
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = query.trim();
    if (!question || sending) return;
    if (scopeCollectionIds.length === 0) {
      setError(t("Select at least one collection to search."));
      return;
    }
    setSending(true);
    setError(null);
    let attemptedConversationId = activeConversationId;
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await api.researchConversations.create();
        conversationId = created.id;
        attemptedConversationId = conversationId;
        setActiveConversationId(conversationId);
        setConversations((current) => [created, ...current]);
      }
      attemptedConversationId = conversationId;
      const result = await api.research.ask({
        query: question,
        collection_ids: scopeCollectionIds,
        conversation_id: conversationId,
        ...(editingMessageId ? { edit_message_id: editingMessageId } : {}),
      });
      setQuery("");
      setEditingMessageId(null);
      await loadConversation(result.conversation_id);
      const nextConversations = await api.researchConversations.list();
      setConversations(nextConversations);
    } catch (cause) {
      setError(
        formatResearchError(cause, t("Could not complete the research request.")),
      );
      if (attemptedConversationId) {
        try {
          const detail = await api.researchConversations.get(attemptedConversationId);
          setMessages(detail.messages);
        } catch {
          // Keep the original request error visible.
        }
      }
    } finally {
      setSending(false);
    }
  }

  async function copyMessage(message: ResearchMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1600);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? t("Could not copy this message: {error}", { error: cause.message })
          : t("Could not copy this message."),
      );
    }
  }

  function editMessage(message: ResearchMessage) {
    setEditingMessageId(message.id);
    setQuery(message.content);
    window.requestAnimationFrame(() => queryInput.current?.focus());
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner label={t("Loading your research workspace…")} />
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-line bg-surface/95 px-4 py-3 shadow-sm backdrop-blur mobile:px-6">
        <Link href="/" aria-label={t("መረጃAI home")} className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-white shadow-md shadow-accent/20">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path d="M12 3.5 14.15 9.85 20.5 12l-6.35 2.15L12 20.5l-2.15-6.35L3.5 12l6.35-2.15L12 3.5Z" fill="currentColor" />
              <circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" opacity=".72" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold tracking-tight text-accent">መረጃAI</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <AppearanceControls />
          <details className="group relative">
            <summary
              aria-label={t("Open profile menu")}
              title={t("Open profile menu")}
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent ring-1 ring-line transition hover:ring-accent focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"
            >
              {(user.displayName?.trim().charAt(0) || user.email.charAt(0) || "U").toUpperCase()}
            </summary>
            <div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-line bg-surface p-3 shadow-xl">
              <p className="truncate text-sm font-semibold text-ink">{user.displayName || t("Your account")}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
              <div className="my-3 border-t border-line" />
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink transition hover:bg-canvas focus-visible:outline-2 focus-visible:outline-accent"
                onClick={() => void logout()}
              >
                {t("Sign out")}
              </button>
            </div>
          </details>
        </div>
      </header>

      {view === "collections" ? (
      <div className="mx-auto max-w-4xl p-4 tablet:p-6">
        <aside className="flex max-h-[calc(100dvh-7rem)] flex-col gap-5 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-sm mobile:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{t("Your library")}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink mobile:text-3xl">{t("Prepare your sources")}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                {t("Add documents or public webpages, then continue to a chat grounded in your sources.")}
              </p>
            </div>
            {selectedCollection && selectedCollection.source_count > 0 && (
              <Link
                href="/workspace/chat"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
              >
                {t("Open chat")}
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </Link>
            )}
          </div>
          <section aria-labelledby="collections-heading">
            <h2 id="collections-heading" className="text-sm font-semibold">{t("Collections")}</h2>
            <div className="mt-3 space-y-2">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className={`rounded-md border p-2 ${
                    selectedCollectionId === collection.id ? "border-accent bg-accent-soft" : "border-line"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      aria-label={t("Include {name} in research", { name: collection.name })}
                      type="checkbox"
                      checked={scopeCollectionIds.includes(collection.id)}
                      onChange={(event) =>
                        setScopeCollectionIds((current) =>
                          event.target.checked
                            ? [...current, collection.id]
                            : current.filter((id) => id !== collection.id),
                        )
                      }
                      className="mt-1 accent-accent"
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedCollectionId(collection.id)}
                    >
                      <span className="block truncate text-sm font-medium">{collection.name}</span>
                      <span className="text-xs text-muted">{collection.source_count} {t("sources")}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={t("Rename {name}", { name: collection.name })}
                      className="px-1 text-xs text-muted hover:text-ink"
                      onClick={() => {
                        setRenameId(collection.id);
                        setRenameValue(collection.name);
                      }}
                    >
                      {t("Rename")}
                    </button>
                    <button
                      type="button"
                      aria-label={t("Delete {name}", { name: collection.name })}
                      className="px-1 text-xs text-danger hover:underline"
                      onClick={() => void deleteCollection(collection)}
                    >
                      {t("Delete")}
                    </button>
                  </div>
                  {renameId === collection.id && (
                    <form className="mt-2 flex gap-2" onSubmit={(event) => void renameCollection(event)}>
                      <input
                        aria-label={t("New collection name")}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        maxLength={120}
                        required
                        className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-sm"
                      />
                      <button type="submit" className="text-xs font-medium text-accent">{t("Save")}</button>
                      <button type="button" className="text-xs text-muted" onClick={() => setRenameId(null)}>{t("Cancel")}</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(event) => void addCollection(event)}>
              <input
                aria-label={t("New collection name")}
                placeholder={t("New collection")}
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                maxLength={120}
                required
                className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover">
                {t("Add")}
              </button>
            </form>
          </section>

          <section aria-labelledby="sources-heading" className="border-t border-line pt-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="sources-heading" className="text-sm font-semibold">{t("Sources")}</h2>
              {selectedCollection && <span className="truncate text-xs text-muted">{selectedCollection.name}</span>}
            </div>
            {!selectedCollection ? (
              <p className="mt-3 text-sm text-muted">{t("Create a collection to add sources.")}</p>
            ) : (
              <>
                <form className="mt-3 space-y-2" onSubmit={(event) => void uploadSelectedFile(event)}>
                  <label htmlFor="source-file" className="block text-xs font-medium text-muted">
                    {t("Upload PDF, DOCX, TXT, or Markdown")}
                  </label>
                  <input
                    ref={fileInput}
                    id="source-file"
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.markdown"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-accent-soft file:px-2 file:py-1 file:text-xs file:font-medium file:text-accent"
                  />
                  <button
                    type="submit"
                    disabled={!file || sourceAction}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sourceAction ? t("Working…") : t("Upload file")}
                  </button>
                </form>
                <form className="mt-4 space-y-2" onSubmit={(event) => void addUrls(event)}>
                  <label htmlFor="source-urls" className="block text-xs font-medium text-muted">
                    {t("Add public web URL(s)")}
                  </label>
                  <textarea
                    id="source-urls"
                    rows={3}
                    value={urls}
                    onChange={(event) => setUrls(event.target.value)}
                    placeholder="https://example.com/research"
                    className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!urls.trim() || sourceAction}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("Add URL(s)")}
                  </button>
                </form>
                <ul className="mt-4 space-y-2">
                  {sources.map((source) => (
                    <li key={source.id} className="rounded-md border border-line p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">{source.title}</p>
                          <p className="mt-1 text-xs capitalize text-muted">
                            {t(source.source_type)} · {t(source.status.replaceAll("_", " "))}
                            {source.status === "indexed" ? ` · ${source.chunk_count} ${t("passages")}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {source.status === "failed" && (
                            <button
                              type="button"
                              className="text-xs font-medium text-accent hover:underline"
                              onClick={() => void retrySource(source)}
                            >
                              {t("Retry")}
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={t("Remove {name}", { name: source.title })}
                            className="text-xs text-danger hover:underline"
                            onClick={() => void deleteSource(source)}
                          >
                            {t("Remove")}
                          </button>
                        </div>
                      </div>
                      {source.error_message && (
                        <p className="mt-2 text-xs text-danger">{source.error_message}</p>
                      )}
                    </li>
                  ))}
                  {sources.length === 0 && (
                    <li className="rounded-md border border-dashed border-line p-3 text-xs text-muted">
                      {t("Sources you add will appear here with their indexing status.")}
                    </li>
                  )}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>
      ) : (
      <div className="mx-auto grid max-w-[1500px] gap-4 p-3 tablet:p-5 lg:h-[calc(100dvh-4rem)] lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="border-b border-line p-4">
            <Link
              href="/workspace"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0 7 7m-7-7 7-7" />
              </svg>
              {t("Back to collections")}
            </Link>
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"
              onClick={() => void createConversation()}
            >
              <span aria-hidden="true" className="text-lg leading-none">+</span>
              {t("New chat")}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <h2 className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{t("Chat history")}</h2>
            <nav aria-label={t("Chat history")} className="mt-1 grid gap-1">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="group rounded-xl">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-current={activeConversationId === conversation.id ? "page" : undefined}
                      className={`min-w-0 flex-1 truncate rounded-xl px-3 py-3 text-left text-sm transition ${
                        activeConversationId === conversation.id
                          ? "bg-accent-soft font-semibold text-accent"
                          : "text-ink hover:bg-canvas"
                      }`}
                      onClick={() => {
                        void loadConversation(conversation.id).catch((cause: unknown) => {
                          setError(cause instanceof Error ? cause.message : t("Could not load this conversation."));
                        });
                      }}
                    >
                      {conversation.title}
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity desktop:opacity-0 desktop:group-hover:opacity-100 desktop:group-focus-within:opacity-100">
                      <button
                        type="button"
                        aria-label={t("Rename {name}", { name: conversation.title })}
                        title={t("Rename conversation")}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                        onClick={() => {
                          setConversationTitle(conversation.title);
                          setRenameConversationId(conversation.id);
                        }}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 2.651 2.651M4 20l4.5-1 11.013-11.013a1.875 1.875 0 0 0-2.652-2.652L5.848 16.348 4 20Z" />
                        </svg>
                      </button>
                      {conversations.length > 1 && (
                        <button
                          type="button"
                          aria-label={t("Delete {name}", { name: conversation.title })}
                          title={t("Delete conversation")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-accent"
                          onClick={() => void deleteConversation(conversation)}
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5m-14.25 0 .75 13.5h10.5l.75-13.5M9 6.75V4.5h6v2.25m-5.25 3.75v6m4.5-6v6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {renameConversationId === conversation.id && (
                    <form className="flex gap-1 px-1 pb-2" onSubmit={(event) => void renameCurrentConversation(event)}>
                      <label htmlFor={`conversation-title-${conversation.id}`} className="sr-only">
                        {t("New title for {name}", { name: conversation.title })}
                      </label>
                      <input
                        id={`conversation-title-${conversation.id}`}
                        value={conversationTitle}
                        onChange={(event) => setConversationTitle(event.target.value)}
                        maxLength={200}
                        required
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
                      />
                      <button type="submit" className="rounded-lg bg-accent px-2 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-canvas"
                        onClick={() => setRenameConversationId(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </nav>
          </div>
          <div className="border-t border-line p-4">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{t("Research scope")}</h2>
            <div className="grid gap-1">
              {collections.map((collection) => (
                <label key={collection.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-canvas">
                  <input
                    type="checkbox"
                    checked={scopeCollectionIds.includes(collection.id)}
                    onChange={(event) =>
                      setScopeCollectionIds((current) =>
                        event.target.checked
                          ? [...current, collection.id]
                          : current.filter((id) => id !== collection.id),
                      )
                    }
                    className="accent-accent"
                  />
                  <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                  <span className="text-xs text-muted">{collection.source_count}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-[72dvh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm lg:h-full">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 mobile:px-6">
            <div>
              <h2 className="max-w-[min(60vw,36rem)] truncate font-semibold">
                {conversations.find((item) => item.id === activeConversationId)?.title ?? t("Research assistant")}
              </h2>
            </div>
          </div>

          {error && (
            <div className="px-4 pt-4 mobile:px-6" role="alert">
              <ErrorBanner message={error} />
            </div>
          )}

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 mobile:px-6" aria-live="polite">
            {messages.length === 0 && (
              <div className="mx-auto mt-8 max-w-xl rounded-lg border border-dashed border-line p-6 text-center">
                <h3 className="font-semibold">{t("Ask a question grounded in your sources")}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {t("Add and index documents or public pages, select one or more collections, and ask for a summary, comparison, or specific detail. Answers include inspectable source passages.")}
                </p>
              </div>
            )}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`group relative max-w-3xl rounded-lg p-4 ${
                  message.role === "user" ? "ml-auto bg-accent-soft" : "border border-line bg-canvas"
                }`}
              >
                <div className="absolute right-2 top-2 flex items-center gap-1 opacity-100 transition-opacity desktop:opacity-0 desktop:group-hover:opacity-100 desktop:group-focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={copiedMessageId === message.id ? t("Message copied") : t("Copy message")}
                    title={copiedMessageId === message.id ? t("Copied") : t("Copy")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface/90 text-muted shadow-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                    onClick={() => void copyMessage(message)}
                  >
                    {copiedMessageId === message.id ? (
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
                      </svg>
                    )}
                  </button>
                  {message.role === "user" && (
                    <button
                      type="button"
                      aria-label={t("Edit and regenerate this message")}
                      title={t("Edit message")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface/90 text-muted shadow-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                      onClick={() => editMessage(message)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 2.651 2.651M4 20l4.5-1 11.013-11.013a1.875 1.875 0 0 0-2.652-2.652L5.848 16.348 4 20Z" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {message.role === "user" ? t("You") : t("Research answer")}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                {message.citations.length > 0 && (
                  <CitationList citations={message.citations} />
                )}
              </article>
            ))}
            {sending && (
              <div className="flex items-center gap-3 text-sm text-muted">
                <Spinner label={t("Searching sources and preparing a cited answer…")} />
              </div>
            )}
            {hasPendingIngestion && (
              <p className="text-xs text-muted" role="status">
                {t("Source ingestion is running in the background. New passages become searchable when indexed.")}
              </p>
            )}
          </div>

          <form className="border-t border-line p-4 mobile:p-5" onSubmit={(event) => void submitQuestion(event)}>
            <label htmlFor="research-query" className="sr-only">
              {editingMessageId ? t("Edit your question…") : t("Research question")}
            </label>
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
              <textarea
                ref={queryInput}
                id="research-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder={editingMessageId ? t("Edit your question…") : t("Ask a research question…")}
                className="max-h-40 min-h-10 flex-1 resize-y border-0 bg-transparent px-3 py-2 text-sm leading-6 outline-none focus:ring-0"
              />
              <button
                type="submit"
                disabled={!query.trim() || sending || scopeCollectionIds.length === 0}
                aria-label={sending ? t("Researching") : t("Ask")}
                title={sending ? t("Researching") : t("Ask")}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <span role="status" aria-label={t("Researching")} className="size-4 rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                )}
              </button>
            </div>
            {editingMessageId && (
              <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between text-xs text-muted">
                <span>{t("Editing a question will replace it and regenerate the answer.")}</span>
                <button
                  type="button"
                  className="rounded px-2 py-1 font-medium text-accent hover:bg-accent-soft"
                  onClick={() => {
                    setEditingMessageId(null);
                    setQuery("");
                  }}
                >
                  {t("Cancel edit")}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
      )}
    </main>
  );
}

function formatResearchError(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) {
    return cause instanceof Error ? cause.message : fallback;
  }
  const details = Object.entries(cause.details ?? {}).flatMap(([field, messages]) =>
    messages.map((message) => `${field}: ${message}`),
  );
  return details.length ? `${cause.message} ${details.join(" ")}` : cause.message;
}

function CitationList({ citations }: { citations: ResearchCitation[] }) {
  const { t } = useLanguage();

  return (
    <section className="mt-4 border-t border-line pt-3" aria-label={t("Evidence cited in this answer")}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Evidence")}</h3>
      <ul className="mt-2 space-y-2">
        {citations.map((citation) => (
          <li key={`${citation.id}-${citation.source_id}`} className="rounded-md border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
                [{citation.id}]
              </span>
              {citation.url ? (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm font-medium text-accent underline underline-offset-2"
                >
                  {citation.title}
                </a>
              ) : (
                <span className="text-sm font-medium">{citation.title}</span>
              )}
              {citation.page_number && (
                <span className="text-xs text-muted">{t("Page {number}", { number: citation.page_number })}</span>
              )}
              {citation.section_path && (
                <span className="text-xs text-muted">{citation.section_path}</span>
              )}
            </div>
            <blockquote className="mt-2 border-l-2 border-accent/40 pl-3 text-xs leading-5 text-muted">
              {citation.excerpt}
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}
