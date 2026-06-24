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
  if (c.includes("consult") || c.includes("clinic") || c.includes("doctor"))
    return <Stethoscope size={18} />;
  if (c.includes("hair") || c.includes("salon") || c.includes("beauty"))
    return <Scissors size={18} />;
  if (c.includes("fitness") || c.includes("gym") || c.includes("train"))
    return <Dumbbell size={18} />;
  if (c.includes("table") || c.includes("restaurant") || c.includes("dining"))
    return <Utensils size={18} />;
  if (c.includes("spa") || c.includes("massage") || c.includes("wellness"))
    return <Sparkles size={18} />;
  return <Calendar size={18} />;
}

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

// ── Business info panel (used in sidebar on desktop, header on mobile) ────────

function BusinessPanel({
  brand, primary, accent, compact = false,
}: {
  brand: MerchantBrand;
  primary: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "h-full flex flex-col"}>
      {/* Banner */}
      <div
        className={compact ? "rounded-2xl overflow-hidden mb-4" : "rounded-2xl overflow-hidden mb-5"}
        style={{ height: compact ? 110 : 160, position: "relative" }}
      >
        {brand.bannerUrl ? (
          <Image src={brand.bannerUrl} alt="" fill className="object-cover" priority />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${primary}55 0%, ${accent}22 100%)` }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(10,10,20,0.1), rgba(10,10,20,0.6))" }}
        />
      </div>

      {/* Logo + name */}
      <div className="flex items-center gap-3 mb-3">
        {brand.logoUrl ? (
          <div
            className="flex-shrink-0 rounded-xl overflow-hidden shadow-lg"
            style={{ width: 52, height: 52, border: "2px solid rgba(255,255,255,0.08)" }}
          >
            <Image src={brand.logoUrl} alt={brand.displayName} width={52} height={52} className="object-cover" />
          </div>
        ) : (
          <div
            className="flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg"
            style={{
              width: 52, height: 52,
              background: `linear-gradient(135deg, ${primary}, ${accent})`,
            }}
          >
            {brand.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-bold text-white text-lg leading-snug">{brand.displayName}</h1>
          {brand.tagline && <p className="text-xs text-zinc-400 mt-0.5">{brand.tagline}</p>}
        </div>
      </div>

      {brand.address && (
        <div className="flex items-start gap-1.5">
          <MapPin size={12} className="text-zinc-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-zinc-500 leading-relaxed">{brand.address}</p>
        </div>
      )}

      {/* Spacer + footer for sidebar */}
      {!compact && (
        <div className="mt-auto pt-6">
          {brand.showPoweredBy && (
            <p className="text-xs text-zinc-700">
              Powered by{" "}
              <a href="https://retilo.io" className="text-zinc-600 hover:text-zinc-400 transition">
                Retilo
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, primary }: { step: Step; primary: string }) {
  const idx = { service: 0, datetime: 1, details: 2, success: 3 }[step];
  const labels = ["Choose service", "Pick date & time", "Your details"];
  return (
    <div className="mb-6">
      <div className="flex gap-1.5 mb-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < idx || (step === "success") ? primary : i === idx ? primary : "rgba(255,255,255,0.10)" }}
          />
        ))}
      </div>
      {step !== "success" && (
        <p className="text-xs text-zinc-500">
          Step {idx + 1} of 3 —{" "}
          <span className="text-zinc-300 font-medium">{labels[idx]}</span>
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingClient({ slug, brand, offerings }: Props) {
  const primary = brand.primaryColor || "#7C3AED";
  const accent = brand.accentColor || "#F59E0B";

  const [step, setStep] = useState<Step>("service");
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);

  const dates = getNext14Days();

  const pickOffering = useCallback((o: Offering) => {
    setSelectedOffering(o);
    setSelectedDate("");
    setSlots([]);
    setSelectedTime("");
    setStep("datetime");
  }, []);

  const pickDate = useCallback(async (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    setSlotsLoading(true);
    setSlots([]);
    try {
      const s = await getSlots(slug, selectedOffering!.id, date);
      setSlots(s);
    } finally {
      setSlotsLoading(false);
    }
  }, [slug, selectedOffering]);

  const submitForm = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffering || !selectedDate || !selectedTime || !name.trim() || !phone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitBooking(slug, {
        offeringId: selectedOffering.id,
        date: selectedDate,
        time: selectedTime,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        note: note.trim() || undefined,
      });
      setResult(res);
      setStep("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [slug, selectedOffering, selectedDate, selectedTime, name, phone, note]);

  const resetBooking = () => {
    setStep("service");
    setSelectedOffering(null);
    setSelectedDate("");
    setSlots([]);
    setSelectedTime("");
    setName("");
    setPhone("");
    setNote("");
    setResult(null);
  };

  return (
    <div
      className="min-h-screen"
      style={{
        "--primary": primary,
        "--accent": accent,
        background: "radial-gradient(ellipse at 20% 0%, #1a0a3a 0%, #0a0a0f 55%)",
      } as React.CSSProperties}
    >
      {/*
        ── Layout shell ─────────────────────────────────────────────────────────
        Mobile  : single column, stacked
        Desktop : centered two-column card (sidebar | booking steps)
      */}
      <div className="min-h-screen flex items-start justify-center md:items-center md:p-6 lg:p-10">
        <div
          className="w-full md:max-w-3xl lg:max-w-4xl md:rounded-3xl md:overflow-hidden md:shadow-2xl flex flex-col md:flex-row"
          style={{
            background: "transparent",
            // On desktop the card gets a dark background
          }}
        >
          {/* ── Left / top: business info ──────────────────────────────────── */}
          <div
            className="
              md:w-72 lg:w-80 flex-shrink-0
              px-5 pt-8 pb-6 md:px-7 md:py-8
              md:rounded-l-3xl md:min-h-[600px]
            "
            style={{ background: "#0f0f1c", borderRight: "1px solid rgba(255,255,255,0.06)" }}
          >
            {/* Mobile: compact, Desktop: full */}
            <div className="hidden md:block h-full">
              <BusinessPanel brand={brand} primary={primary} accent={accent} />
            </div>
            <div className="md:hidden">
              <BusinessPanel brand={brand} primary={primary} accent={accent} compact />
            </div>
          </div>

          {/* ── Right / bottom: booking steps ─────────────────────────────── */}
          <div
            className="flex-1 px-5 pt-6 pb-10 md:px-8 md:py-8 md:rounded-r-3xl overflow-y-auto"
            style={{ background: "#0a0a0f", minHeight: 520 }}
          >
            {step !== "success" && (
              <ProgressBar step={step} primary={primary} />
            )}

            <AnimatePresence mode="wait">

              {/* ── SERVICE ───────────────────────────────────────────────── */}
              {step === "service" && (
                <motion.div key="service" {...SLIDE}>
                  {offerings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: `${primary}22` }}
                      >
                        <Calendar size={24} style={{ color: primary }} />
                      </div>
                      <p className="text-zinc-300 font-medium">No services listed yet</p>
                      <p className="text-zinc-600 text-xs mt-1">Please check back later or contact us directly.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {offerings.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => pickOffering(o)}
                          className="w-full text-left p-4 rounded-2xl transition-all duration-150 active:scale-[0.985]"
                          style={{
                            background: "#141421",
                            border: "1.5px solid rgba(255,255,255,0.07)",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = `${primary}60`;
                            (e.currentTarget as HTMLButtonElement).style.background = "#1a1a2e";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)";
                            (e.currentTarget as HTMLButtonElement).style.background = "#141421";
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
                              style={{ background: `${primary}22`, color: primary }}
                            >
                              {categoryIcon(o.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-[15px]">{o.name}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1 text-xs text-zinc-500">
                                  <Clock size={11} /> {o.duration_mins} min
                                </span>
                                {o.category && (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: `${primary}18`, color: primary }}
                                  >
                                    {o.category}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right pl-2">
                              {o.price != null && o.price > 0 ? (
                                <p className="text-base font-bold" style={{ color: accent }}>₹{o.price}</p>
                              ) : (
                                <p className="text-xs text-zinc-500 font-medium">Free</p>
                              )}
                              <p className="text-xs mt-1 font-medium" style={{ color: primary }}>
                                Select →
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── DATETIME ──────────────────────────────────────────────── */}
              {step === "datetime" && selectedOffering && (
                <motion.div key="datetime" {...SLIDE}>
                  <button
                    onClick={() => setStep("service")}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>

                  {/* Selected service pill */}
                  <div
                    className="flex items-center gap-3 p-3.5 rounded-2xl mb-6"
                    style={{ background: `${primary}14`, border: `1px solid ${primary}30` }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${primary}25`, color: primary }}
                    >
                      {categoryIcon(selectedOffering.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{selectedOffering.name}</p>
                      <p className="text-xs text-zinc-400">{selectedOffering.duration_mins} min</p>
                    </div>
                    {selectedOffering.price != null && selectedOffering.price > 0 && (
                      <p className="font-bold text-sm flex-shrink-0" style={{ color: accent }}>
                        ₹{selectedOffering.price}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Date</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {dates.map((d) => {
                      const { weekday, day, month } = formatDateLabel(d);
                      const active = selectedDate === d;
                      return (
                        <button
                          key={d}
                          onClick={() => pickDate(d)}
                          className="flex-shrink-0 flex flex-col items-center px-3.5 py-3 rounded-2xl transition-all duration-150"
                          style={{
                            minWidth: 58,
                            background: active ? primary : "#141421",
                            border: `1.5px solid ${active ? primary : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          <span
                            className="text-[10px] font-medium leading-none mb-1"
                            style={{ color: active ? "rgba(255,255,255,0.65)" : "#52525b" }}
                          >
                            {weekday}
                          </span>
                          <span className="text-[17px] font-bold text-white leading-none">{day}</span>
                          <span
                            className="text-[10px] leading-none mt-1"
                            style={{ color: active ? "rgba(255,255,255,0.55)" : "#3f3f46" }}
                          >
                            {month}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Time */}
                  {selectedDate && (
                    <div className="mt-6">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Time</p>
                      {slotsLoading && (
                        <div className="flex justify-center py-10">
                          <div
                            className="h-6 w-6 rounded-full border-2 animate-spin"
                            style={{ borderColor: `${primary} transparent ${primary} ${primary}` }}
                          />
                        </div>
                      )}
                      {!slotsLoading && slots.length === 0 && (
                        <p className="text-zinc-500 text-sm text-center py-8">No slots available — try another day.</p>
                      )}
                      {!slotsLoading && slots.length > 0 && (
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                          {slots.map((t) => {
                            const active = selectedTime === t;
                            return (
                              <button
                                key={t}
                                onClick={() => setSelectedTime(t)}
                                className="py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                                style={{
                                  background: active ? primary : "#141421",
                                  border: `1.5px solid ${active ? primary : "rgba(255,255,255,0.08)"}`,
                                  color: active ? "white" : "#71717a",
                                }}
                              >
                                {formatDisplayTime(t)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedDate && selectedTime && (
                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => { setError(null); setStep("details"); }}
                      className="mt-8 w-full py-4 rounded-2xl font-semibold text-white transition-all active:scale-[0.98]"
                      style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                    >
                      Continue →
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* ── DETAILS ───────────────────────────────────────────────── */}
              {step === "details" && (
                <motion.div key="details" {...SLIDE}>
                  <button
                    onClick={() => setStep("datetime")}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>

                  {/* Summary */}
                  <div
                    className="p-4 rounded-2xl mb-6"
                    style={{ background: "#141421", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Summary</p>
                    <p className="text-white font-bold text-base">{selectedOffering?.name}</p>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-sm text-zinc-400">
                        <Calendar size={13} style={{ color: primary }} />
                        {selectedDate && `${formatDateLabel(selectedDate).day} ${formatDateLabel(selectedDate).month}`}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-zinc-400">
                        <Clock size={13} style={{ color: primary }} />
                        {selectedTime && formatDisplayTime(selectedTime)}
                      </span>
                      {selectedOffering?.price != null && selectedOffering.price > 0 && (
                        <span className="text-sm font-bold" style={{ color: accent }}>
                          ₹{selectedOffering.price}
                        </span>
                      )}
                    </div>
                  </div>

                  <form onSubmit={submitForm} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                        Your name
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        required
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                        WhatsApp number
                      </label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        required
                        type="tel"
                        autoComplete="tel"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                        Notes{" "}
                        <span className="text-zinc-600 normal-case font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. first visit, specific request..."
                        rows={2}
                        style={{ resize: "none" }}
                      />
                    </div>

                    {error && (
                      <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !name.trim() || !phone.trim()}
                      className="w-full py-4 rounded-2xl font-semibold text-white text-[15px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                    >
                      {submitting ? "Confirming..." : "Confirm Booking"}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ── SUCCESS ───────────────────────────────────────────────── */}
              {step === "success" && result && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, type: "spring", bounce: 0.25 }}
                  className="flex flex-col items-center text-center pt-4"
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-violet-900/30"
                    style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                  >
                    <Check size={36} strokeWidth={3} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Booking Confirmed!</h2>
                  <p className="text-zinc-500 text-sm mt-1 mb-7">You&apos;re all set</p>

                  <div
                    className="w-full rounded-2xl p-5 mb-5 text-left space-y-4"
                    style={{ background: "#141421", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1">Service</p>
                        <p className="text-white font-semibold">{selectedOffering?.name}</p>
                      </div>
                      {selectedOffering?.price != null && selectedOffering.price > 0 && (
                        <span className="text-base font-bold" style={{ color: accent }}>
                          ₹{selectedOffering.price}
                        </span>
                      )}
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1">Date & Time</p>
                        <p className="text-white text-sm font-medium">{formatIST(result.startsAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1">Duration</p>
                        <p className="text-white text-sm font-medium">{result.durationMins} min</p>
                      </div>
                    </div>
                    <div className="h-px bg-white/5" />
                    <p
                      className="text-sm rounded-xl px-4 py-3"
                      style={{ background: `${primary}14`, color: "#a1a1aa" }}
                    >
                      {result.confirmationMessage}
                    </p>
                  </div>

                  {result.whatsappNumber && (
                    <a
                      href={`https://wa.me/${result.whatsappNumber.replace(/[^0-9]/g, "")}?text=Hi! I just booked an appointment. Booking ID: ${result.appointmentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-white text-[15px] transition-all active:scale-[0.98] mb-3"
                      style={{ background: "#25D366" }}
                    >
                      <MessageCircle size={18} />
                      Message on WhatsApp
                    </a>
                  )}

                  <button
                    onClick={resetBooking}
                    className="w-full py-3 text-zinc-600 text-sm hover:text-zinc-400 transition-colors"
                  >
                    Book another appointment
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile-only powered by footer */}
      {brand.showPoweredBy && step !== "success" && (
        <div className="md:hidden text-center py-4">
          <p className="text-xs text-zinc-700">
            Powered by{" "}
            <a href="https://retilo.io" className="text-zinc-600 hover:text-zinc-400 transition">
              Retilo
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
