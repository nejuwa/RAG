"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const MAX_MESSAGE_LENGTH = 10_000;

export function MessageInput({
  disabled,
  sending,
  onSend,
}: {
  disabled?: boolean;
  sending: boolean;
  onSend: (message: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = value.trim();
    if (!content || disabled || sending) return;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      await onSend(content);
    } catch {
      setValue(content);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl">
      <div className="rounded-lg border border-line bg-surface p-2 focus-within:border-accent">
        <label htmlFor="chat-message" className="sr-only">Write a message</label>
        <textarea
          ref={textareaRef}
          id="chat-message"
          name="message"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          value={value}
          disabled={disabled || sending}
          onChange={(event) => {
            setValue(event.target.value);
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 200)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything"
          className="block max-h-48 min-h-11 w-full resize-none bg-transparent px-3 py-3 text-base leading-6 text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed"
          aria-describedby="message-input-help"
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-1">
          <p id="message-input-help" className="text-xs text-muted">
            Enter to send · Shift + Enter for a new line
          </p>
          <div className="flex items-center gap-3">
            {value.length > 0 && (
              <span className="text-xs tabular-nums text-muted">{value.length}/{MAX_MESSAGE_LENGTH}</span>
            )}
            <Button type="submit" disabled={disabled || sending || !value.trim()} className="min-h-9 px-3">
              {sending ? <Spinner label="Sending…" /> : "Send"}
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted">AI responses can be inaccurate. Check important information.</p>
    </form>
  );
}
