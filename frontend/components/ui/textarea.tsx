import * as React from "react"

import { cn } from "@/lib/utils"

/** Same treatment as Input: 16px text and a navy/35 border on phones, shadcn from `md:` up. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full border border-foreground/35 bg-transparent px-3.5 py-3 text-base leading-[1.5] placeholder:text-foreground/45 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[60px] md:border-input md:px-3 md:py-2 md:text-sm md:placeholder:text-muted-foreground",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
