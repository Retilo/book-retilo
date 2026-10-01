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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FloorPlanPicker = dynamic(() => import("./floor-plan-picker"), { ssr: false }) as React.ComponentType<any>;
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
  quickReplies?: string[];
}

interface TableInfo {
  id: number;
  zoneId: number | null;
  label: string;
  capacity: number;
  x: number;
  y: number;
  shape: string;
  isAvailable: boolean;
}

interface CanvasZone {
  id: string; x: number; y: number; w: number; h: number; color: string; name: string;
}
interface CanvasTable {
  id: string; x: number; y: number; shape: string; r?: number; w?: number; h?: number;
  label: string; capacity: number; available: boolean;
}
interface CanvasData {
  zones: CanvasZone[];
  tables: CanvasTable[];
}

interface FloorPlan {
  floorPlanUrl: string | null;
  tables: TableInfo[];
  canvas?: CanvasData | null;
}

interface DineinConfig {
  slug: string;
  displayName: string;
  address: string | null;
  stubMode: boolean;
  swiggyRestaurantId?: string | null;
  llm: string;
  zones?: ZoneInfo[];
  floorPlan?: FloorPlan | null;
  brand?: BrandInfo | null;
}

interface SlotOption {
  slotId: number;
  itemId?: string;
  restaurantId?: string;
  dateStr: string;
  displayTime: string;
  slotGroupName: string;
  dealTitle: string;
  isFree?: boolean;
  bookingPrice?: number;
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
  const floorPlan = config.floorPlan ?? null;
  const canvasData = floorPlan?.canvas ?? null;
  const availableTables = (canvasData?.tables ?? floorPlan?.tables ?? []).filter((t) =>
    "available" in t ? t.available : (t as TableInfo).isAvailable
  );
  const showPoweredBy = brand ? brand.showPoweredBy : true;
  const days = useMemo(() => nextDays(7), []);
  const searchParams = useSearchParams();

  // ── Customer Swiggy session ────────────────────────────────────────────────
  const SESSION_KEY = `swiggy_csid_${slug}`;
  const [csid, setCsid] = useState<string | null>(null);
  const [connectingSwiggy, setConnectingSwiggy] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("csid");
    const fromStorage = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
    const resolved = fromUrl || fromStorage || null;
    if (resolved) {
      setCsid(resolved);
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SESSION_KEY, resolved);
      // strip csid from URL cleanly
      if (fromUrl) {
        const url = new URL(window.location.href);
        url.searchParams.delete("csid");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, [searchParams, SESSION_KEY]);

  async function connectSwiggy() {
    setConnectingSwiggy(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000, maximumAge: 60000 })
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch { /* location denied — proceed without */ }

      const url = `${apiBase}/v1/public/dinein/swiggy-connect?slug=${encodeURIComponent(slug)}`
        + (lat != null ? `&lat=${lat}&lng=${lng}` : "");
      const data = await fetch(url).then(r => r.json());
      if (data.authorizeUrl) window.location.href = data.authorizeUrl;
    } catch {
      setConnectingSwiggy(false);
    }
  }

  // ── composer state (tap-only) ──────────────────────────────────────────────
  const [guests, setGuests] = useState<number | null>(2);
  const [dateIdx, setDateIdx] = useState<number | null>(0);
  const [time, setTime] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [view, setView] = useState<"compose" | "chat">("compose");

  // ── conversation state ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [slotOptions, setSlotOptions] = useState<SlotOption[]>([]);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
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
          body: JSON.stringify({ sessionId: sessionId.current, ...(csid ? { csid } : {}), ...body }),
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
    [apiBase, slug, csid, handleResult]
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
      setMessages((m) => [...m, { kind: "user", text: decision === "yes" ? "Yes, book it ✅" : "No, change it" }]);
      setNeedsConfirmation(false);
      void post({
        decision,
        customerName:  custName.trim()  || null,
        customerPhone: custPhone.trim() || null,
      }, "confirm");
    },
    [post, custName, custPhone]
  );

  const canSubmit = guests !== null && dateIdx !== null && time !== null;

  const submitComposer = useCallback(() => {
    if (!canSubmit || busy) return;
    const day = days[dateIdx!];
    const zone = zones.find((z) => z.id === zoneId);
    const table = (availableTables as Array<{id: string|number; label: string; capacity: number}>).find((t) => String(t.id) === String(tableId));
    const locationPart = table
      ? ` I want ${table.label} (seats ${table.capacity}).`
      : zone
      ? ` We'd prefer the ${zone.name} seating.`
      : "";
    const msg = `Table for ${guests} ${day.long} (${day.iso}) at ${time}.${locationPart}`;
    setView("chat");
    send(msg);
  }, [canSubmit, busy, days, dateIdx, zones, zoneId, tableId, availableTables, guests, time, send]);

  const summary = useMemo(() => {
    if (dateIdx === null) return "";
    const zone = zones.find((z) => z.id === zoneId);
    const table = (availableTables as Array<{id: string|number; label: string; capacity: number}>).find((t) => String(t.id) === String(tableId));
    return [
      `${guests} guest${guests === 1 ? "" : "s"}`,
      days[dateIdx].chip,
      time,
      table?.label ?? zone?.name,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [guests, dateIdx, time, zoneId, tableId, days, zones, availableTables]);

  // Show Swiggy connect gate until customer authenticates
  if (!csid) {
    const gateVibePhoto = zones.find(z => z.photos.length > 0)?.photos[0]?.url ?? brand?.bannerUrl ?? null;
    return (
      <div
        className="min-h-screen bg-[#0e0f12] text-zinc-100 flex flex-col items-center justify-center px-6"
        style={{ "--primary": brand?.primaryColor || "#f97316" } as React.CSSProperties}
      >
        {/* ambient bg photo — subtle behind blur */}
        {gateVibePhoto && (
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gateVibePhoto} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-20" />
            <div className="absolute inset-0 bg-[#0e0f12]/70" />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-xs">
          {/* logo on white card — same treatment Swiggy uses */}
          <div className="rounded-[20px] bg-white p-3 shadow-2xl">
            {brand?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={config.displayName}
                className="h-20 w-20 rounded-xl object-contain"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl flex items-center justify-center text-4xl bg-zinc-100">
                🍽
              </div>
            )}
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">{config.displayName}</h1>
            <p className="mt-1 text-sm text-zinc-400">Reserve a table instantly</p>
          </div>

          <p className="text-center text-sm text-zinc-500 leading-relaxed">
            Connect your Swiggy account to check real-time availability and confirm your reservation in seconds.
          </p>

          <button
            onClick={connectSwiggy}
            disabled={connectingSwiggy}
            className="flex items-center gap-3 rounded-2xl px-7 py-4 text-base font-bold text-white transition hover:brightness-110 disabled:opacity-60 w-full justify-center shadow-lg"
            style={{ background: "#fc8019" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brands/swiggy.webp" alt="" className="h-5 w-auto brightness-0 invert" />
            {connectingSwiggy ? "Redirecting…" : "Continue with Swiggy"}
          </button>

          <p className="text-[11px] text-zinc-600">Your Swiggy account is used only to place this booking</p>
        </div>
      </div>
    );
  }

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
      {/* cinematic hero — zone photo collage if available, otherwise brand banner */}
      {(() => {
        const vibePhotos = zones.flatMap(z =>
          z.photos.slice(0, 2).map(p => ({ ...p, zoneName: z.name, zoneId: z.id }))
        );
        if (vibePhotos.length >= 1) {
          return (
            <div className="w-full relative">
              {/* full-bleed horizontal film strip */}
              <div className="w-full h-44 sm:h-56 overflow-hidden flex">
                {vibePhotos.slice(0, 4).map((photo, i) => (
                  <div
                    key={photo.id}
                    className="relative shrink-0 overflow-hidden"
                    style={{ width: i === 0 ? "55%" : `${45 / Math.min(vibePhotos.length - 1, 3)}%` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.zoneName} className="h-full w-full object-cover" />
                    {/* thin separator lines between panels */}
                    {i > 0 && <div className="absolute inset-y-0 left-0 w-[2px] bg-[#0e0f12]" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                    <span className="absolute bottom-2.5 left-3 text-[11px] font-semibold text-white/90 tracking-wide">
                      {photo.zoneName}
                    </span>
                  </div>
                ))}
              </div>
              {/* fade to page bg */}
              <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#0e0f12] to-transparent pointer-events-none" />
            </div>
          );
        }
        if (brand?.bannerUrl) {
          return (
            <div className="w-full h-40 sm:h-52 relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.bannerUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f12] via-[#0e0f12]/40 to-transparent" />
            </div>
          );
        }
        return null;
      })()}

      {/* header */}
      <header className={cn(
        "w-full max-w-2xl px-5 pb-4",
        zones.flatMap(z => z.photos).length >= 1 || brand?.bannerUrl ? "-mt-10 relative z-10" : "pt-8"
      )}>
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

                  {/* seat picker — Konva floor plan (canvas) or zone cards */}
                  {canvasData && canvasData.tables.length > 0 ? (
                    <div>
                      <SectionLabel icon={Armchair}>Pick your exact table</SectionLabel>
                      <FloorPlanPicker
                        canvas={canvasData}
                        selectedTableId={tableId}
                        onSelect={(id: string | null) => setTableId(id)}
                        primaryColor={brand?.primaryColor ?? "#a855f7"}
                      />
                      {tableId && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                          <Check size={13} className="[color:var(--primary)]" />
                          <span>
                            {(availableTables as CanvasTable[]).find((t) => t.id === tableId)?.label} selected ·{" "}
                            {(availableTables as CanvasTable[]).find((t) => t.id === tableId)?.capacity} guests
                          </span>
                          <button
                            type="button"
                            onClick={() => setTableId(null)}
                            className="ml-auto text-zinc-600 hover:text-zinc-400 text-[11px]"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  ) : zones.length > 0 ? (
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
                  ) : null}

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
                          Powered by{" "}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/brands/swiggy.webp" alt="Swiggy" className="h-4 w-auto" />
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

              {/* confirmation + customer details */}
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
                    className="w-full rounded-xl bg-[#0e0f12] border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:[border-color:var(--primary)]"
                  />
                  <input
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="Phone number"
                    type="tel"
                    autoComplete="tel"
                    className="w-full rounded-xl bg-[#0e0f12] border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:[border-color:var(--primary)]"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => decide("yes")}
                      disabled={custName.trim().length < 2}
                      className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-40 [background:var(--primary)] hover:brightness-110 disabled:cursor-default"
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

              {/* slot options — deal cards when time is fixed, time pills when choosing */}
              {!needsConfirmation && slotOptions.length > 0 && !busy && (() => {
                const uniqueDates = [...new Set(slotOptions.map(o => o.dateStr))];
                const uniqueTimes = [...new Set(slotOptions.map(o => o.displayTime))];
                // Deal picker mode: same date (time decided) → show deal cards
                const isDealPicker = uniqueDates.length === 1 && uniqueTimes.length <= 3;

                if (isDealPicker) {
                  // Deduplicate by dealTitle — show each deal type once
                  const seen = new Set<string>();
                  const deals = slotOptions.filter(o => {
                    const key = o.dealTitle + (o.isFree ? "free" : "paid");
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return (
                    <div className="self-start w-full flex flex-col gap-2.5 mt-1">
                      {deals.map((o, i) => {
                        const isBest = !o.isFree && i > 0;
                        return (
                          <button
                            key={`${o.dealTitle}-${i}`}
                            onClick={() => {
                              const dealPart = o.isFree
                                ? "the free reservation (no prebook fee)"
                                : `the "${o.dealTitle}" deal (₹${o.bookingPrice ?? 10} prebook)`;
                              send(`Book me ${dealPart} for ${o.displayTime} on ${o.dateStr}.`);
                            }}
                            className={cn(
                              "relative w-full max-w-xs text-left rounded-2xl border px-4 py-3.5 transition-all active:scale-[0.98] hover:brightness-110",
                              o.isFree
                                ? "border-white/12 bg-white/[0.04]"
                                : "bg-gradient-to-br from-[#1d2128] to-[#16181d] [border-color:color-mix(in_srgb,var(--primary)_50%,transparent)]"
                            )}
                          >
                            {isBest && (
                              <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full [background:var(--primary)] text-white">
                                Best value
                              </span>
                            )}
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className={cn("text-sm font-semibold", o.isFree ? "text-zinc-200" : "[color:var(--primary)]")}>
                                  {o.dealTitle}
                                </div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                  {o.isFree
                                    ? "No booking fee · Pay at restaurant"
                                    : `₹${o.bookingPrice ?? 10} prebook · Save on your bill`}
                                </div>
                              </div>
                              <div className={cn(
                                "shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl mt-0.5",
                                o.isFree
                                  ? "bg-white/[0.06] text-zinc-300"
                                  : "[background:color-mix(in_srgb,var(--primary)_18%,transparent)] [color:var(--primary)]"
                              )}>
                                {o.isFree ? "Free" : `₹${o.bookingPrice ?? 10}`}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                // Time picker mode: multiple dates → show time pills
                return (
                  <div className="self-start flex flex-wrap gap-2">
                    {slotOptions.slice(0, 8).map((o, i) => (
                      <button
                        key={i}
                        onClick={() => send(`I'll take the ${o.displayTime} slot on ${o.dateStr}. Book that one.`)}
                        className="rounded-full border px-3 py-1.5 text-xs transition-colors [border-color:color-mix(in_srgb,var(--primary)_60%,transparent)] [color:color-mix(in_srgb,var(--primary)_75%,white)] hover:[background:color-mix(in_srgb,var(--primary)_12%,transparent)]"
                      >
                        {o.displayTime} · {o.dateStr.slice(5)}
                        {o.isFree === false && <span className="ml-1.5 opacity-50">· deal</span>}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Sticky merchant-configured quick replies — always visible */}
            {(brand?.quickReplies ?? []).filter(r => r.trim()).length > 0 && !busy && (
              <div className="flex flex-wrap gap-2 pb-1">
                {(brand?.quickReplies ?? []).filter(r => r.trim()).map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => send(reply)}
                    className="rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95 hover:brightness-110"
                    style={{
                      background: "color-mix(in_srgb,var(--primary)_10%,transparent)",
                      borderColor: "color-mix(in_srgb,var(--primary)_35%,transparent)",
                      color: "color-mix(in_srgb,var(--primary)_90%,white)",
                    }}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

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
        Powered by{" "}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/swiggy.webp" alt="Swiggy" className="h-4 w-auto opacity-90" />
      </footer>
    </div>
  );
}
