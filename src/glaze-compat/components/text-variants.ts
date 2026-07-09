import { cva } from "class-variance-authority";

import { textVariantClasses } from "./text-scale";

export const textVariants = cva("", {
  variants: {
    variant: textVariantClasses,
    color: {
      primary: "text-primary",
      secondary: "text-secondary",
      tertiary: "text-tertiary",
      quaternary: "text-quaternary",
      disabled: "text-disabled",
      link: "text-link",
      inherit: "text-inherit",
      accent: "text-accent",
      red: "text-support-red",
      orange: "text-support-orange",
      yellow: "text-support-yellow",
      green: "text-support-green",
      blue: "text-support-blue",
      purple: "text-support-purple",
      magenta: "text-support-magenta",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
    truncate: {
      true: "truncate",
    },
  },
  defaultVariants: {
    variant: "regular",
    color: "primary",
    // No align default — alignment inherits (a `text-left` default would override
    // `text-center` cascading from centered parents like EmptyState).
  },
});
