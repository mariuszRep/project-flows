import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const keyValuePillVariants = cva(
  // Neutral, theme-aware pill that fits shadcn styles
  "inline-flex items-center rounded-[var(--radius-l)] overflow-hidden border shadow-sm transition-all",
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
  /**
   * Primary color replaces muted text usages by default:
   * - border color
   * - key text color
   * - value background color
   * Provide any valid CSS color (e.g., `hsl(var(--gradient-from))`, `#fff`, `rgb(...)`).
   */
  primaryColor?: string;
  /**
   * Secondary color replaces card background usages by default:
   * - key background color
   * - value text color
   * Provide any valid CSS color (e.g., `hsl(var(--card))`).
   */
  secondaryColor?: string;
}

function KeyValuePill({ 
  className, 
  variant, 
  size, 
  keyName, 
  value, 
  primaryColor,
  secondaryColor,
  ...props 
}: KeyValuePillProps) {
  // Defaults aligned with Acceptance Criteria and entity card appearance:
  // - Border: muted-foreground
  // - Key background: surface (matches Card bg)
  // - Key text: muted-foreground (bold)
  // - Value background: muted-foreground
  // - Value text: surface
  const resolvedPrimary = primaryColor || "hsl(var(--muted-foreground))";
  const resolvedSecondary = secondaryColor || "hsl(var(--surface))";

  return (
    <div 
      className={cn(keyValuePillVariants({ variant, size }), className)} 
      style={{ borderColor: resolvedPrimary }}
      aria-label={`${keyName}: ${value}`}
      {...props}
    >
      <span 
        className="font-bold px-2 py-0.3"
        style={{ backgroundColor: resolvedSecondary, color: resolvedPrimary }}
      >
        {keyName}
      </span>
      <span 
        className="font-semibold px-2 py-0.3 whitespace-nowrap"
        style={{ backgroundColor: resolvedPrimary, color: resolvedSecondary }}
      >
        {value}
      </span>
    </div>
  )
}

export { KeyValuePill, keyValuePillVariants }
