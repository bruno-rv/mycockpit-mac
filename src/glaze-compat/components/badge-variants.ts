import { cva } from "class-variance-authority";

export type BadgeColor =
  | "primary"
  | "secondary"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "magenta";

/* Structural + size classes. The surface + text color are layered on per color from
   `badgeColorClasses`. Color is carried as a same-hue tint + colored text — never
   text-on-a-solid-fill — because the support-color seeds invert lightness between light/dark
   themes, so colored-text-on-tint is the only treatment that stays legible in both. */
export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-pill [&>svg]:pointer-events-none",
  {
    variants: {
      size: {
        small: "text-small-strong px-1.5 py-0.5 [&>svg]:size-3",
        medium: "text-strong px-2 py-0.5 [&>svg]:size-3.5",
      },
    },
    defaultVariants: {
      size: "small",
    },
  },
);

/* color → surface + text color. Support colors are a same-hue tint (`-10`) with colored text.
   The neutrals are `primary` (high-contrast solid: foreground-colored fill + background-colored
   text, so it's dark-on-light in light mode and inverts in dark) and `secondary` (soft control
   surface with secondary text). */
export const badgeColorClasses: Record<BadgeColor, string> = {
  primary: "bg-gray-12 text-gray-1",
  secondary: "bg-control text-secondary",
  blue: "bg-support-blue-10 text-support-blue",
  green: "bg-support-green-10 text-support-green",
  yellow: "bg-support-yellow-10 text-support-yellow",
  orange: "bg-support-orange-10 text-support-orange",
  red: "bg-support-red-10 text-support-red",
  purple: "bg-support-purple-10 text-support-purple",
  magenta: "bg-support-magenta-10 text-support-magenta",
};
