// Vendored from Cult UI Pro (pro.cult-ui.com) — texture-card.
// Adapted for book-retilo's dark-only theme (no `dark:` variant plumbing).
import * as React from "react";

import { cn } from "@/lib/utils";

const TextureCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[24px] border border-stone-950/60",
      "bg-gradient-to-b from-neutral-800 to-neutral-900",
      className
    )}
    {...props}
  >
    {/* Nested structure for aesthetic borders */}
    <div className="rounded-[23px] border border-neutral-900/80">
      <div className="rounded-[22px] border border-neutral-950">
        <div className="rounded-[21px] border border-neutral-900/70">
          <div className="w-full border border-neutral-700/50 rounded-[20px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  </div>
));
TextureCard.displayName = "TextureCard";

const TextureCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("first:pt-6 last:pb-6 px-6", className)}
    {...props}
  />
));
TextureCardHeader.displayName = "TextureCardHeader";

const TextureCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 py-4", className)} {...props} />
));
TextureCardContent.displayName = "TextureCardContent";

export { TextureCard, TextureCardHeader, TextureCardContent };
