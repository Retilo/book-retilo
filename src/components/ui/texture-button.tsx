"use client";

// Vendored from Cult UI Pro (pro.cult-ui.com) — texture-button.
// Adapted: dark-only styling, no Radix Slot (book-retilo doesn't need asChild),
// added a `brand` variant driven by the merchant's --primary CSS var.
import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariantsOuter = cva("", {
  variants: {
    variant: {
      primary:
        "w-full border-[2px] border-black bg-gradient-to-b from-white to-white/80 p-[1px] transition duration-300 ease-in-out",
      brand:
        "w-full border-[2px] border-black/60 p-[1px] transition duration-300 ease-in-out [background:linear-gradient(to_bottom,color-mix(in_srgb,var(--primary)_80%,white),var(--primary))]",
      secondary:
        "w-full border-[2px] border-neutral-950 bg-neutral-600/50 p-[1px] transition duration-300 ease-in-out",
      minimal:
        "group/texture-button w-full border-[2px] border-neutral-950 bg-neutral-600/80 p-[1px] active:bg-neutral-800 hover:bg-gradient-to-t hover:from-neutral-600/50 hover:to-neutral-600/70",
    },
    size: {
      sm: "rounded-[6px]",
      default: "rounded-[12px]",
      lg: "rounded-[12px]",
    },
  },
  defaultVariants: { variant: "primary", size: "default" },
});

const innerDivVariants = cva("w-full h-full flex items-center justify-center", {
  variants: {
    variant: {
      primary:
        "gap-2 bg-gradient-to-b from-neutral-200 to-neutral-50 text-sm text-black/80 transition duration-300 ease-in-out hover:from-stone-200 hover:to-neutral-200 active:from-stone-300 active:to-neutral-300",
      brand:
        "gap-2 text-sm font-semibold text-white transition duration-300 ease-in-out [background:linear-gradient(to_bottom,color-mix(in_srgb,var(--primary)_88%,white),color-mix(in_srgb,var(--primary)_82%,black))] hover:brightness-110 active:brightness-95",
      secondary:
        "bg-gradient-to-b from-neutral-800 to-neutral-700/50 text-sm text-neutral-200 transition duration-300 ease-in-out hover:from-neutral-700 hover:to-neutral-700/60 active:from-neutral-800 active:to-neutral-700",
      minimal:
        "bg-gradient-to-b from-neutral-800 to-neutral-700/50 text-sm text-neutral-200 transition duration-300 ease-in-out group-hover/texture-button:from-neutral-700 group-hover/texture-button:to-neutral-700/60 group-active/texture-button:from-neutral-800 group-active/texture-button:to-neutral-700",
    },
    size: {
      sm: "text-xs rounded-[4px] px-4 py-1",
      default: "text-sm rounded-[10px] px-4 py-2",
      lg: "text-base rounded-[10px] px-4 py-3",
    },
  },
  defaultVariants: { variant: "primary", size: "default" },
});

export interface TextureButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "brand" | "secondary" | "minimal";
  size?: "default" | "sm" | "lg";
}

const TextureButton = React.forwardRef<HTMLButtonElement, TextureButtonProps>(
  ({ children, variant = "primary", size = "default", className, ...props }, ref) => (
    <button
      className={cn(buttonVariantsOuter({ variant, size }), className)}
      ref={ref}
      {...props}
    >
      <div className={cn(innerDivVariants({ variant, size }))}>{children}</div>
    </button>
  )
);
TextureButton.displayName = "TextureButton";

export { TextureButton };
