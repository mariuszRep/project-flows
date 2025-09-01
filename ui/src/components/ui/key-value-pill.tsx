import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const keyValuePillVariants = cva(
  // Neutral, theme-aware pill that fits shadcn styles
  "inline-flex items-center rounded-[var(--radius-l)] overflow-hidden border border-emerald-500/70 dark:border-emerald-400/70 shadow-sm transition-all",
  {
    variants: {
      variant: {
        default: "",
        outline: "border-2",
        subtle: "",
      },
      size: {
        default: "text-xs",
        sm: "text-[11px]",
        lg: "text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface KeyValuePillProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof keyValuePillVariants> {
  keyName: string;
  value: string;
}

function KeyValuePill({ 
  className, 
  variant, 
  size, 
  keyName, 
  value, 
  ...props 
}: KeyValuePillProps) {
  return (
    <div 
      className={cn(keyValuePillVariants({ variant, size }), className)} 
      aria-label={`${keyName}: ${value}`}
      {...props}
    >
      <span className="bg-muted text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.3">
        {keyName}
      </span>
      <span className="bg-emerald-500/70 dark:bg-emerald-400/70 text-white dark:text-emerald-950 font-semibold px-2 py-0.3 whitespace-nowrap">
        {value}
      </span>
    </div>
  )
}

export { KeyValuePill, keyValuePillVariants }