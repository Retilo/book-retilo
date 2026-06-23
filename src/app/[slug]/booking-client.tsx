"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { getSlots, submitBooking, formatDisplayTime, formatIST } from "@/lib/api";
import type { MerchantBrand, Offering, BookingResult } from "@/lib/api";

// ── Date helpers ─────────────────────────────────────────────────────────────

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

function formatDateLabel(iso: string): { day: string; date: string } {
  const d = new Date(iso + "T00:00:00");
  return {
    day: d.toLocaleDateString("en-IN", { weekday: "short" }),
    date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  };
}

// ── Step type ─────────────────────────────────────────────────────────────────

type Step = "service" | "datetime" | "details" | "success";

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  slug: string;
  brand: MerchantBrand;
  offerings: Offering[];
}

export function BookingClient({ slug, brand, offerings }: Props) {
  const primary = brand.primaryColor || "#7C3AED";
  const accent = brand.accentColor || "#F59E0B";

  const [step, setStep] = useState<Step>("service");
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);

  const dates = getNext14Days();

  const pickOffering = useCallback((o: Offering) => {
    setSelectedOffering(o);
    setStep("datetime");
    setSelectedDate("");
    setSlots([]);
    setSelectedTime("");
  }, []);

  const pickDate = useCallback(
    async (date: string) => {
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
    },
    [slug, selectedOffering]
  );

  const pickTime = useCallback((t: string) => {
    setSelectedTime(t);
  }, []);

  const goToDetails = useCallback(() => {
    if (!selectedDate || !selectedTime) return;
    setStep("details");
    setError(null);
  }, [selectedDate, selectedTime]);

  const submitForm = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedOffering || !selectedDate || !selectedTime) return;
      if (!name.trim() || !phone.trim()) return;
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
    },
    [slug, selectedOffering, selectedDate, selectedTime, name, phone, note]
  );

  return (
    <div
      className="min-h-screen"
      style={
        {
          "--primary": primary,
          "--accent": accent,
          background: "linear-gradient(135deg, #09090b 0%, #0f0520 100%)",
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <header className="px-4 pt-8 pb-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          {brand.logoUrl && (
            <Image
              src={brand.logoUrl}
              alt={brand.displayName}
              width={44}
              height={44}
              className="rounded-xl object-cover"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">{brand.displayName}</h1>
            {brand.tagline && <p className="text-xs text-zinc-400">{brand.tagline}</p>}
          </div>
        </div>
        {brand.address && (
          <p className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
            <span>📍</span> {brand.address}
          </p>
        )}
      </header>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pb-6">
        {(["service", "datetime", "details"] as Step[]).map((s, i) => (
          <div
            key={s}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: step === s ? 24 : 8,
              background:
                step === s || (step === "success" && i < 3)
                  ? primary
                  : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>

      {/* Step content */}
      <main className="px-4 max-w-lg mx-auto pb-16">
        <AnimatePresence mode="wait">
          {step === "service" && (
            <motion.div
              key="service"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-sm text-zinc-400 mb-4">{brand.bookingPrompt}</p>
              <div className="space-y-3">
                {offerings.length === 0 && (
                  <p className="text-zinc-500 text-sm text-center py-8">No services available right now.</p>
                )}
                {offerings.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => pickOffering(o)}
                    className="glass gradient-border w-full text-left px-5 py-4 transition-all duration-200 hover:bg-white/[0.07] active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">{o.name}</p>
                        {o.description && (
                          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{o.description}</p>
                        )}
                        <p className="text-xs text-zinc-500 mt-1">
                          ⏱ {o.duration_mins} min
                          {o.category ? ` · ${o.category}` : ""}
                        </p>
                      </div>
                      {o.price != null && (
                        <span className="text-sm font-semibold" style={{ color: accent }}>
                          ₹{o.price}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "datetime" && selectedOffering && (
            <motion.div
              key="datetime"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={() => setStep("service")}
                className="text-xs text-zinc-400 mb-4 flex items-center gap-1"
              >
                ← Back
              </button>
              <div className="glass p-4 mb-5 rounded-2xl">
                <p className="text-xs text-zinc-400">Selected service</p>
                <p className="font-medium text-white">{selectedOffering.name}</p>
                <p className="text-xs text-zinc-400">⏱ {selectedOffering.duration_mins} min</p>
              </div>

              {/* Date picker */}
              <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">Choose a date</p>
              <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                {dates.map((d) => {
                  const { day, date } = formatDateLabel(d);
                  const active = selectedDate === d;
                  return (
                    <button
                      key={d}
                      onClick={() => pickDate(d)}
                      className="flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-150"
                      style={{
                        background: active ? primary : "rgba(255,255,255,0.05)",
                        border: `1px solid ${active ? primary : "rgba(255,255,255,0.08)"}`,
                        minWidth: 60,
                      }}
                    >
                      <span className="text-[10px] text-zinc-400">{day}</span>
                      <span className="text-sm font-semibold text-white">{date}</span>
                    </button>
                  );
                })}
              </div>

              {/* Slot picker */}
              {selectedDate && (
                <div className="mt-5">
                  <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">Choose a time</p>
                  {slotsLoading && (
                    <div className="flex justify-center py-6">
                      <div
                        className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: `${primary} transparent ${primary} ${primary}` }}
                      />
                    </div>
                  )}
                  {!slotsLoading && slots.length === 0 && (
                    <p className="text-zinc-500 text-sm text-center py-4">No slots available on this date.</p>
                  )}
                  {!slotsLoading && slots.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((t) => {
                        const active = selectedTime === t;
                        return (
                          <button
                            key={t}
                            onClick={() => pickTime(t)}
                            className="py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                            style={{
                              background: active ? primary : "rgba(255,255,255,0.05)",
                              border: `1px solid ${active ? primary : "rgba(255,255,255,0.08)"}`,
                              color: "white",
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

              {selectedTime && (
                <button
                  onClick={goToDetails}
                  className="mt-6 w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-150 active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                >
                  Continue →
                </button>
              )}
            </motion.div>
          )}

          {step === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={() => setStep("datetime")}
                className="text-xs text-zinc-400 mb-4 flex items-center gap-1"
              >
                ← Back
              </button>

              {/* Booking summary */}
              <div className="glass p-4 mb-5 rounded-2xl space-y-1">
                <p className="font-medium text-white">{selectedOffering?.name}</p>
                <p className="text-xs text-zinc-400">
                  📅 {formatDateLabel(selectedDate).date} · {selectedTime && formatDisplayTime(selectedTime)}
                </p>
                {selectedOffering?.price != null && (
                  <p className="text-xs" style={{ color: accent }}>
                    ₹{selectedOffering.price}
                  </p>
                )}
              </div>

              <form onSubmit={submitForm} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">Your name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rahul Sharma"
                    required
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">WhatsApp number *</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    type="tel"
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">Any notes (optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. first visit, specific request..."
                    rows={2}
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition text-sm resize-none"
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !name || !phone}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                >
                  {submitting ? "Booking..." : "Confirm Booking"}
                </button>
              </form>
            </motion.div>
          )}

          {step === "success" && result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="text-center py-8"
            >
              <div
                className="h-16 w-16 rounded-full mx-auto mb-5 flex items-center justify-center text-3xl"
                style={{ background: `${primary}22`, border: `2px solid ${primary}44` }}
              >
                ✓
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Booking Confirmed!</h2>
              <p className="text-zinc-400 text-sm mb-1">{selectedOffering?.name}</p>
              <p className="text-zinc-300 text-sm font-medium mb-6">{formatIST(result.startsAt)}</p>

              <div className="glass p-5 rounded-2xl text-left mb-6">
                <p className="text-sm text-zinc-300">{result.confirmationMessage}</p>
              </div>

              {result.whatsappNumber && (
                <a
                  href={`https://wa.me/${result.whatsappNumber.replace(/[^0-9]/g, "")}?text=Hi! I just booked an appointment. My booking ID is ${result.appointmentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white text-sm transition-all duration-150 active:scale-[0.98]"
                  style={{ background: "#25D366" }}
                >
                  💬 Message on WhatsApp
                </a>
              )}

              <button
                onClick={() => {
                  setStep("service");
                  setSelectedOffering(null);
                  setSelectedDate("");
                  setSlots([]);
                  setSelectedTime("");
                  setName("");
                  setPhone("");
                  setNote("");
                  setResult(null);
                }}
                className="mt-4 block w-full py-2 text-zinc-500 text-sm"
              >
                Book another appointment
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Powered by Retilo */}
      {brand.showPoweredBy && step !== "success" && (
        <div className="text-center pb-8">
          <p className="text-xs text-zinc-600">
            Powered by{" "}
            <a href="https://retilo.io" className="text-zinc-500 hover:text-zinc-400 transition">
              Retilo
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
