"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/types/api";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

export function ChatWindow({
  messages,
  streamingText,
  loading,
  sending,
  conversationTitle,
}: {
  messages: Message[];
  streamingText: string;
  loading: boolean;
  sending: boolean;
  conversationTitle?: string;
}) {
  const bottomRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, streamingText, sending]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 tablet:px-8" aria-label="Loading messages">
        <div className="h-20 rounded-lg bg-line/60" />
        <div className="ml-auto h-14 w-3/4 rounded-lg bg-line/60" />
        <div className="h-24 w-5/6 rounded-lg bg-line/60" />
      </div>
    );
  }

  if (messages.length === 0 && !streamingText && !sending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-sm font-medium text-accent">A new conversation</p>
        <h2 className="mt-3 max-w-xl text-2xl font-semibold tracking-tight text-ink mobile:text-3xl">
          {conversationTitle && conversationTitle !== "New chat" ? conversationTitle : "What would you like to work on?"}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted">
          Ask a question, explore an idea, or get help thinking through a task.
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      aria-label="Conversation messages"
      aria-live="polite"
    >
      <ol className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-7 tablet:px-8 tablet:py-10">
        {messages.map((message) => {
          const isUser = message.role === "USER";
          return (
            <li key={message.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
              <article className={`max-w-[92%] mobile:max-w-[85%] ${isUser ? "rounded-2xl rounded-br-sm bg-accent-soft px-4 py-3 tablet:px-5" : "px-1 py-1"}`}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink">
                    {isUser ? "You" : message.sender?.displayName ?? "Assistant"}
                  </span>
                  <time className="text-xs text-muted" dateTime={message.createdAt}>
                    {formatTime(message.createdAt)}
                  </time>
                </div>
                <div className="whitespace-pre-wrap break-words text-sm leading-7 text-ink tablet:text-base">
                  {message.content}
                </div>
                {message.type === "FILE" || message.type === "IMAGE" ? (
                  <a
                    className="mt-3 inline-flex min-h-10 items-center rounded-md border border-line bg-white px-3 text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                    href={api.baseUrl + message.content}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open attachment
                  </a>
                ) : null}
              </article>
            </li>
          );
        })}
        {(sending || streamingText) && (
          <li className="flex justify-start">
            <article className="max-w-[92%] px-1 py-1 mobile:max-w-[85%]">
              <div className="mb-1.5 text-xs font-semibold text-ink">Assistant</div>
              {streamingText ? (
                <div className="whitespace-pre-wrap break-words text-sm leading-7 text-ink tablet:text-base">
                  {streamingText}
                </div>
              ) : (
                <Spinner label="Thinking…" />
              )}
            </article>
          </li>
        )}
        <li ref={bottomRef} aria-hidden="true" />
      </ol>
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
