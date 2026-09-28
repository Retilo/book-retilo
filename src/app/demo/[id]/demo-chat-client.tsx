"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

interface DemoConfig {
  restaurantName: string;
  logoUrl: string | null;
  swiggyRestaurantId: string | null;
}

interface Message {
  role: "bot" | "user" | "sys";
  text: string;
}

interface Props {
  id: string;
  config: DemoConfig | null;
  apiBase: string;
}

export function DemoChatClient({ id, config, apiBase }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const sessionId = useRef(`demo-${Math.random().toString(36).slice(2, 10)}`);
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!config) {
      setMessages([{ role: "sys", text: "This demo link has expired. Visit retilo.io to create a new one." }]);
      return;
    }
    setEnabled(false);
    setBusy(true);
    const greeting = `Hi! I want to book a table at ${config.restaurantName}.`;
    doChat(greeting, true);
  }, []);

  async function doChat(text: string, isAuto = false) {
    if (!config) return;
    if (!isAuto) setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    setEnabled(false);
    try {
      const res = await fetch(`${apiBase}/v1/public/demo/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, message: text }),
      });
      const data = await res.json();
      const reply = data?.data?.reply ?? "How can I help you today?";
      setMessages((m) => [...m, { role: "bot", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "sys", text: "Something went wrong — please try again." }]);
    } finally {
      setBusy(false);
      setEnabled(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    doChat(text);
  }

  const restaurantName = config?.restaurantName ?? "Restaurant";
  const logoUrl = config?.logoUrl;

  return (
    <div className="flex h-dvh flex-col bg-[#09090f] font-[Inter,system-ui,sans-serif] text-[#f4f4f5] max-w-[480px] mx-auto">
      {/* Demo tag */}
      <div className="shrink-0 bg-orange-500 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-white">
        LIVE DEMO — powered by Retilo AI
      </div>

      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[#1e1e1e] px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1e1e1e] text-xl">
          {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : "🍽"}
        </div>
        <div>
          <div className="text-[15px] font-bold">{restaurantName}</div>
          <div className="text-[11px] text-[#737373]">AI-powered reservations</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "max-w-[82%] self-end rounded-2xl rounded-br-sm bg-orange-500 px-3.5 py-2.5 text-[14px] leading-relaxed text-white"
                : m.role === "sys"
                ? "self-center text-center text-[12px] text-[#737373] px-3 py-1"
                : "max-w-[82%] self-start rounded-2xl rounded-bl-sm bg-[#1e1e1e] px-3.5 py-2.5 text-[14px] leading-relaxed"
            }
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-sm bg-[#1e1e1e] px-3.5 py-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[#737373] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
        <div ref={msgsEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex items-end gap-2 border-t border-[#1e1e1e] px-3 py-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 88) + "px";
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={!enabled}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none rounded-2xl bg-[#1e1e1e] border border-[#262626] px-4 py-2.5 text-[14px] text-[#f4f4f5] outline-none transition focus:border-orange-500 placeholder:text-[#737373] disabled:opacity-40 max-h-[88px]"
        />
        <button
          onClick={send}
          disabled={!enabled || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 transition hover:bg-orange-600 disabled:opacity-40"
        >
          <Send className="h-4 w-4 text-white" />
        </button>
      </div>

      <div className="shrink-0 py-2 text-center text-[10px] text-[#737373]">
        Reservations by <span className="font-bold text-orange-500">Retilo</span>
      </div>
    </div>
  );
}
