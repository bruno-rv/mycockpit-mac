import { cva } from "class-variance-authority";

export const avatarVariants = cva(
  "relative flex shrink-0 rounded-full after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] has-[[data-slot=avatar-fallback]]:after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]",
  {
    variants: {
      size: {
        small: "size-7 text-small",
        medium: "size-8 text-small",
        large: "size-9 text-strong",
      },
    },
    defaultVariants: {
      size: "medium",
    },
  },
);
