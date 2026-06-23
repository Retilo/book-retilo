import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book an appointment",
  description: "Book your appointment online — powered by Retilo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
