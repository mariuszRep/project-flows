import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const keyValuePillVariants = cva(
  "inline-flex items-center rounded-full overflow-hidden shadow-md border border-slate-700/60 group transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/20",
  {
    variants: {
      variant: {
        default: "",
        outline: "border-2",
        subtle: "shadow-sm",
      },
      size: {
        default: "text-sm",
        sm: "text-xs",
        lg: "text-base",
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
      <span className="bg-slate-800/50 text-slate-300 font-medium px-4 py-2 transition-colors duration-300 group-hover:bg-slate-700/70">
        {keyName}
      </span>
      <span className="bg-slate-700 text-cyan-300 font-mono font-semibold px-4 py-2 whitespace-nowrap transition-colors duration-300 group-hover:bg-slate-600">
        {value}
      </span>
    </div>
  )
}

export { KeyValuePill, keyValuePillVariants }
