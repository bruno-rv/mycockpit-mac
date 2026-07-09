/**
 * @glaze/core/components compat — Phase 1 placeholders.
 *
 * Minimal, mostly-unstyled React implementations so the renderer tree actually
 * mounts (real Radix-based vendoring from the SDK lands in Phase 2 — see
 * PORT_PLAN 2.1). A handful of components need real interactive state
 * (Select, RadioGroup, Dialog) because the app reads back `value`/`onValueChange`
 * immediately on mount; the rest are plain passthrough wrappers.
 *
 * `Toaster`/`toast` are re-exported directly from the real `sonner` package
 * (already a dependency) rather than stubbed — same API shape the app expects.
 */
import * as React from "react";

export { Toaster, toast } from "sonner";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

function passthrough(tag: keyof React.JSX.IntrinsicElements) {
  return React.forwardRef<HTMLElement, DivProps>(function Passthrough({ children, ...rest }, ref) {
    return React.createElement(tag, { ref, ...rest }, children);
  });
}

export const Toolbar = passthrough("div");
export const ToolbarContent = passthrough("div");
export const ToolbarTitle = passthrough("h1");
export const ToolbarActions = passthrough("div");
export const Separator = passthrough("hr");
export const Label = passthrough("label");

interface ScrollAreaProps extends DivProps {
  toolbar?: React.ReactNode;
  autoScrollToBottom?: boolean;
  autoScrollDeps?: unknown[];
  showScrollToBottomButton?: boolean;
}

export function ScrollArea({
  toolbar,
  autoScrollToBottom,
  autoScrollDeps,
  showScrollToBottomButton: _showScrollToBottomButton,
  className,
  children,
  ...rest
}: ScrollAreaProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoScrollToBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, autoScrollDeps ?? []);

  return (
    <div className="flex flex-col min-h-0">
      {toolbar}
      <div ref={scrollRef} className={["overflow-auto", className].filter(Boolean).join(" ")} {...rest}>
        {children}
      </div>
    </div>
  );
}

interface TextProps extends DivProps {
  as?: keyof React.JSX.IntrinsicElements;
  variant?: string;
  color?: string;
  truncate?: boolean;
  align?: string;
}

export function Text({ as = "span", variant, color, truncate, align, className, children, ...rest }: TextProps) {
  return React.createElement(
    as,
    {
      className,
      "data-variant": variant,
      "data-color": color,
      "data-truncate": truncate,
      "data-align": align,
      ...rest,
    },
    children,
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string;
  size?: string;
  iconOnly?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, iconOnly, type = "button", className, children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={className} data-variant={variant} data-size={size} {...rest}>
      {children}
    </button>
  );
});

interface EmptyStateProps {
  placement?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={className} data-empty-state="">
      {title ? <div className="font-medium">{title}</div> : null}
      {description ? <div className="text-secondary text-sm">{description}</div> : null}
      {actions ? <div className="mt-2">{actions}</div> : null}
    </div>
  );
}

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: string;
  variant?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size, variant, ...rest },
  ref,
) {
  return <input ref={ref} data-size={size} data-variant={variant} {...rest} />;
});

interface BadgeProps extends DivProps {
  color?: string;
  size?: string;
}

export function Badge({ color, size, className, children, ...rest }: BadgeProps) {
  return (
    <span className={className} data-color={color} data-size={size} {...rest}>
      {children}
    </span>
  );
}

interface AvatarProps extends DivProps {
  size?: string;
}

export function Avatar({ size, className, children, ...rest }: AvatarProps) {
  return (
    <div className={className} data-size={size} {...rest}>
      {children}
    </div>
  );
}

export const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  function AvatarImage(props, ref) {
    return <img ref={ref} {...props} />;
  },
);
export const AvatarFallback = passthrough("span");

// ─── Select (minimal working implementation; real Radix CustomSelect vendoring
// lands in Phase 2 per PORT_PLAN 2.1 — Select aliased from CustomSelect) ─────

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const contextValue = React.useMemo(
    () => ({ value, onValueChange, open, setOpen }),
    [value, onValueChange, open],
  );
  return (
    <SelectContext.Provider value={contextValue}>
      <div className="relative inline-block">{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: string;
  variant?: string;
}

export function SelectTrigger({ size, variant, className, children, ...rest }: SelectTriggerProps) {
  const ctx = React.useContext(SelectContext);
  return (
    <button
      type="button"
      className={className}
      data-size={size}
      data-variant={variant}
      onClick={() => ctx?.setOpen(!ctx.open)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext);
  return <span>{ctx?.value || placeholder || ""}</span>;
}

export function SelectContent({ children }: { children?: React.ReactNode }) {
  const ctx = React.useContext(SelectContext);
  if (!ctx?.open) return null;
  return <div className="absolute z-10 mt-1 rounded-md border bg-primary shadow-md">{children}</div>;
}

export function SelectItem({ value, children }: { value: string; children?: React.ReactNode }) {
  const ctx = React.useContext(SelectContext);
  return (
    <div
      role="option"
      className="cursor-pointer px-2 py-1 hover:opacity-70"
      onClick={() => {
        ctx?.onValueChange?.(value);
        ctx?.setOpen(false);
      }}
    >
      {children}
    </div>
  );
}

// ─── RadioGroup (minimal working implementation) ────────────────────────────

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps extends DivProps {
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: string;
}

export function RadioGroup({ value, onValueChange, orientation, className, children, ...rest }: RadioGroupProps) {
  const contextValue = React.useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
  return (
    <div role="radiogroup" data-orientation={orientation} className={className} {...rest}>
      <RadioGroupContext.Provider value={contextValue}>{children}</RadioGroupContext.Provider>
    </div>
  );
}

export function RadioGroupItem({ value, ...rest }: { value: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const ctx = React.useContext(RadioGroupContext);
  return (
    <input
      type="radio"
      checked={ctx?.value === value}
      onChange={() => ctx?.onValueChange?.(value)}
      {...rest}
    />
  );
}

// ─── Field / FieldGroup / FieldSet ──────────────────────────────────────────

export function FieldSet({ title, children, className }: { title?: React.ReactNode } & DivProps) {
  return (
    <fieldset className={className}>
      {title ? <legend className="font-medium">{title}</legend> : null}
      {children}
    </fieldset>
  );
}

export const FieldGroup = passthrough("div");

interface FieldProps extends DivProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export function Field({ label, description, className, children }: FieldProps) {
  return (
    <div className={className}>
      {label ? <div className="text-sm font-medium mb-1">{label}</div> : null}
      {children}
      {description ? <div className="text-xs text-secondary mt-1">{description}</div> : null}
    </div>
  );
}

// ─── Dialog (minimal working trigger + modal implementation) ───────────────

interface DialogProps {
  size?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  onConfirm?: () => void;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
}

export function Dialog({ title, description, confirmLabel, onConfirm, trigger, children }: DialogProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] max-w-md overflow-auto rounded-lg bg-primary p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            {title ? <h2 className="font-medium mb-1">{title}</h2> : null}
            {description ? <p className="text-sm text-secondary mb-3">{description}</p> : null}
            <div>{children}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm?.();
                  setOpen(false);
                }}
              >
                {confirmLabel ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─── App shell components ───────────────────────────────────────────────────

export function TooltipProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export const SplitView = passthrough("div");

export function Status({
  variant,
  children,
  className,
}: { variant?: string } & DivProps) {
  return (
    <span className={className} data-variant={variant}>
      {children}
    </span>
  );
}

interface ErrorBoundaryViewProps {
  error?: unknown;
}

export function ErrorBoundaryView({ error }: ErrorBoundaryViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="font-medium">Something went wrong</p>
      {error ? <pre className="max-w-full overflow-auto text-xs text-secondary">{String(error)}</pre> : null}
    </div>
  );
}
