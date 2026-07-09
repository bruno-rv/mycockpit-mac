"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "../utils";
import { Button } from "./button";
import { CancelShortcutTooltip, ConfirmKeyHint, ConfirmShortcutTooltip } from "./dialog-shortcut-hints";
import { DialogShortcutContext, useDialogShortcuts, useRegisterConfirm } from "./dialog-shortcuts";
import { ScrollArea } from "./scroll-area";
import { Text } from "./text";

type SideAction = {
  label: React.ReactNode;
  onClick: () => void | Promise<void>;
};

/**
 * Top-level props — collapse the trigger/header/body/footer tree into a single `<Dialog>` call.
 * If any of these props is set, Dialog auto-builds the content tree and `children` becomes the
 * body (wrapped in `DialogBody`). If none are set, Dialog behaves exactly as the Radix root
 * (fallback: consumers compose DialogContent/DialogHeader/... by hand).
 */
type DialogOwnProps = {
  /** Auto-emits a `DialogTrigger asChild` wrapping this node. */
  trigger?: React.ReactNode;
  /** Auto-renders a `DialogTitle` inside the header. */
  title?: React.ReactNode;
  /**
   * Visually hide the title while keeping it in the DOM for screen readers. Use when the
   * trigger already conveys the same meaning and a visible title would be redundant. Radix
   * still sees a `DialogTitle`, so the accessibility warning is satisfied.
   */
  hideTitle?: boolean;
  /** Auto-renders a `DialogDescription` inside the header. */
  description?: React.ReactNode;
  /**
   * Visually hide the description while keeping it in the DOM for screen readers. Use when
   * the dialog body already conveys what the description would say. Radix still sees a
   * `DialogDescription`, so the accessibility warning is satisfied.
   */
  hideDescription?: boolean;
  /** Primary action handler. Enables the auto-built footer with Cancel + Confirm. */
  onConfirm?: () => void | Promise<void>;
  /** Confirm button label. Defaults to "Done". */
  confirmLabel?: React.ReactNode;
  /** Confirm button variant. Defaults to `"accent"`. Use `"destructive"` for deletes. */
  confirmVariant?: "accent" | "destructive";
  /** Disable the confirm button (e.g. when form validation fails). */
  confirmDisabled?: boolean;
  /** Left-aligned destructive action (e.g. "Remove"). Renders before secondary. */
  destructiveAction?: SideAction;
  /** Left-aligned neutral action (e.g. "Reset"). Renders after destructive. */
  secondaryAction?: SideAction;
  /** Forwarded to `DialogContent` when any top-level prop is set. */
  size?: "small" | "medium" | "large" | "xl" | "2xl";
  /** Forwarded to `DialogContent` when any top-level prop is set. */
  showCloseButton?: boolean;
};

type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root> &
  DialogOwnProps & {
    showOverlay?: boolean;
  };

function Dialog({
  children,
  showOverlay = true,
  trigger,
  title,
  hideTitle,
  description,
  hideDescription,
  onConfirm,
  confirmLabel,
  confirmVariant = "accent",
  confirmDisabled,
  destructiveAction,
  secondaryAction,
  size,
  showCloseButton,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: DialogProps) {
  const propsMode =
    trigger !== undefined || title !== undefined || description !== undefined || onConfirm !== undefined;

  // When the props API is used, manage open state internally so `onConfirm` can close the dialog after the
  // handler resolves. Controlled `open`/`onOpenChange` still win when provided.
  const [internalOpen, setInternalOpen] = React.useState<boolean>(defaultOpen ?? false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  if (!propsMode) {
    return (
      <DialogPrimitive.Root
        data-slot="dialog"
        open={controlledOpen}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        {...props}
      >
        {showOverlay && <DialogOverlay />}
        {children}
      </DialogPrimitive.Root>
    );
  }

  if (process.env.NODE_ENV !== "production" && trigger !== undefined) {
    const hasExplicitTrigger = React.Children.toArray(children).some(
      (c) => React.isValidElement(c) && (c.type as { displayName?: string })?.displayName === "DialogTrigger",
    );
    if (hasExplicitTrigger) {
      console.warn(
        "Dialog: the `trigger` prop is set, but a `<DialogTrigger>` child is also present. Use one or the other — `trigger` will win.",
      );
    }
  }

  const hasBody = children !== undefined && children !== null && children !== false;
  const hasVisibleTitle = title !== undefined && !hideTitle;
  const hasVisibleDescription = description !== undefined && !hideDescription;
  const hasVisibleHeader = hasVisibleTitle || hasVisibleDescription;

  return (
    <DialogPrimitive.Root data-slot="dialog" open={open} onOpenChange={handleOpenChange} {...props}>
      {trigger !== undefined && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent size={size} showCloseButton={showCloseButton}>
        {hasVisibleHeader ? (
          <DialogHeader>
            {title !== undefined && <DialogTitle className={hideTitle ? "sr-only" : undefined}>{title}</DialogTitle>}
            {description !== undefined && (
              <DialogDescription className={hideDescription ? "sr-only" : undefined}>{description}</DialogDescription>
            )}
          </DialogHeader>
        ) : (
          // sr-only only: render outside the header to avoid an empty gap-4 row.
          <>
            {title !== undefined && <DialogTitle className="sr-only">{title}</DialogTitle>}
            {description !== undefined && <DialogDescription className="sr-only">{description}</DialogDescription>}
          </>
        )}
        {hasBody && <DialogBody>{children}</DialogBody>}
        {onConfirm !== undefined && (
          <DialogConfirmationFooter
            onConfirm={onConfirm}
            onSuccess={() => handleOpenChange(false)}
            confirmLabel={confirmLabel}
            confirmVariant={confirmVariant}
            confirmDisabled={confirmDisabled}
            destructiveAction={destructiveAction}
            secondaryAction={secondaryAction}
          />
        )}
      </DialogContent>
    </DialogPrimitive.Root>
  );
}
Dialog.displayName = "Dialog";

function DialogConfirmationFooter({
  onConfirm,
  onSuccess,
  confirmLabel,
  confirmVariant,
  confirmDisabled,
  destructiveAction,
  secondaryAction,
}: {
  onConfirm: () => void | Promise<void>;
  onSuccess: () => void;
  confirmLabel?: React.ReactNode;
  confirmVariant: "accent" | "destructive";
  confirmDisabled?: boolean;
  destructiveAction?: SideAction;
  secondaryAction?: SideAction;
}) {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isDestructing, setIsDestructing] = React.useState(false);
  const [isSecondarying, setIsSecondarying] = React.useState(false);
  const anyPending = isConfirming || isDestructing || isSecondarying;
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  useRegisterConfirm(confirmRef);

  // Guard pending-state resets: a successful onConfirm closes the dialog, which may unmount
  // this footer before the `finally` runs. Same concern for side actions that trigger a
  // parent close.
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      if (mountedRef.current) onSuccess();
    } catch {
      // Stay open so the caller can surface an error inline.
    } finally {
      if (mountedRef.current) setIsConfirming(false);
    }
  };

  const runSideAction = (handler: () => void | Promise<void>, setPending: (v: boolean) => void) => async () => {
    setPending(true);
    try {
      await handler();
    } catch {
      // Stay open so the caller can surface an error inline.
    } finally {
      if (mountedRef.current) setPending(false);
    }
  };

  const hasLeftActions = destructiveAction !== undefined || secondaryAction !== undefined;

  // 4-button multi-action sheets (destructive + secondary + Cancel + Confirm) don't fit
  // horizontally at standard widths — stack vertically (primary on top, Cancel at the bottom).
  // 2- and 3-button layouts always fit horizontally.
  const isVertical = destructiveAction !== undefined && secondaryAction !== undefined;

  // Pending state disables action buttons but doesn't show an inline spinner (would shift button
  // width as text is pushed aside). Cancel stays enabled so users can still dismiss the dialog if
  // an async handler hangs. Consumers surface errors via toast inside their handler; the dialog
  // stays open on throw, so the toast has a surface to land on.
  const confirmButton = (
    <ConfirmShortcutTooltip>
      <Button
        ref={confirmRef}
        variant={confirmVariant}
        onClick={runConfirm}
        disabled={confirmDisabled || anyPending}
        className={isVertical ? "w-full" : undefined}
      >
        {confirmLabel ?? "Done"}
        <ConfirmKeyHint />
      </Button>
    </ConfirmShortcutTooltip>
  );

  const cancelButton = (
    <CancelShortcutTooltip>
      <DialogClose asChild>
        <Button variant="filled" className={isVertical ? "w-full" : undefined}>
          Cancel
        </Button>
      </DialogClose>
    </CancelShortcutTooltip>
  );

  const secondaryButton = secondaryAction && (
    <Button
      variant="filled"
      onClick={runSideAction(secondaryAction.onClick, setIsSecondarying)}
      disabled={anyPending}
      className={isVertical ? "w-full" : undefined}
    >
      {secondaryAction.label}
    </Button>
  );

  // Side-action destructive button uses `filled`, not `destructive` — matches macOS, where the
  // terminal red confirmation happens in a follow-up AlertDialog, not on the side-action itself.
  const destructiveButton = destructiveAction && (
    <Button
      variant="filled"
      onClick={runSideAction(destructiveAction.onClick, setIsDestructing)}
      disabled={anyPending}
      className={isVertical ? "w-full" : undefined}
    >
      {destructiveAction.label}
    </Button>
  );

  if (isVertical) {
    return (
      <DialogFooter className="flex-col gap-2">
        {confirmButton}
        {secondaryButton}
        {destructiveButton}
        {cancelButton}
      </DialogFooter>
    );
  }

  return (
    <DialogFooter className={hasLeftActions ? "justify-between" : undefined}>
      {hasLeftActions && (
        <div className="flex flex-row gap-2">
          {destructiveButton}
          {secondaryButton}
        </div>
      )}
      <div className="flex flex-row gap-2">
        {cancelButton}
        {confirmButton}
      </div>
    </DialogFooter>
  );
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}
DialogTrigger.displayName = "DialogTrigger";

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-50 bg-panel-backdrop no-drag", className)}
      {...props}
    />
  );
}

// Larger dialogs animate slower and travel farther — heavier presentation weight.
// Exit is ~30% faster than entry. Y travel caps at 16px past `large`.
type DialogSize = "small" | "medium" | "large" | "xl" | "2xl";
const DIALOG_ANIM_IN: Record<DialogSize, string> = {
  small: "260ms",
  medium: "300ms",
  large: "340ms",
  xl: "380ms",
  "2xl": "420ms",
};
const DIALOG_ANIM_OUT: Record<DialogSize, string> = {
  small: "180ms",
  medium: "220ms",
  large: "240ms",
  xl: "260ms",
  "2xl": "280ms",
};
const DIALOG_ANIM_Y: Record<DialogSize, string> = {
  small: "8px",
  medium: "12px",
  large: "16px",
  xl: "16px",
  "2xl": "16px",
};

function DialogContent({
  className,
  children,
  showCloseButton = false,
  overlayClassName,
  size = "medium",
  style,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  overlayClassName?: string;
  size?: "small" | "medium" | "large" | "xl" | "2xl";
}) {
  const animIn = DIALOG_ANIM_IN[size];
  const animOut = DIALOG_ANIM_OUT[size];
  const animY = DIALOG_ANIM_Y[size];
  const { contextValue, onKeyDown: shortcutKeyDown, contentRef } = useDialogShortcuts();
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    shortcutKeyDown(e);
  };
  return (
    <>
      <DialogPortal data-slot="dialog-portal">
        <DialogOverlay
          className={overlayClassName}
          style={{ "--dialog-anim-in": animIn, "--dialog-anim-out": animOut } as React.CSSProperties}
        />
        <div
          data-slot="dialog-drag-strip"
          className="pointer-events-auto fixed top-0 left-0 right-0 h-[52px] z-[100]"
          style={{ WebkitAppRegion: "drag", appRegion: "drag", pointerEvents: "auto" } as React.CSSProperties}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          data-slot="dialog-content"
          style={
            {
              "--dialog-px": "1.25rem",
              "--dialog-anim-in": animIn,
              "--dialog-anim-out": animOut,
              "--dialog-anim-y": animY,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "fixed no-drag bg-popover outline-1 outline-foreground-10 shadow-[0_20px_48px_-12px_rgb(0_0_0/0.35)] dark:shadow-[0_32px_64px_-8px_rgb(0_0_0/0.85),0_10px_20px_-4px_rgb(0_0_0/0.4)] top-[50%] left-[50%] z-50 grid grid-cols-1 max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-dialog py-5",
            size === "small" && "w-2xs",
            size === "medium" && "w-[400px]",
            size === "large" && "w-[500px]",
            size === "xl" && "w-[750px]",
            size === "2xl" && "w-[900px]",
            className,
          )}
          onKeyDown={handleKeyDown}
          {...props}
        >
          <DialogShortcutContext.Provider value={contextValue}>{children}</DialogShortcutContext.Provider>
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className={cn(
                "absolute top-4 right-4 size-5 grid place-items-center rounded-pill opacity-70 hover:opacity-100",
                "focus:ring-2 focus:outline-hidden disabled:pointer-events-none",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              )}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 text-left px-(--dialog-px)", className)}
      {...props}
    />
  );
}

function DialogBody({
  className,
  scrollAreaClassName,
  maxHeight = "60vh",
  ...props
}: React.ComponentProps<"div"> & { scrollAreaClassName?: string; maxHeight?: string }) {
  return (
    <ScrollArea
      data-slot="dialog-body"
      className={cn("h-max max-h-[var(--max-height)]", scrollAreaClassName)}
      viewportClassName="max-h-[var(--max-height)]"
      style={{ "--max-height": maxHeight } as React.CSSProperties}
      fadeEdges
    >
      <div className={cn("px-(--dialog-px)", className)} {...props} />
    </ScrollArea>
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-row gap-2 justify-end px-(--dialog-px)", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <Text asChild variant="large-strong">
      <DialogPrimitive.Title data-slot="dialog-title" className={className} {...props} />
    </Text>
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <Text asChild variant="regular" color="secondary">
      <DialogPrimitive.Description data-slot="dialog-description" className={className} {...props} />
    </Text>
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
