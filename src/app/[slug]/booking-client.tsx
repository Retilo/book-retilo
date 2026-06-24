"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Clock, ChevronLeft, Check, MessageCircle,
  Stethoscope, Scissors, Dumbbell, Utensils, Sparkles, Calendar,
} from "lucide-react";
import { getSlots, submitBooking, formatDisplayTime, formatIST } from "@/lib/api";
import type { MerchantBrand, Offering, BookingResult } from "@/lib/api";

// ── helpers ───────────────────────────────────────────────────────────────────

function getNext14Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function formatDateLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
    day: d.toLocaleDateString("en-IN", { day: "numeric" }),
    month: d.toLocaleDateString("en-IN", { month: "short" }),
  };
}

function categoryIcon(cat: string | null) {
  const c = (cat || "").toLowerCase();
  if (c.includes("consult") || c.includes("clinic") || c.includes("doctor")) return <Stethoscope size={18} />;
  if (c.includes("hair") || c.includes("salon") || c.includes("beauty")) return <Scissors size={18} />;
  if (c.includes("fitness") || c.includes("gym") || c.includes("train")) return <Dumbbell size={18} />;
  if (c.includes("table") || c.includes("restaurant") || c.includes("dining")) return <Utensils size={18} />;
  if (c.includes("spa") || c.includes("massage") || c.includes("wellness")) return <Sparkles size={18} />;
  return <Calendar size={18} />;
}

// ── theme tokens ──────────────────────────────────────────────────────────────

type Tk = ReturnType<typeof themeTokens>;

function themeTokens(theme: "dark" | "light") {
  if (theme === "light") return {
    pageBg:         "radial-gradient(ellipse at 20% 0%, #ede9fe 0%, #f4f4ff 60%)",
    sidebarBg:      "#ffffff",
    sidebarBorder:  "rgba(0,0,0,0.06)",
    stepsBg:        "#f8f8ff",
    cardBg:         "#ffffff",
    cardBorder:     "rgba(0,0,0,0.09)",
    cardHoverBg:    "#f5f3ff",
    cardHoverBorder:"rgba(109,40,217,0.35)",
    inputBg:        "#ffffff",
    inputBorder:    "rgba(0,0,0,0.12)",
    inputFocusBorder:"var(--primary)",
    textPrimary:    "#111118",
    textSub:        "#4b5563",
    textMuted:      "#9ca3af",
    progressTrack:  "rgba(0,0,0,0.10)",
    dateBg:         "#ffffff",
    dateBorder:     "rgba(0,0,0,0.10)",
    dateText:       "#374151",
    dateSubText:    "#9ca3af",
    slotBg:         "#ffffff",
    slotBorder:     "rgba(0,0,0,0.10)",
    slotText:       "#6b7280",
    summaryBg:      "#f5f3ff",
    summaryBorder:  "rgba(109,40,217,0.18)",
    successCardBg:  "#ffffff",
    successCardBorder:"rgba(0,0,0,0.08)",
    poweredByColor: "#9ca3af",
    poweredByHover: "#6b7280",
    divider:        "rgba(0,0,0,0.07)",
    confirmBg:      "rgba(109,40,217,0.08)",
    confirmText:    "#4b5563",
  } as const;
  return {
    pageBg:         "radial-gradient(ellipse at 20% 0%, #1a0a3a 0%, #0a0a0f 55%)",
    sidebarBg:      "#0f0f1c",
    sidebarBorder:  "rgba(255,255,255,0.06)",
    stepsBg:        "#0a0a0f",
    cardBg:         "#141421",
    cardBorder:     "rgba(255,255,255,0.07)",
    cardHoverBg:    "#1a1a2e",
    cardHoverBorder:"rgba(255,255,255,0.14)",
    inputBg:        "#0f0f1a",
    inputBorder:    "rgba(255,255,255,0.10)",
    inputFocusBorder:"var(--primary)",
    textPrimary:    "#f4f4f5",
    textSub:        "#a1a1aa",
    textMuted:      "#52525b",
    progressTrack:  "rgba(255,255,255,0.10)",
    dateBg:         "#141421",
    dateBorder:     "rgba(255,255,255,0.08)",
    dateText:       "#ffffff",
    dateSubText:    "#3f3f46",
    slotBg:         "#141421",
    slotBorder:     "rgba(255,255,255,0.08)",
    slotText:       "#71717a",
    summaryBg:      undefined,
    summaryBorder:  undefined,
    successCardBg:  "#141421",
    successCardBorder:"rgba(255,255,255,0.07)",
    poweredByColor: "#27272a",
    poweredByHover: "#52525b",
    divider:        "rgba(255,255,255,0.05)",
    confirmBg:      undefined,
    confirmText:    "#a1a1aa",
  } as const;
}

// ── types ─────────────────────────────────────────────────────────────────────

type Step = "service" | "datetime" | "details" | "success";

interface Props {
  slug: string;
  brand: MerchantBrand;
  offerings: Offering[];
}

const SLIDE = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2, ease: "easeOut" },
};

// ── sidebar business panel ────────────────────────────────────────────────────

function BusinessPanel({ brand, primary, accent, compact, tk }: {
  brand: MerchantBrand; primary: string; accent: string; compact?: boolean; tk: Tk;
}) {
  return (
    <div className={compact ? "" : "h-full flex flex-col"}>
      <div
        className={compact ? "rounded-2xl overflow-hidden mb-4" : "rounded-2xl overflow-hidden mb-5"}
        style={{ height: compact ? 100 : 150, position: "relative" }}
      >
        {brand.bannerUrl ? (
          <Image src={brand.bannerUrl} alt="" fill className="object-cover" priority />
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${primary}55 0%, ${accent}22 100%)` }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.45))" }} />
      </div>

      <div className="flex items-center gap-3 mb-2.5">
        {brand.logoUrl ? (
          <div
            className="flex-shrink-0 rounded-xl overflow-hidden shadow-lg"
            style={{ width: 50, height: 50, border: `2px solid ${tk.sidebarBorder}` }}
          >
            <Image src={brand.logoUrl} alt={brand.displayName} width={50} height={50} className="object-cover" />
          </div>
        ) : (
          <div
            className="flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg"
            style={{ width: 50, height: 50, background: `linear-gradient(135deg, ${primary}, ${accent})` }}
          >
            {brand.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-bold text-lg leading-snug" style={{ color: tk.textPrimary }}>{brand.displayName}</h1>
          {brand.tagline && <p className="text-xs mt-0.5" style={{ color: tk.textMuted }}>{brand.tagline}</p>}
        </div>
      </div>

      {brand.address && (
        <div className="flex items-start gap-1.5">
          <MapPin size={12} className="mt-0.5 flex-shrink-0" style={{ color: tk.textMuted }} />
          <p className="text-xs leading-relaxed" style={{ color: tk.textMuted }}>{brand.address}</p>
        </div>
      )}

      {!compact && (
        <div className="mt-auto pt-6">
          {brand.showPoweredBy && (
            <p className="text-xs" style={{ color: tk.poweredByColor }}>
              Powered by{" "}
              <a href="https://retilo.io" className="transition" style={{ color: tk.poweredByHover }}>Retilo</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, primary, tk }: { step: Step; primary: string; tk: Tk }) {
  const idx = { service: 0, datetime: 1, details: 2, success: 3 }[step];
  const labels = ["Choose service", "Pick date & time", "Your details"];
  return (
    <div className="mb-6">
      <div className="flex gap-1.5 mb-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= idx || step === "success" ? primary : tk.progressTrack }} />
        ))}
      </div>
      {step !== "success" && (
        <p className="text-xs" style={{ color: tk.textMuted }}>
          Step {idx + 1} of 3 —{" "}
          <span className="font-medium" style={{ color: tk.textSub }}>{labels[idx]}</span>
        </p>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function BookingClient({ slug, brand, offerings }: Props) {
  const primary = brand.primaryColor || "#7C3AED";
  const accent  = brand.accentColor  || "#F59E0B";
  const tk = themeTokens(brand.bookingTheme || "dark");

  const [step, setStep]                   = useState<Step>("service");
  const [selectedOffering, setOffering]   = useState<Offering | null>(null);
  const [selectedDate, setSelectedDate]   = useState("");
  const [slots, setSlots]                 = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading]   = useState(false);
  const [selectedTime, setSelectedTime]   = useState("");
  const [name, setName]                   = useState("");
  const [phone, setPhone]                 = useState("");
  const [note, setNote]                   = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [result, setResult]               = useState<BookingResult | null>(null);

  const dates = getNext14Days();

  const pickOffering = useCallback((o: Offering) => {
    setOffering(o); setSelectedDate(""); setSlots([]); setSelectedTime(""); setStep("datetime");
  }, []);

  const pickDate = useCallback(async (date: string) => {
    setSelectedDate(date); setSelectedTime(""); setSlotsLoading(true); setSlots([]);
    try { setSlots(await getSlots(slug, selectedOffering!.id, date)); }
    finally { setSlotsLoading(false); }
  }, [slug, selectedOffering]);

  const submitForm = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffering || !selectedDate || !selectedTime || !name.trim() || !phone.trim()) return;
    setSubmitting(true); setError(null);
    try {
      setResult(await submitBooking(slug, { offeringId: selectedOffering.id, date: selectedDate, time: selectedTime, customerName: name.trim(), customerPhone: phone.trim(), note: note.trim() || undefined }));
      setStep("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally { setSubmitting(false); }
  }, [slug, selectedOffering, selectedDate, selectedTime, name, phone, note]);

  const reset = () => { setStep("service"); setOffering(null); setSelectedDate(""); setSlots([]); setSelectedTime(""); setName(""); setPhone(""); setNote(""); setResult(null); };

  // input style shared across form fields
  const inputStyle: React.CSSProperties = { background: tk.inputBg, border: `1.5px solid ${tk.inputBorder}`, color: tk.textPrimary };

  return (
    <div className="min-h-screen" style={{ "--primary": primary, "--accent": accent, background: tk.pageBg } as React.CSSProperties}>
      <div className="min-h-screen flex items-start justify-center md:items-center md:p-6 lg:p-10">
        <div className="w-full md:max-w-3xl lg:max-w-4xl md:rounded-3xl md:overflow-hidden md:shadow-2xl flex flex-col md:flex-row">

          {/* Sidebar */}
          <div
            className="md:w-72 lg:w-80 flex-shrink-0 px-5 pt-8 pb-6 md:px-7 md:py-8 md:rounded-l-3xl md:min-h-[600px]"
            style={{ background: tk.sidebarBg, borderRight: `1px solid ${tk.sidebarBorder}` }}
          >
            <div className="hidden md:block h-full">
              <BusinessPanel brand={brand} primary={primary} accent={accent} tk={tk} />
            </div>
            <div className="md:hidden">
              <BusinessPanel brand={brand} primary={primary} accent={accent} compact tk={tk} />
            </div>
          </div>

          {/* Steps panel */}
          <div
            className="flex-1 px-5 pt-6 pb-10 md:px-8 md:py-8 md:rounded-r-3xl overflow-y-auto"
            style={{ background: tk.stepsBg, minHeight: 520 }}
          >
            {step !== "success" && <ProgressBar step={step} primary={primary} tk={tk} />}

            <AnimatePresence mode="wait">

              {/* SERVICE */}
              {step === "service" && (
                <motion.div key="service" {...SLIDE}>
                  {offerings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${primary}22` }}>
                        <Calendar size={24} style={{ color: primary }} />
                      </div>
                      <p className="font-medium" style={{ color: tk.textPrimary }}>No services listed yet</p>
                      <p className="text-xs mt-1" style={{ color: tk.textMuted }}>Please check back later or contact us directly.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {offerings.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => pickOffering(o)}
                          className="w-full text-left p-4 rounded-2xl transition-all duration-150 active:scale-[0.985]"
                          style={{ background: tk.cardBg, border: `1.5px solid ${tk.cardBorder}` }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = tk.cardHoverBorder; (e.currentTarget as HTMLButtonElement).style.background = tk.cardHoverBg; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = tk.cardBorder; (e.currentTarget as HTMLButtonElement).style.background = tk.cardBg; }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5" style={{ background: `${primary}22`, color: primary }}>
                              {categoryIcon(o.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-[15px]" style={{ color: tk.textPrimary }}>{o.name}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1 text-xs" style={{ color: tk.textMuted }}>
                                  <Clock size={11} /> {o.duration_mins} min
                                </span>
                                {o.category && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${primary}18`, color: primary }}>
                                    {o.category}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right pl-2">
                              {o.price != null && o.price > 0
                                ? <p className="text-base font-bold" style={{ color: accent }}>₹{o.price}</p>
                                : <p className="text-xs font-medium" style={{ color: tk.textMuted }}>Free</p>}
                              <p className="text-xs mt-1 font-medium" style={{ color: primary }}>Select →</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* DATETIME */}
              {step === "datetime" && selectedOffering && (
                <motion.div key="datetime" {...SLIDE}>
                  <button onClick={() => setStep("service")} className="flex items-center gap-1 text-xs mb-4 transition-colors hover:opacity-70" style={{ color: tk.textMuted }}>
                    <ChevronLeft size={14} /> Back
                  </button>

                  {/* Selected service pill */}
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl mb-6" style={{ background: tk.summaryBg ?? `${primary}14`, border: `1px solid ${tk.summaryBorder ?? `${primary}30`}` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}25`, color: primary }}>
                      {categoryIcon(selectedOffering.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: tk.textPrimary }}>{selectedOffering.name}</p>
                      <p className="text-xs" style={{ color: tk.textMuted }}>{selectedOffering.duration_mins} min</p>
                    </div>
                    {selectedOffering.price != null && selectedOffering.price > 0 && (
                      <p className="font-bold text-sm flex-shrink-0" style={{ color: accent }}>₹{selectedOffering.price}</p>
                    )}
                  </div>

                  {/* Date */}
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: tk.textMuted }}>Date</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {dates.map((d) => {
                      const { weekday, day, month } = formatDateLabel(d);
                      const active = selectedDate === d;
                      return (
                        <button key={d} onClick={() => pickDate(d)}
                          className="flex-shrink-0 flex flex-col items-center px-3.5 py-3 rounded-2xl transition-all duration-150"
                          style={{ minWidth: 58, background: active ? primary : tk.dateBg, border: `1.5px solid ${active ? primary : tk.dateBorder}` }}>
                          <span className="text-[10px] font-medium leading-none mb-1" style={{ color: active ? "rgba(255,255,255,0.65)" : tk.textMuted }}>{weekday}</span>
                          <span className="text-[17px] font-bold leading-none" style={{ color: active ? "#ffffff" : tk.dateText }}>{day}</span>
                          <span className="text-[10px] leading-none mt-1" style={{ color: active ? "rgba(255,255,255,0.55)" : tk.dateSubText }}>{month}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Time */}
                  {selectedDate && (
                    <div className="mt-6">
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: tk.textMuted }}>Time</p>
                      {slotsLoading && (
                        <div className="flex justify-center py-10">
                          <div className="h-6 w-6 rounded-full border-2 animate-spin" style={{ borderColor: `${primary} transparent ${primary} ${primary}` }} />
                        </div>
                      )}
                      {!slotsLoading && slots.length === 0 && (
                        <p className="text-sm text-center py-8" style={{ color: tk.textMuted }}>No slots available — try another day.</p>
                      )}
                      {!slotsLoading && slots.length > 0 && (
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                          {slots.map((t) => {
                            const active = selectedTime === t;
                            return (
                              <button key={t} onClick={() => setSelectedTime(t)}
                                className="py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                                style={{ background: active ? primary : tk.slotBg, border: `1.5px solid ${active ? primary : tk.slotBorder}`, color: active ? "white" : tk.slotText }}>
                                {formatDisplayTime(t)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedDate && selectedTime && (
                    <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      onClick={() => { setError(null); setStep("details"); }}
                      className="mt-8 w-full py-4 rounded-2xl font-semibold text-white transition-all active:scale-[0.98]"
                      style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                      Continue →
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* DETAILS */}
              {step === "details" && (
                <motion.div key="details" {...SLIDE}>
                  <button onClick={() => setStep("datetime")} className="flex items-center gap-1 text-xs mb-4 transition-colors hover:opacity-70" style={{ color: tk.textMuted }}>
                    <ChevronLeft size={14} /> Back
                  </button>

                  {/* Summary */}
                  <div className="p-4 rounded-2xl mb-6" style={{ background: tk.cardBg, border: `1px solid ${tk.cardBorder}` }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: tk.textMuted }}>Summary</p>
                    <p className="font-bold text-base" style={{ color: tk.textPrimary }}>{selectedOffering?.name}</p>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-sm" style={{ color: tk.textSub }}>
                        <Calendar size={13} style={{ color: primary }} />
                        {selectedDate && `${formatDateLabel(selectedDate).day} ${formatDateLabel(selectedDate).month}`}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm" style={{ color: tk.textSub }}>
                        <Clock size={13} style={{ color: primary }} />
                        {selectedTime && formatDisplayTime(selectedTime)}
                      </span>
                      {selectedOffering?.price != null && selectedOffering.price > 0 && (
                        <span className="text-sm font-bold" style={{ color: accent }}>₹{selectedOffering.price}</span>
                      )}
                    </div>
                  </div>

                  <form onSubmit={submitForm} className="space-y-4">
                    {([
                      { label: "Your name", value: name, setter: setName, placeholder: "e.g. Rahul Sharma", type: "text", autoComplete: "name" },
                      { label: "WhatsApp number", value: phone, setter: setPhone, placeholder: "+91 98765 43210", type: "tel", autoComplete: "tel" },
                    ] as const).map(({ label, value, setter, placeholder, type, autoComplete }) => (
                      <div key={label}>
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: tk.textMuted }}>{label}</label>
                        <input value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} required type={type} autoComplete={autoComplete} style={inputStyle} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: tk.textMuted }}>
                        Notes <span className="normal-case font-normal" style={{ color: tk.textMuted }}>optional</span>
                      </label>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. first visit, specific request..." rows={2} style={{ ...inputStyle, resize: "none" }} />
                    </div>

                    {error && (
                      <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
                    )}

                    <button type="submit" disabled={submitting || !name.trim() || !phone.trim()}
                      className="w-full py-4 rounded-2xl font-semibold text-white text-[15px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                      {submitting ? "Confirming..." : "Confirm Booking"}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* SUCCESS */}
              {step === "success" && result && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, type: "spring", bounce: 0.25 }}
                  className="flex flex-col items-center text-center pt-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-lg" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                    <Check size={36} strokeWidth={3} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold" style={{ color: tk.textPrimary }}>Booking Confirmed!</h2>
                  <p className="text-sm mt-1 mb-7" style={{ color: tk.textMuted }}>You&apos;re all set</p>

                  <div className="w-full rounded-2xl p-5 mb-5 text-left space-y-4" style={{ background: tk.successCardBg, border: `1px solid ${tk.successCardBorder}` }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: tk.textMuted }}>Service</p>
                        <p className="font-semibold" style={{ color: tk.textPrimary }}>{selectedOffering?.name}</p>
                      </div>
                      {selectedOffering?.price != null && selectedOffering.price > 0 && (
                        <span className="text-base font-bold" style={{ color: accent }}>₹{selectedOffering.price}</span>
                      )}
                    </div>
                    <div className="h-px" style={{ background: tk.divider }} />
                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: tk.textMuted }}>Date & Time</p>
                        <p className="text-sm font-medium" style={{ color: tk.textPrimary }}>{formatIST(result.startsAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: tk.textMuted }}>Duration</p>
                        <p className="text-sm font-medium" style={{ color: tk.textPrimary }}>{result.durationMins} min</p>
                      </div>
                    </div>
                    <div className="h-px" style={{ background: tk.divider }} />
                    <p className="text-sm rounded-xl px-4 py-3" style={{ background: tk.confirmBg ?? `${primary}14`, color: tk.confirmText }}>
                      {result.confirmationMessage}
                    </p>
                  </div>

                  {result.whatsappNumber && (
                    <a
                      href={`https://wa.me/${result.whatsappNumber.replace(/[^0-9]/g, "")}?text=Hi! I just booked an appointment. Booking ID: ${result.appointmentId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-white text-[15px] transition-all active:scale-[0.98] mb-3"
                      style={{ background: "#25D366" }}>
                      <MessageCircle size={18} /> Message on WhatsApp
                    </a>
                  )}

                  <button onClick={reset} className="w-full py-3 text-sm transition-colors" style={{ color: tk.textMuted }}>
                    Book another appointment
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile powered by */}
      {brand.showPoweredBy && step !== "success" && (
        <div className="md:hidden text-center py-4">
          <p className="text-xs" style={{ color: tk.poweredByColor }}>
            Powered by{" "}
            <a href="https://retilo.io" className="transition" style={{ color: tk.poweredByHover }}>Retilo</a>
          </p>
        </div>
      )}
    </div>
  );
}
