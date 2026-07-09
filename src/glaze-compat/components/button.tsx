import * as React from "react";
import { Slot as SlotPrimitive } from "radix-ui";
import { type VariantProps } from "class-variance-authority";
import { cn } from "../utils";
import { buttonVariants } from "./button-variants";
import { useInButtonGroup } from "./button-group-context";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, iconOnly, radius, asChild = false, style, ...props }, ref) => {
    const inButtonGroup = useInButtonGroup();
    const resolvedVariant = variant ?? (inButtonGroup ? "transparent" : undefined);
    const Comp = (asChild ? SlotPrimitive.Slot : "button") as React.ElementType;
    return (
      <Comp
        className={cn(buttonVariants({ variant: resolvedVariant, size, className, iconOnly, radius }))}
        style={style}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
