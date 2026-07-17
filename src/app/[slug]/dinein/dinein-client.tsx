"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Send, Utensils, Check } from "lucide-react";

interface DineinConfig {
  slug: string;
  displayName: string;
  address: string | null;
  stubMode: boolean;
  llm: string;
}

interface SlotOption {
  slotId: number;
  dateStr: string;
  displayTime: string;
  slotGroupName: string;
  dealTitle: string;
}

interface AgentResult {
  reply: string;
  needsConfirmation?: boolean;
  slotOptions?: SlotOption[];
  completed?: boolean;
  orderId?: string;
}

type Msg =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string }
  | { kind: "card"; text: string; orderId?: string };

// The agent replies in light markdown (**bold**, *italic*) — render just those
// two forms instead of showing raw asterisks.
function formatInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function DineinClient({
  slug,
  config,
  apiBase,
}: {
  slug: string;
  config: DineinConfig;
  apiBase: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      kind: "bot",
      text: `Hi! I can reserve your table at ${config.displayName} right here. When would you like to dine, and for how many people?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [slotOptions, setSlotOptions] = useState<SlotOption[]>([]);
  const sessionId = useRef(`web-${Math.random().toString(36).slice(2, 10)}`);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const handleResult = useCallback((r: AgentResult) => {
    setNeedsConfirmation(!!r.needsConfirmation);
    // Only chip the slots the agent actually mentioned in its reply, so the
    // chips can't contradict the text (fall back to all if none matched).
    const all = r.slotOptions ?? [];
    const mentioned = all.filter((o) => r.reply.includes(o.displayTime));
    setSlotOptions(!r.needsConfirmation && !r.completed ? (mentioned.length ? mentioned : all) : []);
    if (r.completed) {
      setMessages((m) => [...m, { kind: "card", text: r.reply, orderId: r.orderId }]);
    } else {
      setMessages((m) => [...m, { kind: "bot", text: r.reply }]);
    }
  }, []);

  const post = useCallback(
    async (body: Record<string, unknown>, path: "chat" | "confirm") => {
      setBusy(true);
      try {
        const res = await fetch(`${apiBase}/v1/public/dinein/${slug}/${path}`, {
          method: "POST",
          // ngrok-skip header: free-tier tunnels interpose a browser warning page;
          // this keeps API calls clean when demoing through ngrok
          headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
          body: JSON.stringify({ sessionId: sessionId.current, ...body }),
        });
        const json = await res.json();
        if (json?.data) handleResult(json.data as AgentResult);
        else setMessages((m) => [...m, { kind: "bot", text: "Something went wrong — please try again." }]);
      } catch {
        setMessages((m) => [...m, { kind: "bot", text: "Network hiccup — please try again." }]);
      } finally {
        setBusy(false);
      }
    },
    [apiBase, slug, handleResult]
  );

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || busy) return;
      setMessages((m) => [...m, { kind: "user", text }]);
      setSlotOptions([]);
      void post({ message: text }, "chat");
    },
    [busy, post]
  );

  const decide = useCallback(
    (decision: "yes" | "no") => {
      setMessages((m) => [...m, { kind: "user", text: decision === "yes" ? "Yes, book it ✅" : "No" }]);
      setNeedsConfirmation(false);
      void post({ decision }, "confirm");
    },
    [post]
  );

  return (
    <div className="min-h-screen bg-[#0e0f12] text-zinc-100 flex flex-col items-center">
      {/* header */}
      <header className="w-full max-w-2xl px-5 pt-8 pb-4">
        <div className="inline-flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800 rounded-full px-3 py-1 mb-4">
          <MapPin size={12} className="text-blue-400" />
          Reserve a table · via Google
        </div>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
            <Utensils size={20} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{config.displayName}</h1>
            {config.address && <p className="text-sm text-zinc-400">{config.address}</p>}
          </div>
        </div>
      </header>

      {/* chat */}
      <main className="w-full max-w-2xl flex-1 px-5 pb-6 flex flex-col">
        <div
          ref={scroller}
          className="flex-1 min-h-[420px] max-h-[62vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#16181d] p-4 flex flex-col gap-3"
        >
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={m.kind === "user" ? "self-end max-w-[82%]" : "self-start max-w-[88%]"}
              >
                {m.kind === "card" ? (
                  <div className="rounded-2xl border border-blue-900/60 bg-gradient-to-br from-[#1d2530] to-[#16181d] p-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-medium mb-2">
                      <Check size={16} /> Reservation confirmed
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-zinc-200">
                      {formatInline(m.text.replace(/\n*Powered by Swiggy\s*$/i, ""))}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center gap-1.5 text-xs text-zinc-400">
                      Powered by <span className="text-orange-400 font-semibold">Swiggy</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      m.kind === "user"
                        ? "rounded-2xl rounded-br-md bg-orange-500 text-[#14100b] font-medium px-4 py-2.5 whitespace-pre-wrap"
                        : "rounded-2xl rounded-bl-md bg-[#1d2026] border border-zinc-800 px-4 py-2.5 whitespace-pre-wrap text-sm"
                    }
                  >
                    {m.kind === "bot" ? formatInline(m.text) : m.text}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {busy && <div className="self-start text-xs text-zinc-500 pl-1 animate-pulse">Checking with Swiggy Dineout…</div>}

          {/* confirmation chips */}
          {needsConfirmation && !busy && (
            <div className="self-start flex gap-2">
              <button
                onClick={() => decide("yes")}
                className="rounded-full bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 px-4 py-1.5 text-sm hover:bg-emerald-500/25"
              >
                ✅ Yes, book it
              </button>
              <button
                onClick={() => decide("no")}
                className="rounded-full border border-zinc-700 text-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-800"
              >
                ❌ No
              </button>
            </div>
          )}

          {/* slot chips */}
          {!needsConfirmation && slotOptions.length > 0 && !busy && (
            <div className="self-start flex flex-wrap gap-2">
              {slotOptions.slice(0, 6).map((o) => (
                <button
                  key={o.slotId}
                  onClick={() => send(`I'll take the ${o.displayTime} slot on ${o.dateStr}. Book that one.`)}
                  className="rounded-full border border-orange-500/60 text-orange-300 px-3 py-1.5 text-xs hover:bg-orange-500/10"
                >
                  {o.displayTime} · {o.dateStr.slice(5)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = input.trim();
            if (!v) return;
            setInput("");
            send(v);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try: "table for 4 tomorrow at 7:30 pm"'
            className="flex-1 rounded-xl bg-[#16181d] border border-zinc-800 focus:border-orange-500 outline-none px-4 py-3 text-sm placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-orange-500 text-[#14100b] px-4 disabled:opacity-50"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </form>
      </main>

      <footer className="pb-6 text-xs text-zinc-600 flex items-center gap-1.5">
        Reservations by Retilo · Powered by{" "}
        <span className="text-orange-400 font-medium">Swiggy</span>
      </footer>
    </div>
  );
}
