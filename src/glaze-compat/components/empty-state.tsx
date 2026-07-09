import * as React from "react";
import { cn } from "../utils";
import { Text } from "./text";

function EmptyStateMedia({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mb-1 flex items-center justify-center", className)} {...props}>
      {children}
    </div>
  );
}

function EmptyStateTitle({ children, className, ...props }: Omit<React.ComponentProps<"h1">, "color">) {
  return (
    // Display text reads better light: heading1's size with regular weight (the pre-scale
    // empty states used 22/400).
    <Text as="h1" variant="heading1" className={cn("font-normal", className)} {...props}>
      {children}
    </Text>
  );
}

function EmptyStateDescription({ children, className, ...props }: Omit<React.ComponentProps<"p">, "color">) {
  return (
    <Text as="p" color="tertiary" className={className} {...props}>
      {children}
    </Text>
  );
}

function EmptyStateActions({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-2 w-fit mx-auto mt-2", className)} {...props}>
      {children}
    </div>
  );
}

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  placement?: "center" | "inline";
  /** Heading text. Mutually exclusive with an `EmptyStateTitle` child. */
  title?: React.ReactNode;
  /** Supporting text below the title. */
  description?: React.ReactNode;
  /** Action buttons (one or multiple). */
  actions?: React.ReactNode;
  /** Icon or illustration above the title. Rarely needed — native macOS apps usually omit media in empty states. */
  media?: React.ReactNode;
};

function EmptyState({
  children,
  className,
  placement = "center",
  title,
  description,
  actions,
  media,
  ...props
}: EmptyStateProps) {
  const propsMode = title !== undefined || description !== undefined || actions !== undefined || media !== undefined;
  const content = propsMode ? (
    <>
      {media !== undefined && <EmptyStateMedia>{media}</EmptyStateMedia>}
      {title !== undefined && <EmptyStateTitle>{title}</EmptyStateTitle>}
      {description !== undefined && <EmptyStateDescription>{description}</EmptyStateDescription>}
      {actions !== undefined && <EmptyStateActions>{actions}</EmptyStateActions>}
    </>
  ) : (
    children
  );

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        placement === "center" ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" : "",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-2 w-full text-center max-w-sm mx-auto">{content}</div>
    </div>
  );
}

export { EmptyState, EmptyStateTitle, EmptyStateDescription, EmptyStateActions, EmptyStateMedia };
