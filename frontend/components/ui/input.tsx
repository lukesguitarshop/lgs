import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 48px tall with 16px text on phones — 16px is what stops iOS zooming the page on
 * focus — and the original 36px / 14px from `md:` up. The border is navy at 35% on
 * phones so a field reads as a field against cream; desktop keeps the shadcn `input`
 * token. Flat: no shadow.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full border border-foreground/35 bg-transparent px-3.5 py-1 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-foreground/45 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:border-input md:px-3 md:text-sm md:placeholder:text-muted-foreground",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
