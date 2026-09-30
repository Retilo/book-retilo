"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, Clock, Minus, Plus, Send, Users } from "lucide-react";

interface DemoConfig {
  restaurantName: string;
  logoUrl: string | null;
  swiggyRestaurantId: string | null;
}

interface SlotOption {
  slotId: number;
  dateStr: string;
  displayTime: string;
  slotGroupName: string;
  dealTitle: string;
  isFree?: boolean;
}

interface AgentResult {
  reply: string;
  needsConfirmation?: boolean;
  needsPayment?: boolean;
  amount?: number | null;
  dealTitle?: string | null;
  cartId?: string | null;
  slotOptions?: SlotOption[];
  completed?: boolean;
  orderId?: string;
}

type Msg =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string }
  | { kind: "card"; text: string };

interface Props {
  id: string;
  config: DemoConfig | null;
  apiBase: string;
}

const PRIMARY = "#f97316"; // orange-500

const TIME_GROUPS = [
  { label: "Lunch",   times: ["12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM"] },
  { label: "Evening", times: ["5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM"] },
  { label: "Dinner",  times: ["7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM"] },
];

function nextDays(count: number) {
  const out: { iso: string; chip: string; long: string }[] = [];
  const fmtChip = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric" });
  const fmtLong = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" });
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({
      iso,
      chip: i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmtChip.format(d),
      long: i === 0 ? "today" : i === 1 ? "tomorrow" : `on ${fmtLong.format(d)}`,
    });
  }
  return out;
}

function Chip({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full border px-4 py-2 text-sm transition-all duration-150 select-none",
        selected
          ? "bg-orange-500 text-white font-semibold border-transparent shadow-lg"
          : "border-white/12 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] active:scale-95",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-medium mb-2.5">
      <Icon size={13} className="text-orange-500" />
      {children}
    </div>
  );
}

function formatInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function DemoChatClient({ id, config, apiBase }: Props) {
  const days = useMemo(() => nextDays(7), []);

  // ── composer state ──────────────────────────────────────────────────────────
  const [guests, setGuests]   = useState<number | null>(2);
  const [dateIdx, setDateIdx] = useState<number | null>(0);
  const [time, setTime]       = useState<string | null>(null);
  const [view, setView]       = useState<"compose" | "chat">("compose");

  // ── conversation state ──────────────────────────────────────────────────────
  const [messages, setMessages]               = useState<Msg[]>([]);
  const [input, setInput]                     = useState("");
  const [busy, setBusy]                       = useState(false);
  const [slotOptions, setSlotOptions]         = useState<SlotOption[]>([]);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [needsPayment, setNeedsPayment]       = useState(false);
  const [paymentAmount, setPaymentAmount]     = useState<number | null>(null);
  const [paymentDealTitle, setPaymentDealTitle] = useState<string | null>(null);
  const [payBusy, setPayBusy]                 = useState(false);
  const [custName, setCustName]               = useState("");
  const [custPhone, setCustPhone]             = useState("");
  const sessionId = useRef(`demo-${Math.random().toString(36).slice(2, 10)}`);
  const scroller  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const handleResult = useCallback((r: AgentResult) => {
    setNeedsConfirmation(!!r.needsConfirmation);
    if (r.needsPayment) {
      setNeedsPayment(true);
      setPaymentAmount(r.amount ?? null);
      setPaymentDealTitle(r.dealTitle ?? null);
    } else {
      setNeedsPayment(false);
      setPaymentAmount(null);
      setPaymentDealTitle(null);
    }
    const all = r.slotOptions ?? [];
    const mentioned = all.filter((o) => r.reply.includes(o.displayTime));
    setSlotOptions(!r.needsConfirmation && !r.needsPayment && !r.completed ? (mentioned.length ? mentioned : all) : []);
    if (r.completed) {
      setMessages((m) => [...m, { kind: "card", text: r.reply }]);
    } else {
      setMessages((m) => [...m, { kind: "bot", text: r.reply }]);
    }
  }, []);

  const post = useCallback(
    async (body: Record<string, unknown>, path: "chat" | "confirm") => {
      if (!config) return;
      setBusy(true);
      try {
        const res = await fetch(`${apiBase}/v1/public/demo/${id}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    [apiBase, id, config, handleResult]
  );

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || busy) return;
      setMessages((m) => [...m, { kind: "user", text }]);
      setSlotOptions([]);
      setNeedsPayment(false);
      setPaymentAmount(null);
      setPaymentDealTitle(null);
      void post({ message: text }, "chat");
    },
    [busy, post]
  );

  const completePay = useCallback(async () => {
    if (!config || payBusy) return;
    setPayBusy(true);
    setNeedsPayment(false);
    try {
      const res = await fetch(`${apiBase}/v1/public/demo/${id}/complete-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current }),
      });
      const json = await res.json();
      if (json?.data) handleResult(json.data as AgentResult);
      else setMessages((m) => [...m, { kind: "bot", text: "Payment confirmation failed — please try again." }]);
    } catch {
      setMessages((m) => [...m, { kind: "bot", text: "Network hiccup — please try again." }]);
    } finally {
      setPayBusy(false);
    }
  }, [apiBase, id, config, handleResult, payBusy]);

  const decide = useCallback(
    (decision: "yes" | "no") => {
      setMessages((m) => [...m, { kind: "user", text: decision === "yes" ? "Yes, book it ✅" : "No, change it" }]);
      setNeedsConfirmation(false);
      void post({ decision, customerName: custName.trim() || null, customerPhone: custPhone.trim() || null }, "confirm");
    },
    [post, custName, custPhone]
  );

  const canSubmit = guests !== null && dateIdx !== null && time !== null;

  const submitComposer = useCallback(() => {
    if (!canSubmit || busy || !config) return;
    const day = days[dateIdx!];
    const msg = `Table for ${guests} at ${config.restaurantName} ${day.long} (${day.iso}) at ${time}.`;
    setView("chat");
    send(msg);
  }, [canSubmit, busy, config, days, dateIdx, guests, time, send]);

  const restaurantName = config?.restaurantName ?? "Restaurant";
  const logoUrl = config?.logoUrl;

  if (!config) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-[#09090f] text-zinc-400 text-sm px-6 text-center">
        This demo link has expired. Visit retilo.io to create a new one.
      </div>
    );
  }

  return (
    <div
      className="flex h-dvh flex-col bg-[#09090f] font-[Inter,system-ui,sans-serif] text-[#f4f4f5] max-w-[480px] mx-auto"
      style={{ "--primary": PRIMARY } as React.CSSProperties}
    >
      {/* demo tag */}
      <div className="shrink-0 bg-orange-500 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-white">
        LIVE DEMO — powered by Retilo AI
      </div>

      {/* header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[#1e1e1e] px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1e1e1e] text-xl">
          {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : "🍽"}
        </div>
        <div>
          <div className="text-[15px] font-bold">{restaurantName}</div>
          <div className="text-[11px] text-[#737373]">AI-powered reservations</div>
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col overflow-hidden px-4 py-4 gap-3">

        {/* ── composer ───────────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {view === "compose" && (
            <motion.div
              key="composer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, overflow: "hidden" }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-[#1e1e1e] bg-[#111114] p-4 flex flex-col gap-5"
            >
              {/* guests */}
              <div>
                <SectionLabel icon={Users}>How many guests?</SectionLabel>
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 py-1">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <Chip key={n} selected={guests === n} onClick={() => setGuests(n)} className="min-w-[46px] justify-center">
                      {n}
                    </Chip>
                  ))}
                  <Chip selected={guests !== null && guests > 6} onClick={() => setGuests(7)}>7+</Chip>
                  {guests !== null && guests > 6 && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        type="button"
                        onClick={() => setGuests((g) => Math.max(7, (g ?? 7) - 1))}
                        className="h-8 w-8 rounded-full border border-white/12 flex items-center justify-center text-zinc-300 active:scale-90"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{guests}</span>
                      <button
                        type="button"
                        onClick={() => setGuests((g) => Math.min(40, (g ?? 7) + 1))}
                        className="h-8 w-8 rounded-full border border-white/12 flex items-center justify-center text-zinc-300 active:scale-90"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* date */}
              <div>
                <SectionLabel icon={CalendarDays}>Which day?</SectionLabel>
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 py-1">
                  {days.map((d, i) => (
                    <Chip key={d.iso} selected={dateIdx === i} onClick={() => setDateIdx(i)}>
                      {d.chip}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* time */}
              <div>
                <SectionLabel icon={Clock}>What time?</SectionLabel>
                <div className="flex flex-col gap-2">
                  {TIME_GROUPS.map((g) => (
                    <div key={g.label} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[11px] text-zinc-500">{g.label}</span>
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {g.times.map((t) => (
                          <Chip key={t} selected={time === t} onClick={() => setTime(t)} className="px-3 py-1.5 text-[13px]">
                            {t}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={submitComposer}
                disabled={!canSubmit || busy}
                className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-40"
              >
                {canSubmit
                  ? `Find my table — ${guests} guests · ${days[dateIdx!].chip} · ${time}`
                  : "Pick a time to continue"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── chat ───────────────────────────────────────────────────────── */}
        {view === "chat" && (
          <>
            <div
              ref={scroller}
              className="flex-1 overflow-y-auto flex flex-col gap-2.5"
            >
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    className={m.kind === "user" ? "self-end max-w-[82%]" : "self-start max-w-[88%]"}
                  >
                    {m.kind === "card" ? (
                      <div className="rounded-2xl border border-orange-500/40 bg-[#1a1512] p-4">
                        <div className="flex items-center gap-2 text-emerald-400 font-medium mb-2 text-sm">
                          <Check size={15} /> Reservation confirmed
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-zinc-200">
                          {formatInline(m.text.replace(/\n*Powered by Swiggy\s*$/i, ""))}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={
                          m.kind === "user"
                            ? "rounded-2xl rounded-br-sm bg-orange-500 px-3.5 py-2.5 text-[14px] leading-relaxed text-white"
                            : "rounded-2xl rounded-bl-sm bg-[#1e1e1e] px-3.5 py-2.5 text-[14px] leading-relaxed"
                        }
                      >
                        {m.kind === "bot" ? formatInline(m.text) : m.text}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

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

              {/* payment card */}
              {needsPayment && !busy && !payBusy && (
                <div className="self-start w-full max-w-sm rounded-2xl border border-orange-500/40 bg-[#1a1208] p-4 flex flex-col gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-orange-500/80">
                    Booking fee required
                  </p>
                  {paymentDealTitle && (
                    <p className="text-sm text-zinc-200">{paymentDealTitle}</p>
                  )}
                  {paymentAmount != null && (
                    <p className="text-2xl font-bold text-white">₹{paymentAmount}</p>
                  )}
                  <button
                    onClick={completePay}
                    className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Pay via UPI &amp; Confirm table
                  </button>
                  <p className="text-[10px] text-zinc-600 text-center">Staging demo environment</p>
                </div>
              )}

              {payBusy && !busy && (
                <div className="self-start flex items-center gap-2 text-xs text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Processing payment…
                </div>
              )}

              {/* slot chips */}
              {!needsConfirmation && !needsPayment && slotOptions.length > 0 && !busy && (
                <div className="self-start flex flex-wrap gap-2 pt-1">
                  {slotOptions.slice(0, 6).map((o) => (
                    <button
                      key={o.slotId}
                      onClick={() => send(`I'll take the ${o.displayTime} slot on ${o.dateStr}. Book that one.`)}
                      className="rounded-full border border-orange-500/50 px-3 py-1.5 text-xs text-orange-300 hover:bg-orange-500/10 transition-colors"
                    >
                      {o.displayTime} · {o.dateStr.slice(5)}
                      {o.isFree === false && (
                        <span className="ml-1.5 opacity-60">· paid</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* confirmation form */}
              {needsConfirmation && !busy && (
                <div className="self-start w-full max-w-sm rounded-2xl border border-zinc-700 bg-[#1d2026] p-4 flex flex-col gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                    Your details (for the reminder)
                  </p>
                  <input
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="w-full rounded-xl bg-[#0e0f12] border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-orange-500"
                  />
                  <input
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="Phone number"
                    type="tel"
                    autoComplete="tel"
                    className="w-full rounded-xl bg-[#0e0f12] border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-orange-500"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => decide("yes")}
                      disabled={custName.trim().length < 2}
                      className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-40"
                    >
                      ✅ Confirm booking
                    </button>
                    <button
                      onClick={() => decide("no")}
                      className="rounded-xl border border-zinc-700 text-zinc-400 px-4 py-2.5 text-sm hover:bg-zinc-800"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* free-text input */}
            <div
              className="shrink-0 flex items-end gap-2 border-t border-[#1e1e1e] pt-3"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 88) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const v = input.trim();
                    if (!v) return;
                    setInput("");
                    send(v);
                  }
                }}
                disabled={busy}
                placeholder="Anything else? e.g. window seat, birthday…"
                rows={1}
                className="flex-1 resize-none rounded-2xl bg-[#1e1e1e] border border-[#262626] px-4 py-2.5 text-[14px] text-[#f4f4f5] outline-none transition focus:border-orange-500 placeholder:text-[#737373] disabled:opacity-40 max-h-[88px]"
              />
              <button
                onClick={() => { const v = input.trim(); if (!v || busy) return; setInput(""); send(v); }}
                disabled={busy || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 transition hover:bg-orange-600 disabled:opacity-40"
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 py-2 text-center text-[10px] text-[#737373]">
        Reservations by <span className="font-bold text-orange-500">Retilo</span>
      </div>
    </div>
  );
}
