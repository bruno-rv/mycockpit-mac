"use client";

/**
 * Native-coupling fix (PORT_PLAN 2.1): the SDK's tooltip.tsx renders into a native
 * `NativeView` (a real, separately-animated `window.open()` child window) so the tooltip can
 * float outside the WKWebView's bounds and get native blur/shadow. Electron has no equivalent
 * — and doesn't need one, since Chromium can already paint a `position: fixed` popover above
 * everything in-process. This rewrites the same public API (`Tooltip`, `TooltipTrigger`,
 * `TooltipContent`, `TooltipProvider`) on top of Radix's `Tooltip` primitive, dropping
 * `native-view.tsx`, `use-window-focus.ts`, and the `glazeTooltipTrace` diagnostics entirely.
 */
import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "../utils";
import { Key, KeyGroup } from "./key";

function TooltipProvider({
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={700} {...props}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

function Tooltip({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...props} />;
}

type TooltipContentBaseProps = {
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
};
type TooltipContentProps = TooltipContentBaseProps &
  ({ children: React.ReactNode; shortcut?: string[] } | { children?: React.ReactNode; shortcut: string[] });

function TooltipContent({ children, className, shortcut, side = "top" }: TooltipContentProps) {
  const hasLabel = React.Children.count(children) > 0;
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        sideOffset={6}
        className={cn(
          "z-50 bg-popover text-primary rounded-lg shadow-lg outline-1 outline-foreground-10",
          "text-small flex items-center gap-1.5 max-w-[300px] leading-none",
          hasLabel ? "px-2 py-1" : "px-1 py-1",
          className,
        )}
      >
        {children}
        {shortcut && (
          <KeyGroup className={cn("shrink-0", hasLabel && "-mr-1")}>
            {shortcut.map((key, index) => (
              <Key key={index} variant="filled">
                {key}
              </Key>
            ))}
          </KeyGroup>
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
