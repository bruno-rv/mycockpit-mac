/**
 * @glaze/core/components compat — Phase 0 stub.
 *
 * Every component the app imports is a no-op that renders nothing, typed `any`
 * so JSX usage type-checks. Real components get vendored from the SDK in Phase 2.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Permissive props: named callbacks are declared as loose function types so
// inline JSX handlers (`onValueChange={(v) => …}`) get an explicit `any`
// contextual type instead of tripping noImplicitAny; the index signature
// swallows every other prop.
interface StubProps {
  onChange?: (...args: any[]) => any;
  onClick?: (...args: any[]) => any;
  onConfirm?: (...args: any[]) => any;
  onError?: (...args: any[]) => any;
  onKeyDown?: (...args: any[]) => any;
  onLayoutChange?: (...args: any[]) => any;
  onOpenChange?: (...args: any[]) => any;
  onPlay?: (...args: any[]) => any;
  onValueChange?: (...args: any[]) => any;
  [key: string]: any;
}

const Noop = (_props: StubProps): null => null;

export const Toolbar = Noop;
export const ToolbarContent = Noop;
export const ToolbarTitle = Noop;
export const ToolbarActions = Noop;
export const ScrollArea = Noop;
export const Button = Noop;
export const Text = Noop;
export const EmptyState = Noop;
export const Separator = Noop;
export const Select = Noop;
export const SelectTrigger = Noop;
export const SelectValue = Noop;
export const SelectContent = Noop;
export const SelectItem = Noop;
export const Avatar = Noop;
export const AvatarImage = Noop;
export const AvatarFallback = Noop;
export const Badge = Noop;
export const Input = Noop;
export const Dialog = Noop;
export const Label = Noop;
export const RadioGroup = Noop;
export const RadioGroupItem = Noop;
export const Field = Noop;
export const FieldGroup = Noop;
export const FieldSet = Noop;
export const TooltipProvider = Noop;
export const Toaster = Noop;
export const SplitView = Noop;
export const Status = Noop;
export const ErrorBoundaryView = Noop;

export const toast: any = () => {};
