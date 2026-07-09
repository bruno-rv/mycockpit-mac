import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

function KeyGroup({ children, className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd className={cn("inline-flex items-center gap-0.5", className)} {...props}>
      {children}
    </kbd>
  );
}

const keyVariants = cva(
  "pointer-events-none px-1 w-fit min-w-4 rounded h-4 inline-flex items-center justify-center font-mono text-small-mono leading-4",
  {
    variants: {
      variant: {
        outline:
          "border border-secondary text-tertiary group-focus:text-accent-contrast/70 group-focus:border-accent-contrast/30",
        filled: "bg-control text-primary",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

type KeyProps = React.ComponentProps<"kbd"> & VariantProps<typeof keyVariants>;

function Key({ children, className, variant, ...props }: KeyProps) {
  return (
    <kbd className={cn(keyVariants({ variant }), className)} {...props}>
      {children === "↵" ? <span className="-translate-y-px">{children}</span> : children}
    </kbd>
  );
}

export { Key, KeyGroup };
