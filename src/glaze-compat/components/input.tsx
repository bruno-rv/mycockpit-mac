import * as React from "react";

import { cn } from "../utils";
import { cva, VariantProps } from "class-variance-authority";

const inputVariants = cva(
  cn(
    "text-regular file:text-primary placeholder:text-placeholder selection:bg-selection-40 selection:text-primary flex w-full min-w-0 py-1 transition-[color,border-color,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "select-text",
    "aria-invalid:ring-support-red/20 aria-invalid:border-support-red/40",
  ),
  {
    variants: {
      variant: {
        // Bordered, transparent fill — the standalone form-field look.
        default: "border border-field bg-transparent focus-visible:border-foreground-40",
        // Filled chrome that matches `SegmentedControl` filled / Xcode inspector fields.
        // Use when stacking inputs alongside segmented controls in a dense panel.
        filled: "border border-transparent bg-control-subtle focus-visible:bg-control",
      },
      // Radius is size-proportional — small (inspector) controls get a subtle
      // rounded-square; medium/large keep the roomier `rounded-control`. Matches
      // Apple's pattern where a 28px field has ~8px corners and larger fields have 12px+.
      size: {
        small: "h-7 px-2 rounded-lg",
        medium: "h-8 px-3 rounded-control",
        large: "h-9 px-3 rounded-control",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "medium",
    },
  },
);
function Input({
  className,
  type,
  size,
  variant,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>) {
  return <input type={type} data-slot="input" className={cn(inputVariants({ variant, size }), className)} {...props} />;
}

export { Input };
