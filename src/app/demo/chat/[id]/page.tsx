import type { Metadata } from "next";
import { DemoChatClient } from "./demo-chat-client";

const API_SERVER = process.env.LOCAL_API_PROXY || process.env.NEXT_PUBLIC_API_URL || "https://api.retilo.io";
const API_BROWSER = process.env.LOCAL_API_PROXY ? "" : process.env.NEXT_PUBLIC_API_URL || "https://api.retilo.io";

interface Props {
  params: Promise<{ id: string }>;
}

interface DemoConfig {
  restaurantName: string;
  logoUrl: string | null;
  swiggyRestaurantId: string | null;
}

async function getDemoConfig(id: string): Promise<DemoConfig | null> {
  try {
    const res = await fetch(`${API_SERVER}/v1/public/demo/${id}/config`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cfg = await getDemoConfig(id);
  return {
    title: cfg ? `Demo — ${cfg.restaurantName}` : "Retilo Demo",
    description: "AI-powered restaurant booking — live demo",
  };
}

export default async function DemoChatPage({ params }: Props) {
  const { id } = await params;
  const cfg = await getDemoConfig(id);
  return <DemoChatClient id={id} config={cfg} apiBase={API_BROWSER} />;
}
