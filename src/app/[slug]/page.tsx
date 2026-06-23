import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrand, getOfferings } from "@/lib/api";
import { BookingClient } from "./booking-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) return { title: "Booking — Retilo" };
  return {
    title: `Book with ${brand.displayName}`,
    description: brand.tagline || `Book an appointment with ${brand.displayName}`,
    openGraph: {
      title: `Book with ${brand.displayName}`,
      description: brand.tagline || `Book an appointment with ${brand.displayName}`,
      images: brand.bannerUrl ? [brand.bannerUrl] : [],
    },
  };
}

export default async function BookingPage({ params }: Props) {
  const { slug } = await params;
  const [brand, offerings] = await Promise.all([getBrand(slug), getOfferings(slug)]);

  if (!brand) notFound();

  return (
    <BookingClient
      slug={slug}
      brand={brand}
      offerings={offerings}
    />
  );
}
