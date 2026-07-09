import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils";

const statusVariants = cva(
  "text-small-strong bg-control bg-glass inline-flex items-center justify-center rounded-pill border border-tertiary px-2 py-0.5 w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden",
  {
    // `variant` selects which status dot renders below; the container styling is shared.
    variants: {
      variant: {
        neutral: "",
        loading: "",
        error: "",
        warning: "",
        success: "",
      },
    },
    defaultVariants: {
      variant: "loading",
    },
  },
);

function Status({
  className,
  variant,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusVariants> & { asChild?: boolean }) {
  const Comp = (asChild ? Slot.Slot : "span") as React.ElementType;

  return (
    <Comp data-slot="status" className={cn(statusVariants({ variant }), className)} {...props}>
      {variant === "success" && <div className="w-2.5 h-2.5 rounded-full bg-support-green mr-0.5" />}
      {variant === "error" && <div className="w-2.5 h-2.5 rounded-full bg-support-red mr-0.5" />}
      {variant === "warning" && <div className="w-2.5 h-2.5 rounded-full bg-support-orange mr-0.5" />}
      {variant === "loading" && (
        <div className="w-2.5 h-2.5 rounded-full bg-foreground-40 dark:bg-foreground-20 mr-0.5 animate-pulse" />
      )}
      {variant === "neutral" && <div className="w-2.5 h-2.5 rounded-full bg-foreground-20 mr-0.5" />}
      {children}
    </Comp>
  );
}

export { Status };
