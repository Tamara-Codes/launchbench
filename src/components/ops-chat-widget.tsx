"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Loader2, NotebookText, Trash2, X } from "lucide-react";
import { AgentAvatar } from "./agent-avatar";
import { toast } from "./toast";
import { cn } from "@/lib/utils";
import { deleteOpsFact, loadOpsFacts, loadOpsHistory, sendOpsMessage } from "@/server/ops-chat-actions";
import type { OpsFact, StoredMessage, ToolCallRecord } from "@/lib/ops-chat-types";

/**
 * 007, the ops agent: a floating window, available on every page.
 *
 * Not a modal and not an edge-anchored panel — it must not trap focus or block
 * the page, because the point is to talk to it *while* working.
 *
 * Design: the agent's replies are plain prose and only her own messages get a
 * bubble, so the window reads as a document rather than a symmetric chat toy.
 * What the agent *did* renders as a run log on a mint rail — the one loud
 * element, and an honest shape for the content, since a list of actions taken
 * genuinely is a log.
 *
 * Type is set explicitly here rather than inherited: the app's --font-mono token
 * is undefined, so inheriting would mean the browser default.
 */

const PROSE = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const LOG = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Verbs, not function names: the log should read as actions, not an API trace. */
const toolVerbs: Record<string, string> = {
  add_task: "task added",
  complete_task: "task done",
  drop_task: "task dropped",
  delete_task: "task deleted",
  reschedule_task: "task updated",
  add_event: "calendar",
  remember: "remembered",
  forget: "forgot",
  search_messages: "searched history",
  draft_post: "post drafted",
  run_lead_finder: "lead finder queued",
  run_content_agent: "content agent queued",
};

function toolArgument(call: ToolCallRecord): string | undefined {
  const input = (call.input ?? {}) as Record<string, unknown>;
  const candidate = [input.title, input.slug, input.hook, input.query, input.territory, input.project]
    .find((value) => typeof value === "string" && value.length > 0);
  return typeof candidate === "string" ? candidate : undefined;
}

/** The signature element: what happened, as a log on a mint rail. */
function ActionLog({ calls }: { calls: ToolCallRecord[] }) {
  return (
    <ul className="mt-2 space-y-1 border-l border-accent/40 pl-3" style={{ fontFamily: LOG }}>
      {calls.map((call, index) => {
        const failed = Boolean(call.error);
        const argument = toolArgument(call);
        return (
          <li key={index} className="flex items-baseline gap-2 text-[11px] leading-relaxed">
            <span className={cn("shrink-0", failed ? "text-danger" : "text-accent")}>
              {failed ? "failed" : toolVerbs[call.name] ?? call.name}
            </span>
            <span className="min-w-0 truncate text-muted" title={call.error ?? argument}>
              {failed ? call.error : argument}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MessageRow({ message }: { message: StoredMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p
          className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2 text-sm leading-relaxed text-ink-strong"
          style={{ fontFamily: PROSE }}
        >
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="pr-6">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink" style={{ fontFamily: PROSE }}>
        {message.content}
      </p>
      {message.tool_calls?.length > 0 && <ActionLog calls={message.tool_calls} />}
    </div>
  );
}

function MemoryPanel({ facts, onForget }: { facts: OpsFact[] | null; onForget: (slug: string) => void }) {
  if (facts === null) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading…</div>;
  }
  if (facts.length === 0) {
    return (
      <div className="flex flex-1 items-center px-5 text-sm text-muted" style={{ fontFamily: PROSE }}>
        Nothing remembered yet. As you talk, anything worth keeping lands here — and you can delete whatever it gets wrong.
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {facts.map((fact) => (
        <div key={fact.id} className="group">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-accent" style={{ fontFamily: LOG }}>{fact.slug}</span>
            <button
              onClick={() => onForget(fact.slug)}
              aria-label={`Forget ${fact.slug}`}
              className="shrink-0 text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink" style={{ fontFamily: PROSE }}>{fact.body}</p>
        </div>
      ))}
    </div>
  );
}

export function OpsChatWidget() {
  const [open, setOpen] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [facts, setFacts] = useState<OpsFact[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const pageName = pathname === "/app" ? "Today" : pathname.replace("/app/", "").replace(/-/g, " ") || "Today";

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Capture has to be faster than navigating, so it opens from anywhere.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || loadedHistory) return;
    void Promise.all([loadOpsHistory(), loadOpsFacts()]).then(([history, memory]) => {
      if (history.ok) {
        const loaded = history.data?.messages ?? [];
        setMessages(loaded);
        setHasMore(loaded.length >= 40);
      }
      if (memory.ok) setFacts(memory.data?.facts ?? []);
      setLoadedHistory(true);
      scrollToBottom();
    });
  }, [open, loadedHistory, scrollToBottom]);

  useEffect(() => {
    if (open && !showMemory) inputRef.current?.focus();
  }, [open, showMemory]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const node = scrollRef.current;
    const previousHeight = node?.scrollHeight ?? 0;
    const result = await loadOpsHistory(oldest.id);
    if (result.ok) {
      const older = result.data?.messages ?? [];
      if (older.length === 0) setHasMore(false);
      setMessages((current) => [...older, ...current]);
      // Hold the reading position instead of jumping to the top.
      requestAnimationFrame(() => {
        if (node) node.scrollTop = node.scrollHeight - previousHeight;
      });
    }
    setLoadingOlder(false);
  }

  async function forget(slug: string) {
    const result = await deleteOpsFact(slug);
    if (!result.ok) { toast(result.error, "error"); return; }
    setFacts((current) => current?.filter((fact) => fact.slug !== slug) ?? null);
    router.refresh();
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    const pending: StoredMessage = { id: -Date.now(), role: "user", content: text, tool_calls: [], created_at: new Date().toISOString() };
    setMessages((current) => [...current, pending]);
    scrollToBottom();

    const result = await sendOpsMessage({ text, page: pageName });
    if (!result.ok) {
      toast(result.error, "error");
      // Give the text back rather than losing what she typed.
      setMessages((current) => current.filter((message) => message.id !== pending.id));
      setDraft(text);
      setSending(false);
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: -Date.now() - 1,
        role: "assistant",
        content: result.data?.reply ?? "",
        tool_calls: result.data?.toolCalls ?? [],
        created_at: new Date().toISOString(),
      },
    ]);
    setSending(false);
    scrollToBottom();
    // A remembered fact should show up in the memory panel without a reopen.
    if (result.data?.toolCalls?.some((call) => call.name === "remember" || call.name === "forget")) {
      void loadOpsFacts().then((memory) => { if (memory.ok) setFacts(memory.data?.facts ?? []); });
    }
    // Tool calls may have changed what the page behind the window is showing.
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open 007. Shortcut: Control or Command K"
        title="007  ⌘K"
        className={cn(
          "group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full",
          "border border-accent/30 bg-surface shadow-[0_10px_40px_-8px_rgba(0,0,0,0.8)]",
          "transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        )}
        style={{ animation: "ops-launcher-in 200ms ease-out" }}
      >
        {/* Her own agent mark, not a generic speech bubble. */}
        <AgentAvatar name="007" color="emerald" size="sm" className="ring-0" />
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-accent/0 transition-all group-hover:ring-accent/40" />
      </button>
    );
  }

  return (
    <aside
      aria-label="007"
      className={cn(
        "fixed bottom-6 right-6 z-40 flex w-[404px] flex-col overflow-hidden rounded-2xl",
        "border border-border/80 bg-surface/95 backdrop-blur-xl",
        "shadow-[0_28px_80px_-16px_rgba(0,0,0,0.85)]",
      )}
      style={{ height: "min(660px, calc(100dvh - 6rem))", animation: "ops-window-in 200ms cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <header className="flex items-center gap-2.5 border-b border-border/70 px-3.5 py-3">
        <AgentAvatar name="007" color="emerald" size="xs" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink-strong" style={{ fontFamily: PROSE }}>007</p>
        <button
          onClick={() => setShowMemory((current) => !current)}
          aria-label={showMemory ? "Back to conversation" : "What it remembers"}
          title={showMemory ? "Back to conversation" : "What it remembers"}
          className={cn(
            "rounded-lg p-1.5 transition-colors hover:bg-surface2",
            showMemory ? "bg-surface2 text-accent" : "text-muted hover:text-ink",
          )}
        >
          <NotebookText className="h-4 w-4" />
        </button>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {showMemory ? (
        <MemoryPanel facts={facts} onForget={forget} />
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {hasMore && messages.length > 0 && (
              <button
                onClick={loadOlder}
                disabled={loadingOlder}
                className="mx-auto block text-[11px] text-muted transition-colors hover:text-accent"
                style={{ fontFamily: LOG }}
              >
                {loadingOlder ? "loading…" : "earlier messages"}
              </button>
            )}

            {loadedHistory && messages.length === 0 && (
              <div className="pt-6" style={{ fontFamily: PROSE }}>
                <p className="text-sm leading-relaxed text-ink">
                  Tell me what happened and I&rsquo;ll file it.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Try: <span className="text-ink">coffee with Sonja Tuesday 10am, prep the phone demo first, she has 6 apartments not 4</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  That becomes a meeting, a task, and one thing I&rsquo;ll still know next month.
                </p>
              </div>
            )}

            {messages.map((message) => <MessageRow key={message.id} message={message} />)}

            {sending && (
              <div className="flex items-center gap-2 text-[11px] text-muted" style={{ fontFamily: LOG }}>
                <Loader2 className="h-3 w-3 animate-spin text-accent" />thinking
              </div>
            )}
          </div>

          <form onSubmit={(bubbled) => { bubbled.preventDefault(); void send(); }} className="px-3 pb-3">
            <div className="flex items-end gap-2 rounded-xl border border-border/80 bg-surface2/60 p-2 transition-colors focus-within:border-accent/50">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(changed) => setDraft(changed.target.value)}
                onKeyDown={(pressed) => {
                  if (pressed.key === "Enter" && !pressed.shiftKey) {
                    pressed.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="What happened?"
                aria-label="Message 007"
                className="max-h-32 min-h-[1.75rem] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none"
                style={{ fontFamily: PROSE }}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                  "bg-accent text-accent-fg disabled:bg-surface2 disabled:text-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                )}
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
              </button>
            </div>
          </form>
        </>
      )}
    </aside>
  );
}
