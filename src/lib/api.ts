const API = process.env.NEXT_PUBLIC_API_URL || "https://api.retilo.io";

export interface MerchantBrand {
  slug: string;
  displayName: string;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  accentColor: string;
  businessType: string;
  bookingPrompt: string;
  confirmationMessage: string;
  whatsappNumber: string | null;
  address: string | null;
  showPoweredBy: boolean;
}

export interface Offering {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration_mins: number;
  category: string | null;
  image_url: string | null;
}

export interface BookingResult {
  appointmentId: string;
  merchantName: string;
  whatsappNumber: string | null;
  confirmationMessage: string;
  startsAt: string;
  durationMins: number;
}

export async function getBrand(slug: string): Promise<MerchantBrand | null> {
  const res = await fetch(`${API}/v1/public/brand/${slug}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getOfferings(slug: string): Promise<Offering[]> {
  const res = await fetch(`${API}/v1/public/brand/${slug}/offerings`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.offerings || [];
}

export async function getSlots(slug: string, offeringId: string, date: string): Promise<string[]> {
  const params = new URLSearchParams({ offeringId, date });
  const res = await fetch(`${API}/v1/public/brand/${slug}/slots?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.slots || [];
}

export async function submitBooking(
  slug: string,
  body: {
    offeringId: string;
    date: string;
    time: string;
    customerName: string;
    customerPhone: string;
    note?: string;
  }
): Promise<BookingResult> {
  const res = await fetch(`${API}/v1/public/brand/${slug}/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Booking failed. Please try again.");
  }
  return res.json();
}

export function formatIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDisplayTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}
