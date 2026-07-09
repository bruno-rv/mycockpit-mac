import * as React from "react";
import { Slot } from "radix-ui";
import { type VariantProps } from "class-variance-authority";

import { cn } from "../utils";
import { badgeColorClasses, badgeVariants, type BadgeColor } from "./badge-variants";

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  /** Color treatment. Defaults to `secondary` (soft neutral). */
  color?: BadgeColor;
  /** Render as the child element (e.g. an `<a>`) instead of a `<span>`. */
  asChild?: boolean;
}

/**
 * A small, non-interactive label for statuses, counts, tags, and categories. Inline-flex with a
 * pill radius; `color` carries the meaning as a same-hue tint, coloring the text and any leading
 * icon.
 */
function Badge({ className, color = "secondary", size, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Slot : "span";
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ size }), badgeColorClasses[color], className)} {...props} />
  );
}

export { Badge };
