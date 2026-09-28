import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoSetupClient } from "./demo-setup-client";

export const metadata: Metadata = {
  title: "Try Retilo — Live Demo",
  description: "Set up your restaurant's AI booking agent in 30 seconds. No login needed.",
};

const API_BROWSER = process.env.LOCAL_API_PROXY
  ? ""
  : process.env.NEXT_PUBLIC_API_URL || "https://api.retilo.io";

export default function DemoPage() {
  return (
    <Suspense>
      <DemoSetupClient apiBase={API_BROWSER} />
    </Suspense>
  );
}
