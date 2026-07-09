"use client";

import * as React from "react";

type DialogShortcutMode = "enter" | "cmd-enter";

type DialogShortcutContextValue = {
  mode: DialogShortcutMode;
  registerConfirm: (el: HTMLButtonElement | null) => void;
};

const DialogShortcutContext = React.createContext<DialogShortcutContextValue | null>(null);

// Inline IME guard so glaze-core stays self-contained. Mirrors `isUsingInputMethodEditor` in
// main-app — the keyCode === 229 fallback covers Safari, where isComposing is unreliable.
function isComposing(event: KeyboardEvent) {
  return event.isComposing || event.keyCode === 229;
}

const TEXT_INPUT_SELECTOR = [
  "input:not([disabled]):not([type])",
  'input[type="text" i]:not([disabled])',
  'input[type="search" i]:not([disabled])',
  'input[type="url" i]:not([disabled])',
  'input[type="tel" i]:not([disabled])',
  'input[type="email" i]:not([disabled])',
  'input[type="password" i]:not([disabled])',
  'input[type="number" i]:not([disabled])',
].join(", ");

const FOCUSABLE_INPUT_SELECTOR = `${TEXT_INPUT_SELECTOR}, textarea:not([disabled]), [contenteditable=""], [contenteditable="true"]`;

function detectShortcutMode(root: Pick<HTMLElement, "querySelector"> | null): DialogShortcutMode {
  if (!root) return "enter";
  return root.querySelector(FOCUSABLE_INPUT_SELECTOR) ? "cmd-enter" : "enter";
}

/**
 * Wires up keyboard shortcuts for a dialog's confirm action. Detects whether the body has a text
 * input and picks the shortcut accordingly: plain Enter when there's nothing to type into, Cmd/
 * Ctrl+Enter when the user is meant to type first. Esc is left to Radix.
 *
 * The shortcut is dialog-scoped, not focus-scoped — Enter fires confirm even when Cancel is
 * focused. This matches macOS native dialogs (default button responds to Enter regardless of
 * focus) and keeps the visible hint authoritative.
 */
function useDialogShortcuts() {
  const [mode, setMode] = React.useState<DialogShortcutMode>("enter");
  // Callback ref instead of useRef: the effect needs to re-run the moment the Radix Content node
  // actually attaches, which a useRef + `[ref]` dep array can't trigger (the ref object identity
  // is stable, so the effect would only fire once on mount — possibly before Radix has finished
  // mounting Content). useState turns the ref attachment into a render trigger.
  const [contentNode, setContentNode] = React.useState<HTMLElement | null>(null);
  const confirmRef = React.useRef<HTMLButtonElement | null>(null);

  const contentRef = React.useCallback((node: HTMLElement | null) => {
    setContentNode(node);
  }, []);

  // Detect on mount, then re-detect when descendants change. Radix Portals + animation timing
  // mean the input may not be in the DOM by the time a single layout effect runs, so a
  // MutationObserver is the only reliable way to catch the eventual DOM. Cheap enough — one
  // observer per dialog open, torn down with the content.
  React.useEffect(() => {
    if (!contentNode) return;
    const detect = () => setMode(detectShortcutMode(contentNode));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(contentNode, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [contentNode]);

  const registerConfirm = React.useCallback((el: HTMLButtonElement | null) => {
    if (
      process.env.NODE_ENV !== "production" &&
      el !== null &&
      confirmRef.current !== null &&
      confirmRef.current !== el
    ) {
      // Last-write-wins: Cmd/Enter fires the most recently registered confirm. This is fine for
      // multi-action dialogs that intentionally have several `<AlertDialogAction>`s (the registry
      // settles on the last one mounted), but a noisy warning here helps catch the unintentional
      // case — a single dialog accidentally double-wiring confirm.
      console.warn(
        "DialogShortcutContext: a second confirm button was registered while another was still active. " +
          "Cmd/Enter will fire the most recently registered button. Double-check you don't have multiple " +
          "props-mode footers or duplicate <AlertDialogAction> registrations in the same dialog.",
      );
    }
    confirmRef.current = el;
  }, []);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter") return;
      if (isComposing(e.nativeEvent)) return;
      const isMeta = e.metaKey || e.ctrlKey;
      const matches = mode === "enter" ? !isMeta : isMeta;
      if (!matches) return;
      const btn = confirmRef.current;
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      btn.click();
    },
    [mode],
  );

  const contextValue = React.useMemo<DialogShortcutContextValue>(
    () => ({ mode, registerConfirm }),
    [mode, registerConfirm],
  );

  return { contextValue, onKeyDown, contentRef };
}

function useRegisterConfirm(ref: React.RefObject<HTMLButtonElement | null>) {
  const ctx = React.useContext(DialogShortcutContext);
  React.useEffect(() => {
    if (!ctx) return;
    ctx.registerConfirm(ref.current);
    return () => ctx.registerConfirm(null);
  }, [ctx, ref]);
}

export {
  DialogShortcutContext,
  type DialogShortcutMode,
  detectShortcutMode as detectShortcutModeForTesting,
  useDialogShortcuts,
  useRegisterConfirm,
};
