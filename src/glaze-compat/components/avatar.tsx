import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";
import { type VariantProps } from "class-variance-authority";

import { cn } from "../utils";
import { avatarVariants } from "./avatar-variants";

export interface AvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root>, VariantProps<typeof avatarVariants> {}

function Avatar({ className, size, ...props }: AvatarProps) {
  return <AvatarPrimitive.Root data-slot="avatar" className={cn(avatarVariants({ size, className }))} {...props} />;
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className={cn("aspect-square size-full rounded-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        // Solid (not alpha) background so stacked avatars don't bleed through each other,
        // but still theme-derived: the opaque equivalent of fg-10 over the background seed.
        "flex size-full items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--bg),var(--fg)_10%)] font-medium tracking-wide text-secondary select-none",
        className,
      )}
      {...props}
    />
  );
}

const AVATAR_BADGE_COLORS = {
  gray: "bg-foreground-40",
  blue: "bg-support-blue",
  green: "bg-support-green",
  yellow: "bg-support-yellow",
  orange: "bg-support-orange",
  red: "bg-support-red",
  pink: "bg-support-magenta",
} as const;

const AVATAR_BADGE_POSITIONS = {
  "bottom-right": "right-0 bottom-0",
  "top-right": "top-0 right-0",
  "bottom-left": "bottom-0 left-0",
  "top-left": "top-0 left-0",
} as const;

export interface AvatarBadgeProps extends React.ComponentProps<"span"> {
  /** Dot color when the badge has no children. Ignored when rendering content. For other colors, pass `className`. */
  color?: keyof typeof AVATAR_BADGE_COLORS;
  /** Corner to anchor to. Defaults to `bottom-right` (presence); use `top-right` for notification counts. */
  position?: keyof typeof AVATAR_BADGE_POSITIONS;
}

/**
 * Corner indicator anchored to an `Avatar`. With no children it renders a status dot
 * (sized relative to the avatar); with children it renders a count/content pill that
 * overhangs the avatar edge.
 */
function AvatarBadge({ className, color = "green", position = "bottom-right", children, ...props }: AvatarBadgeProps) {
  const isDot = children == null || children === false;
  const overhangX = position.endsWith("right") ? "translate-x-1/3" : "-translate-x-1/3";
  const overhangY = position.startsWith("top") ? "-translate-y-1/3" : "translate-y-1/3";
  return (
    <span
      data-slot="avatar-badge"
      // Dot badges punch a real cutout in the avatar image/fallback via a mask in
      // styles.css (keyed off data-badge/data-position) — a background-colored ring
      // can't match the translucent surfaces behind the avatar.
      data-badge={isDot ? "dot" : "pill"}
      data-position={position}
      className={cn(
        "absolute z-10 flex items-center justify-center rounded-full",
        AVATAR_BADGE_POSITIONS[position],
        isDot
          ? cn("h-1/4 w-1/4 min-h-2 min-w-2", AVATAR_BADGE_COLORS[color])
          : cn("h-4 min-w-4 bg-support-red px-1 text-small-strong text-white", overhangX, overhangY),
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Overlapping avatar group with a real transparent gap between avatars: every
 * avatar below the previous one is masked where they overlap (rules in
 * styles.css keyed off data-slot), so any background shows through cleanly —
 * no surface-colored rings. First avatar renders on top.
 *
 * Assumes uniformly sized children; the mask geometry tracks the stack's
 * overlap via --avatar-stack-overlap.
 */
function AvatarStack({ className, children, ...props }: React.ComponentProps<"div">) {
  const items = React.Children.toArray(children);
  return (
    <div data-slot="avatar-stack" className={cn("flex -space-x-2", className)} {...props}>
      {items.map((child, index) =>
        React.isValidElement<{ style?: React.CSSProperties }>(child)
          ? React.cloneElement(child, {
              // The stack owns stacking order — its zIndex must win over any
              // zIndex in the child's own style.
              style: { ...child.props.style, zIndex: items.length - index },
            })
          : child,
      )}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarStack };
