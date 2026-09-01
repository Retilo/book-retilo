"use client";

/**
 * Tap-first dine-in booking page.
 *
 * Guests never have to type: party size, date, time and seating are all
 * tappable blocks. The taps compose one natural-language request for the
 * Swiggy booking agent; the agent's slot options and confirmation come back
 * as tappable chips too. A free-text input stays at the bottom as a fallback
 * for special requests ("window seat", "birthday").
 *
 * Fully brandable per restaurant via MerchantBrand (logo, banner, colors,
 * showPoweredBy) delivered on /config — no Retilo chrome unless enabled.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Send,
  Utensils,
  Check,
  Users,
  CalendarDays,
  Clock,
  Armchair,
  Pencil,
  Minus,
  Plus,
} from "lucide-react";
import { TextureButton } from "@/components/ui/texture-button";
import { TextureCard, TextureCardContent } from "@/components/ui/texture-card";
import { cn } from "@/lib/utils";

interface ZoneInfo {
  id: number;
  name: string;
  description: string | null;
  capacity: number | null;
  photos: { id: number; url: string; caption: string | null }[];
}

interface BrandInfo {
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  accentColor: string;
  bookingTheme: string;
  showPoweredBy: boolean;
  whatsappNumber: string | null;
}

interface DineinConfig {
  slug: string;
  displayName: string;
  address: string | null;
  stubMode: boolean;
  llm: string;
  zones?: ZoneInfo[];
  brand?: BrandInfo | null;
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

const TIME_GROUPS: { label: string; times: string[] }[] = [
  { label: "Lunch", times: ["12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM"] },
  { label: "Evening", times: ["5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM"] },
  { label: "Dinner", times: ["7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM"] },
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

// Tappable pill used for guests / dates / times. Selected state is painted
// with the merchant's brand color via the --primary CSS var.
function Chip({
  selected,
  onClick,
  children,
  className,
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
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm transition-all duration-150 select-none",
        selected
          ? "text-white font-semibold border-transparent shadow-lg [background:var(--primary)] [box-shadow:0_4px_16px_color-mix(in_srgb,var(--primary)_35%,transparent)]"
          : "border-white/12 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] active:scale-95",
        className
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-medium mb-2.5">
      <Icon size={13} className="[color:var(--primary)]" />
      {children}
    </div>
  );
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
  const brand = config.brand;
  const zones = config.zones ?? [];
  const showPoweredBy = brand ? brand.showPoweredBy : true;
  const days = useMemo(() => nextDays(7), []);

  // ── composer state (tap-only) ──────────────────────────────────────────────
  const [guests, setGuests] = useState<number | null>(2);
  const [dateIdx, setDateIdx] = useState<number | null>(0);
  const [time, setTime] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [view, setView] = useState<"compose" | "chat">("compose");

  // ── conversation state ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Msg[]>([]);
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

  const canSubmit = guests !== null && dateIdx !== null && time !== null;

  const submitComposer = useCallback(() => {
    if (!canSubmit || busy) return;
    const day = days[dateIdx!];
    const zone = zones.find((z) => z.id === zoneId);
    const msg =
      `Table for ${guests} ${day.long} (${day.iso}) at ${time}.` +
      (zone ? ` We'd prefer the ${zone.name} seating.` : "");
    setView("chat");
    send(msg);
  }, [canSubmit, busy, days, dateIdx, zones, zoneId, guests, time, send]);

  const summary = useMemo(() => {
    if (dateIdx === null) return "";
    const zone = zones.find((z) => z.id === zoneId);
    return [
      `${guests} guest${guests === 1 ? "" : "s"}`,
      days[dateIdx].chip,
      time,
      zone?.name,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [guests, dateIdx, time, zoneId, days, zones]);

  return (
    <div
      className="min-h-screen bg-[#0e0f12] text-zinc-100 flex flex-col items-center"
      style={
        {
          "--primary": brand?.primaryColor || "#f97316",
          "--accent": brand?.accentColor || "#f59e0b",
        } as React.CSSProperties
      }
    >
      {/* banner */}
      {brand?.bannerUrl && (
        <div className="w-full h-40 sm:h-52 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.bannerUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f12] via-[#0e0f12]/40 to-transparent" />
        </div>
      )}

      {/* header */}
      <header className={cn("w-full max-w-2xl px-5 pb-4", brand?.bannerUrl ? "-mt-10 relative z-10" : "pt-8")}>
        <div className="flex items-center gap-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={config.displayName}
              className="h-14 w-14 rounded-2xl object-cover border border-white/15 shadow-xl bg-[#16181d]"
            />
          ) : (
            <div className="h-12 w-12 rounded-2xl border flex items-center justify-center [background:color-mix(in_srgb,var(--primary)_15%,transparent)] [border-color:color-mix(in_srgb,var(--primary)_35%,transparent)]">
              <Utensils size={20} className="[color:var(--primary)]" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{config.displayName}</h1>
            {brand?.tagline ? (
              <p className="text-sm text-zinc-400">{brand.tagline}</p>
            ) : config.address ? (
              <p className="text-sm text-zinc-400">{config.address}</p>
            ) : null}
          </div>
        </div>
        {brand?.tagline && config.address && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <MapPin size={12} /> {config.address}
          </p>
        )}
      </header>

      <main className="w-full max-w-2xl flex-1 px-5 pb-6 flex flex-col gap-4">
        {/* ── tap-first composer ─────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {view === "compose" && (
            <motion.div
              key="composer"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, overflow: "hidden" }}
              transition={{ duration: 0.22 }}
            >
              <TextureCard>
                <TextureCardContent className="flex flex-col gap-5 py-5">
                  {/* guests */}
                  <div>
                    <SectionLabel icon={Users}>How many of you?</SectionLabel>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <Chip key={n} selected={guests === n} onClick={() => setGuests(n)} className="min-w-[46px] justify-center">
                          {n}
                        </Chip>
                      ))}
                      <Chip selected={guests !== null && guests > 6} onClick={() => setGuests(7)}>
                        7+
                      </Chip>
                      {guests !== null && guests > 6 && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            aria-label="Fewer guests"
                            onClick={() => setGuests((g) => Math.max(7, (g ?? 7) - 1))}
                            className="h-8 w-8 rounded-full border border-white/12 flex items-center justify-center text-zinc-300 active:scale-90"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{guests}</span>
                          <button
                            type="button"
                            aria-label="More guests"
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
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1">
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
                    <div className="flex flex-col gap-2.5">
                      {TIME_GROUPS.map((g) => (
                        <div key={g.label} className="flex items-center gap-2">
                          <span className="w-14 shrink-0 text-[11px] text-zinc-500">{g.label}</span>
                          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
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

                  {/* seating zones — photo carousel, tap to pick */}
                  {zones.length > 0 && (
                    <div>
                      <SectionLabel icon={Armchair}>Where would you like to sit?</SectionLabel>
                      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1 snap-x">
                        {zones.map((z) => {
                          const photo = z.photos[0]?.url;
                          const selected = zoneId === z.id;
                          return (
                            <button
                              key={z.id}
                              type="button"
                              onClick={() => setZoneId(selected ? null : z.id)}
                              className={cn(
                                "relative shrink-0 w-36 rounded-2xl overflow-hidden border text-left snap-start transition-all duration-150 active:scale-[0.97]",
                                selected
                                  ? "[border-color:var(--primary)] [box-shadow:0_0_0_2px_var(--primary),0_8px_24px_color-mix(in_srgb,var(--primary)_30%,transparent)]"
                                  : "border-white/10 hover:border-white/25"
                              )}
                            >
                              {photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={photo} alt={z.name} className="h-24 w-full object-cover" />
                              ) : (
                                <div className="h-24 w-full bg-white/[0.05] flex items-center justify-center">
                                  <Armchair size={22} className="text-zinc-600" />
                                </div>
                              )}
                              <div className="p-2.5 bg-white/[0.04]">
                                <div className="text-[13px] font-medium text-zinc-100 flex items-center gap-1.5">
                                  {z.name}
                                  {selected && <Check size={13} className="[color:var(--primary)]" />}
                                </div>
                                {z.capacity && (
                                  <div className="text-[11px] text-zinc-500">up to {z.capacity} guests</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <TextureButton variant="brand" size="lg" onClick={submitComposer} disabled={!canSubmit || busy}>
                    {canSubmit ? `Find my table — ${summary}` : "Pick a time to continue"}
                  </TextureButton>
                </TextureCardContent>
              </TextureCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── conversation ───────────────────────────────────────────────── */}
        {view === "chat" && (
          <>
            {/* summary pill — tap to edit re-opens the composer */}
            <button
              type="button"
              onClick={() => setView("compose")}
              className="self-start inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.08]"
            >
              <span className="font-medium">{summary}</span>
              <Pencil size={13} className="text-zinc-500" />
            </button>

            <div
              ref={scroller}
              className="flex-1 min-h-[320px] max-h-[56vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#16181d] p-4 flex flex-col gap-3"
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
                      <div className="rounded-2xl border p-4 bg-gradient-to-br from-[#1d2530] to-[#16181d] [border-color:color-mix(in_srgb,var(--primary)_45%,transparent)]">
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
                            ? "rounded-2xl rounded-br-md text-white font-medium px-4 py-2.5 whitespace-pre-wrap [background:var(--primary)]"
                            : "rounded-2xl rounded-bl-md bg-[#1d2026] border border-zinc-800 px-4 py-2.5 whitespace-pre-wrap text-sm"
                        }
                      >
                        {m.kind === "bot" ? formatInline(m.text) : m.text}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {busy && (
                <div className="self-start text-xs text-zinc-500 pl-1 animate-pulse">
                  Checking availability…
                </div>
              )}

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
                      className="rounded-full border px-3 py-1.5 text-xs transition-colors [border-color:color-mix(in_srgb,var(--primary)_60%,transparent)] [color:color-mix(in_srgb,var(--primary)_75%,white)] hover:[background:color-mix(in_srgb,var(--primary)_12%,transparent)]"
                    >
                      {o.displayTime} · {o.dateStr.slice(5)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* free-text fallback for special requests */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = input.trim();
                if (!v) return;
                setInput("");
                send(v);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Anything else? e.g. window seat, birthday cake…"
                className="flex-1 rounded-xl bg-[#16181d] border border-zinc-800 outline-none px-4 py-3 text-sm placeholder:text-zinc-600 focus:[border-color:var(--primary)]"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl text-white px-4 disabled:opacity-50 [background:var(--primary)]"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </main>

      <footer className="pb-6 text-xs text-zinc-600 flex items-center gap-1.5">
        {showPoweredBy && <>Reservations by Retilo · </>}
        Powered by <span className="text-orange-400 font-medium">Swiggy</span>
      </footer>
    </div>
  );
}
