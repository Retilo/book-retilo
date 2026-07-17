/**
 * Dine-in table booking — the page a merchant's GBP "Book a table" Update
 * post links to. Books through the Swiggy Dineout MCP via the Retilo agent
 * (POST /v1/public/dinein/:slug/chat). GBP is the discovery surface; Swiggy
 * fulfils the reservation.
 */
import type { Metadata } from "next";
import { DineinClient } from "./dinein-client";

// Server-side fetches need an absolute URL; the browser uses NEXT_PUBLIC_API_URL,
// or same-origin ("") when LOCAL_API_PROXY rewrites /v1/* to the local backend.
const API_SERVER =
  process.env.LOCAL_API_PROXY || process.env.NEXT_PUBLIC_API_URL || "https://api.retilo.io";
const API_BROWSER = process.env.LOCAL_API_PROXY ? "" : process.env.NEXT_PUBLIC_API_URL || "https://api.retilo.io";

interface Props {
  params: Promise<{ slug: string }>;
}

interface DineinConfig {
  slug: string;
  displayName: string;
  address: string | null;
  stubMode: boolean;
  llm: string;
}

async function getConfig(slug: string): Promise<DineinConfig> {
  try {
    const res = await fetch(`${API_SERVER}/v1/public/dinein/${slug}/config`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data as DineinConfig;
    }
  } catch {
    /* fall through to placeholder so the page still renders */
  }
  return { slug, displayName: "Book a table", address: null, stubMode: true, llm: "" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cfg = await getConfig(slug);
  return {
    title: `Book a table — ${cfg.displayName}`,
    description: `Reserve a table at ${cfg.displayName} instantly. Powered by Swiggy.`,
  };
}

export default async function DineinPage({ params }: Props) {
  const { slug } = await params;
  const cfg = await getConfig(slug);
  return <DineinClient slug={slug} config={cfg} apiBase={API_BROWSER} />;
}
