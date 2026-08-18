import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-hairline bg-surface-2 px-4 py-2 text-base-regular text-fg transition-all duration-200 file:border-0 file:bg-transparent file:text-small-semibold file:text-brand placeholder:text-fg-subtle hover:border-hairline-strong focus-visible:border-transparent focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50",
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
