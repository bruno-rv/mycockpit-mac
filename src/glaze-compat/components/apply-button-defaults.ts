import * as React from "react";
import { cn } from "../utils";
import { Button } from "./button";

type ButtonDefaults = {
  variant?: string;
  size?: string;
  className?: string;
};

function isButtonElement(child: unknown): child is React.ReactElement<Record<string, unknown>> {
  return (
    React.isValidElement(child) &&
    ((child.type as { displayName?: string })?.displayName === "Button" || child.type === Button)
  );
}

/**
 * Fill in `variant` / `size` / `className` on Button children, descending through wrappers like
 * Tooltip or `DropdownMenuTrigger asChild`. Explicit props on the Button win.
 *
 * Does not traverse function-as-children (`<Menu>{(state) => <Button />}</Menu>`) — set props
 * manually in that case.
 */
function applyButtonDefaults(node: React.ReactNode, defaults: ButtonDefaults): React.ReactNode {
  return React.Children.map(node, (child) => {
    if (!React.isValidElement(child)) return child;

    if (isButtonElement(child)) {
      const buttonProps = child.props;
      return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        ...(defaults.variant !== undefined && { variant: buttonProps.variant ?? defaults.variant }),
        ...(defaults.size !== undefined && { size: buttonProps.size ?? defaults.size }),
        className: cn(defaults.className, buttonProps.className as string | undefined),
      });
    }

    const childProps = child.props as { children?: React.ReactNode };
    if (childProps.children !== undefined) {
      return React.cloneElement(child as React.ReactElement<{ children?: React.ReactNode }>, {
        children: applyButtonDefaults(childProps.children, defaults),
      });
    }

    return child;
  });
}

/** Content-area defaults (`variant="glass"`, `size="large"`). Icon sizing is the caller's. */
function applyContentToolbarButtonDefaults(actions: React.ReactNode): React.ReactNode {
  return applyButtonDefaults(actions, { variant: "glass", size: "large" });
}

export { applyButtonDefaults, applyContentToolbarButtonDefaults };
export type { ButtonDefaults };
