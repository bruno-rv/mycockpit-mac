"use client";

import * as React from "react";

import { DialogShortcutContext } from "./dialog-shortcuts";
import { Key, KeyGroup } from "./key";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const inlineKeyClass = "border-current/30 text-current opacity-70";

/**
 * Inline ⌘↵ rendered next to the confirm label. Shows ONLY when the dialog body has a text input
 * and the shortcut is therefore Cmd/Ctrl+Enter — that case is unusual enough that the affordance
 * needs to be visible at rest. The plain-Enter case uses a tooltip wrapper instead so the button
 * stays clean.
 */
function ConfirmKeyHint() {
  const ctx = React.useContext(DialogShortcutContext);
  if (!ctx || ctx.mode !== "cmd-enter") return null;
  return (
    <KeyGroup className="ml-1">
      <Key className={inlineKeyClass}>⌘</Key>
      <Key className={inlineKeyClass}>↵</Key>
    </KeyGroup>
  );
}

/**
 * Wraps a confirm button in a tooltip showing the ↵ shortcut, only in plain-Enter mode. In
 * Cmd+Enter mode the shortcut renders inline via `<ConfirmKeyHint />` instead, and this wrapper
 * is a no-op pass-through.
 */
function ConfirmShortcutTooltip({ children }: { children: React.ReactElement }) {
  const ctx = React.useContext(DialogShortcutContext);
  if (!ctx || ctx.mode !== "enter") return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent shortcut={["↵"]} />
    </Tooltip>
  );
}

/**
 * Wraps a cancel button in a tooltip showing the Esc shortcut. Always tooltip — Esc-to-close is
 * the same affordance regardless of confirm-shortcut mode, so there's no reason to render it
 * inline.
 */
function CancelShortcutTooltip({ children }: { children: React.ReactElement }) {
  const ctx = React.useContext(DialogShortcutContext);
  if (!ctx) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent shortcut={["Esc"]} />
    </Tooltip>
  );
}

export { CancelShortcutTooltip, ConfirmKeyHint, ConfirmShortcutTooltip };
