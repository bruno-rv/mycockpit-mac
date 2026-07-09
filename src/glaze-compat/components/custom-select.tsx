"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "../utils";
import { cva, VariantProps } from "class-variance-authority";

function CustomSelect({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="custom-select" {...props} />;
}

function CustomSelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="custom-select-group" {...props} />;
}

function CustomSelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="custom-select-value" {...props} />;
}

const customSelectTriggerVariants = cva(
  "text-regular data-[placeholder]:text-placeholder [&_svg:not([class*='text-'])]:text-tertiary-solid aria-invalid:ring-support-red flex w-fit max-w-full overflow-hidden items-center justify-between gap-2 rounded-control whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[2px] ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=medium]:h-8 data-[size=sm]:h-7 data-[size=large]:h-9 *:data-[slot=custom-select-value]:min-w-0 *:data-[slot=custom-select-value]:truncate [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border border-field hover:border-foreground-40 focus-visible:border-foreground-40 px-3 py-2",
        transparent: "bg-transparent hover:bg-control-subtle -my-2",
        glass: "bg-glass hover:bg-control-subtle",
        // Not in the upstream SDK — added to match `Input`'s "filled" variant vocabulary,
        // which this app's home-view.tsx call sites already use.
        filled: "border border-transparent bg-control-subtle hover:bg-control",
      },
      size: {
        small: "h-7 px-2",
        medium: "h-8 px-3",
        large: "h-9 px-3",
      },
    },
  },
);

function CustomSelectTrigger({
  className,
  children,
  size = "medium",
  variant = "default",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & VariantProps<typeof customSelectTriggerVariants>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="custom-select-trigger"
      data-size={size}
      className={cn(customSelectTriggerVariants({ variant, size }), className)}
      {...props}
    >
      {children}
      <div
        className={cn(
          "shrink-0",
          variant === "transparent" && "bg-control rounded-pill size-4 grid place-items-center",
        )}
      >
        <SelectPrimitive.Icon asChild>
          <ChevronsUpDownIcon
            className={cn("size-4 text-quaternary", variant === "transparent" && "size-3 text-primary relative")}
          />
        </SelectPrimitive.Icon>
      </div>
    </SelectPrimitive.Trigger>
  );
}
CustomSelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

function CustomSelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="custom-select-content"
        className={cn(
          "z-50 max-h-[var(--radix-select-content-available-height)] min-w-[8rem] origin-[var(--radix-select-content-transform-origin)] overflow-x-hidden overflow-y-auto rounded-popover bg-popover ring-1 ring-foreground-20 p-1 opacity-100 shadow-lg",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        align={align}
        {...props}
      >
        <CustomSelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <CustomSelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}
CustomSelectContent.displayName = SelectPrimitive.Content.displayName;

function CustomSelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="custom-select-label"
      className={cn("text-small px-2 py-1 text-tertiary", className)}
      {...props}
    />
  );
}
CustomSelectLabel.displayName = SelectPrimitive.Label.displayName;

function CustomSelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="custom-select-item"
      className={cn(
        "group text-regular relative flex w-full cursor-default select-none items-center gap-2 rounded-lg py-1 pr-8 pl-2 outline-none text-primary focus:bg-accent focus:text-accent-contrast data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-primary group-focus:text-accent-contrast" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
CustomSelectItem.displayName = SelectPrimitive.Item.displayName;

function CustomSelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="custom-select-separator"
      className={cn("bg-separator pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}
CustomSelectSeparator.displayName = SelectPrimitive.Separator.displayName;

function CustomSelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="custom-select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4 text-tertiary" />
    </SelectPrimitive.ScrollUpButton>
  );
}
CustomSelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

function CustomSelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="custom-select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4 text-tertiary" />
    </SelectPrimitive.ScrollDownButton>
  );
}
CustomSelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

export {
  CustomSelect,
  CustomSelectContent,
  CustomSelectGroup,
  CustomSelectItem,
  CustomSelectLabel,
  CustomSelectScrollDownButton,
  CustomSelectScrollUpButton,
  CustomSelectSeparator,
  CustomSelectTrigger,
  CustomSelectValue,
};
