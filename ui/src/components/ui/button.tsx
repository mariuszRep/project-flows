import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "shared-ui items-center inline-flex justify-center rounded-[var(--radius-l)]",
  {
    variants: {
      variant: {
        primary: "bg-transparent text-foreground hover:bg-border",
        secondary: "bg-surface text-foreground border-[1px] border-border hover:bg-border",
        default: "bg-transparent text-foreground hover:bg-border",
        ghost: "text-foreground hover:bg-surface hover:text-foreground",
        outline: "bg-surface text-foreground border-[1px] border-border hover:bg-border",
        link: "bg-transparent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 ",
        sm: "text-sm",
        lg: "text-lg",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
