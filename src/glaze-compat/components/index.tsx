/**
 * @glaze/core/components compat — Phase 2 (PORT_PLAN 2.1).
 *
 * Real Glaze components vendored from the SDK (`@glaze/core/src/components/`), trimmed to
 * the set the app actually imports plus their transitive deps. See the individual files for
 * the native-coupling fixes applied during vendoring:
 *   - `custom-select.tsx` (Radix-only `CustomSelect`) is re-exported here as `Select*` —
 *     the SDK's own `select.tsx` (native macOS-menu backed) was never copied.
 *   - `tooltip.tsx` was rewritten on top of Radix's `Tooltip` primitive instead of the SDK's
 *     native child-window (`NativeView`) implementation.
 *   - `scroll-area.tsx` pulls a local web-stub `usePreferredScrollerStyle` instead of the
 *     native IPC-backed hook.
 *   - `sonner.tsx` reads dark-mode via a local class observer instead of the SDK's
 *     `../hooks/use-theme` (different return signature than this app's compat `useTheme`).
 *   - `error-boundary-view.tsx` drops the SDK's "Fix with Agent" IPC action and app-store
 *     gating (`GlazeLogo`, `isBundledStoreApp`) — neither exists in this standalone app.
 */

export { Toolbar, ToolbarContent, ToolbarTitle, ToolbarDescription, ToolbarActions } from "./toolbar";
export { ScrollArea } from "./scroll-area";
export { Button, type ButtonProps } from "./button";
export { Text, type TextProps } from "./text";
export { EmptyState, EmptyStateTitle, EmptyStateDescription, EmptyStateActions, EmptyStateMedia } from "./empty-state";
export { Separator } from "./separator";

export {
  CustomSelect as Select,
  CustomSelectGroup as SelectGroup,
  CustomSelectValue as SelectValue,
  CustomSelectContent as SelectContent,
  CustomSelectLabel as SelectLabel,
  CustomSelectItem as SelectItem,
  CustomSelectSeparator as SelectSeparator,
  CustomSelectTrigger as SelectTrigger,
} from "./custom-select";

export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarStack, type AvatarProps } from "./avatar";
export { Badge, type BadgeProps } from "./badge";
export { Input } from "./input";

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
} from "./dialog";

export { Label } from "./label";
export { RadioGroup, RadioGroupItem } from "./radio-group";

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
} from "./field";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
export { Toaster, Toast, PromiseToast, type ToastProps, type ToastType } from "./sonner";
export { toast } from "./toast";

export { SplitView, type SplitViewProps, type SlotSize } from "./split-view";
export { useSplitView, type SplitViewContextValue } from "./split-view-context";
export { Status } from "./status";
export { ErrorBoundaryView } from "./error-boundary-view";
