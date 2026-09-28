"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Upload, Check, X, ArrowRight, Loader2 } from "lucide-react";

interface SwiggyRestaurant {
  restaurantId: string;
  name: string;
  locality: string;
}

interface Props {
  apiBase: string;
}

export function DemoSetupClient({ apiBase }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [swiggyQuery, setSwiggyQuery] = useState("");
  const [swiggyResults, setSwiggyResults] = useState<SwiggyRestaurant[]>([]);
  const [searchingSwiggy, setSearchingSwiggy] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<SwiggyRestaurant | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoFile(file: File) {
    // local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${apiBase}/v1/public/demo/upload-logo`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setLogoUrl(data.url);
    } catch {
      // keep local preview even if S3 fails
    } finally {
      setUploadingLogo(false);
    }
  }

  async function searchSwiggy() {
    const q = swiggyQuery.trim();
    if (!q || q.length < 2) return;
    setSearchingSwiggy(true);
    setShowResults(true);
    try {
      const res = await fetch(`${apiBase}/v1/public/demo/swiggy-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSwiggyResults(data.restaurants ?? []);
    } catch {
      setSwiggyResults([]);
    } finally {
      setSearchingSwiggy(false);
    }
  }

  async function setup() {
    if (uploadingLogo) { setError("Logo is still uploading, please wait…"); return; }
    if (!name.trim() || name.trim().length < 2) { setError("Please enter your restaurant name."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/v1/public/demo/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantName: name.trim(),
          logoUrl: logoUrl ?? undefined,
          swiggyRestaurantId: selectedRestaurant?.restaurantId ?? undefined,
          swiggyRestaurantName: selectedRestaurant?.name ?? undefined,
        }),
      });
      const data = await res.json();
      if (data.slug) {
        router.push(`/demo/chat/${data.slug}`);
      } else {
        throw new Error(data.message || "Setup failed");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const displayName = name.trim() || "Your Restaurant";

  return (
    <div className="flex min-h-dvh items-start justify-center gap-12 bg-[#09090f] px-4 py-12 font-[Inter,system-ui,sans-serif] text-[#f4f4f5]">

      {/* ── Form Panel ── */}
      <div className="w-full max-w-[420px] shrink-0">

        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-orange-500 text-base">🍽</div>
          <span className="text-lg font-extrabold tracking-tight">
            re<span className="text-orange-500">tilo</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold leading-tight">See it live for your restaurant</h1>
        <p className="mt-2 mb-7 text-sm text-[#737373] leading-relaxed">
          Set up in 30 seconds — no login needed. Your customers will experience this exact flow.
        </p>

        {/* Restaurant name */}
        <div className="mb-5">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[#737373]">
            Restaurant name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setup()}
            placeholder="e.g. Spice Garden"
            maxLength={80}
            className="w-full rounded-xl bg-[#141414] border border-[#262626] px-3.5 py-3 text-[15px] text-[#f4f4f5] outline-none transition focus:border-orange-500 placeholder:text-[#737373]"
          />
        </div>

        {/* Logo upload */}
        <div className="mb-5">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[#737373]">
            Logo
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-[#262626] p-3.5 transition hover:border-orange-500"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e1e1e] overflow-hidden text-lg">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-full w-full object-cover" />
              ) : "🍽"}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#f4f4f5]">
                <Upload className="h-3.5 w-3.5" />
                {logoPreview ? "Change logo" : "Upload your logo"}
                {uploadingLogo && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />}
              </div>
              <div className="mt-0.5 text-xs text-[#737373]">PNG, JPG, WebP · max 5 MB</div>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])} />
        </div>

        {/* Swiggy restaurant search */}
        <div className="mb-6">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[#737373]">
            Find your restaurant on Swiggy <span className="normal-case text-[10px] font-normal">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              value={swiggyQuery}
              onChange={(e) => setSwiggyQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchSwiggy()}
              placeholder="Search by restaurant name…"
              maxLength={80}
              className="flex-1 rounded-xl bg-[#141414] border border-[#262626] px-3.5 py-3 text-[15px] text-[#f4f4f5] outline-none transition focus:border-orange-500 placeholder:text-[#737373]"
            />
            <button
              onClick={searchSwiggy}
              disabled={searchingSwiggy}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#262626] bg-[#141414] px-4 py-3 text-sm font-semibold transition hover:border-orange-500 disabled:opacity-50"
            >
              {searchingSwiggy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>

          {/* Results dropdown */}
          {showResults && (
            <div className="mt-2 overflow-hidden rounded-xl border border-[#262626] bg-[#141414]">
              {searchingSwiggy ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-[#737373]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching Swiggy…
                </div>
              ) : swiggyResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[#737373]">No restaurants found. Try a different name.</div>
              ) : (
                swiggyResults.map((r) => (
                  <button
                    key={r.restaurantId}
                    onClick={() => { setSelectedRestaurant(r); setShowResults(false); }}
                    className={`flex w-full items-center gap-3 border-b border-[#1e1e1e] px-4 py-3 text-left last:border-0 transition hover:bg-[#1e1e1e] ${selectedRestaurant?.restaurantId === r.restaurantId ? "bg-[#0a1f0a]" : ""}`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{r.name}</div>
                      {r.locality && <div className="text-xs text-[#737373]">{r.locality}</div>}
                    </div>
                    {selectedRestaurant?.restaurantId === r.restaurantId && (
                      <Check className="h-4 w-4 text-green-400 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected tag */}
          {selectedRestaurant && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-800 bg-[#0a1f0a] px-3 py-2">
              <Check className="h-4 w-4 shrink-0 text-green-400" />
              <span className="flex-1 text-sm font-semibold text-green-400">{selectedRestaurant.name}</span>
              <button onClick={() => setSelectedRestaurant(null)} className="text-[#737373] hover:text-[#f4f4f5]">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <p className="mt-2 text-[11px] text-[#737373]">
            If matched, your agent books real tables via Swiggy Dineout — live availability, real reservations.
          </p>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={setup}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3.5 text-base font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Setting up…</>
          ) : (
            <>Create my demo <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
        <p className="mt-4 text-center text-[11px] text-[#737373]">
          Powered by <span className="text-[#f4f4f5] font-semibold">Retilo</span> · AI for restaurants
        </p>
      </div>

      {/* ── Preview Panel ── */}
      <div className="sticky top-12 hidden w-[280px] shrink-0 flex-col gap-2.5 lg:flex">
        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-[#737373]">Live preview</p>
        <div className="flex flex-col overflow-hidden rounded-[28px] border border-[#262626] bg-[#141414] shadow-2xl" style={{ height: 480 }}>
          {/* demo tag */}
          <div className="shrink-0 bg-orange-500 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-white">
            LIVE DEMO — Retilo AI
          </div>
          {/* header */}
          <div className="flex shrink-0 items-center gap-2.5 border-b border-[#262626] px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#1e1e1e] text-base">
              {logoPreview ? <img src={logoPreview} alt="" className="h-full w-full object-cover" /> : "🍽"}
            </div>
            <div>
              <div className="text-[13px] font-bold">{displayName}</div>
              <div className="text-[10px] text-[#737373]">AI-powered reservations</div>
            </div>
          </div>
          {/* messages */}
          <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
            <div className="max-w-[85%] self-start rounded-xl rounded-bl-sm bg-[#1e1e1e] px-2.5 py-2 text-[12px] leading-relaxed">
              Hi! I can help you book a table at <strong>{displayName}</strong>. What date and time works for you?
            </div>
            <div className="max-w-[85%] self-end rounded-xl rounded-br-sm bg-orange-500 px-2.5 py-2 text-[12px] leading-relaxed text-white">
              Table for 2, tomorrow at 7 PM
            </div>
            <div className="max-w-[85%] self-start rounded-xl rounded-bl-sm bg-[#1e1e1e] px-2.5 py-2 text-[12px] leading-relaxed">
              {selectedRestaurant
                ? `Checking availability at ${selectedRestaurant.name} for tomorrow evening…`
                : "Sure! Let me check what's available. Could I get your name and phone to confirm?"}
            </div>
          </div>
          {/* input */}
          <div className="flex shrink-0 items-center gap-1.5 border-t border-[#262626] p-2">
            <div className="flex-1 rounded-2xl bg-[#1e1e1e] px-3 py-1.5 text-[11px] text-[#737373]">
              Type a message…
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500">
              <ArrowRight className="h-3 w-3 text-white" />
            </div>
          </div>
          <div className="shrink-0 py-1.5 text-center text-[9px] text-[#737373]">
            Reservations by <span className="font-bold text-orange-500">Retilo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
