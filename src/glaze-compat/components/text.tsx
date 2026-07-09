import * as React from "react";
import { Slot } from "radix-ui";
import { type VariantProps } from "class-variance-authority";

import { cn } from "../utils";
import { textVariants } from "./text-variants";

export interface TextProps extends Omit<React.ComponentProps<"span">, "color">, VariantProps<typeof textVariants> {
  /** Render as a different semantic element (`p`, `h1`–`h4`, `label`, …) instead of a `span`. */
  as?: keyof React.JSX.IntrinsicElements;
  /** Compose with an existing element or primitive instead of rendering one (takes precedence over `as`). */
  asChild?: boolean;
}

/**
 * The canonical way to render text. Prefer a variant + semantic color over
 * raw font-size/weight/color utilities.
 */
function Text({ className, variant, color, align, truncate, as, asChild, ...props }: TextProps) {
  const Comp: React.ElementType = asChild ? Slot.Root : (as ?? "span");
  return (
    <Comp data-slot="text" className={cn(textVariants({ variant, color, align, truncate }), className)} {...props} />
  );
}

export { Text };
