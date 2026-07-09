import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center whitespace-nowrap text-strong overflow-hidden
  focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:cursor-default
  disabled:pointer-events-none disabled:opacity-50`,
  {
    variants: {
      variant: {
        accent:
          "bg-accent text-accent-contrast! border border-transparent active:bg-accent-hover! focus:outline-none focus-visible:ring-accent-contrast data-[state='open']:bg-accent-hover!",
        destructive:
          "bg-support-red text-white! border border-transparent active:bg-support-red-hover! focus:outline-none focus-visible:ring-white",
        filled:
          "bg-control text-primary border border-transparent active:bg-control-active backdrop-blur-xs focus:outline-none data-[state='open']:bg-control",
        muted:
          "bg-control-subtle text-primary border border-transparent active:bg-control backdrop-blur-xs focus:outline-none data-[state='open']:bg-control",
        glass:
          "bg-glass dimmable hover:bg-control-subtle text-primary border border-transparent active:bg-control focus:outline-none data-[state='open']:bg-control",
        glassAccent:
          "bg-glass-accent text-accent-contrast! border border-transparent focus:outline-none focus-visible:ring-accent-contrast data-[state='open']:bg-glass-accent",
        transparent: "text-primary hover:bg-control-subtle hover:text-primary focus-visible:bg-control-subtle dimmable",
      },
      size: {
        small: "h-7 px-2 gap-1.5 [&_svg:not([class*='size-'])]:size-4",
        medium: "h-8 px-3 gap-1.5 [&_svg:not([class*='size-'])]:size-4.5",
        large: "h-9 px-3 gap-1.5 [&_svg:not([class*='size-'])]:size-5",
      },
      iconOnly: {
        true: "p-0",
      },
      radius: {
        full: "rounded-pill",
        rounded: "rounded-control",
      },
    },
    compoundVariants: [
      {
        size: "small",
        iconOnly: true,
        className: "h-7 w-7",
      },
      {
        size: "medium",
        iconOnly: true,
        className: "h-8 w-8",
      },
      {
        size: "large",
        iconOnly: true,
        className: "w-9 h-9",
      },
      // Size-proportional radius — mirror `SelectTrigger`/`Input`: small rounded buttons
      // drop from `rounded-control` to `rounded-lg` so the corner softness tracks the
      // smaller control height in inspector-density layouts.
      {
        size: "small",
        radius: "rounded",
        className: "rounded-lg",
      },
    ],
    defaultVariants: {
      variant: "filled",
      size: "medium",
      iconOnly: false,
      radius: "full",
    },
  },
);
