import * as React from "react";

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { toast as sonnerToast, Toaster as Sonner, type ToasterProps } from "sonner";

import { Button } from "./button";
import { cn } from "../utils";
import { Text } from "./text";
import { promiseToasts, type PromiseToastState } from "./toast-state";

type ToastType = "success" | "error" | "warning" | "info" | "loading";

const icons: Record<ToastType, React.ReactNode> = {
  success: <CircleCheckIcon className="size-4 shrink-0" />,
  info: <InfoIcon className="size-4 shrink-0" />,
  warning: <TriangleAlertIcon className="size-4 shrink-0" />,
  error: <OctagonXIcon className="size-4 shrink-0" />,
  loading: <Loader2Icon className="size-4 shrink-0 animate-spin" />,
};

const typeColors: Record<ToastType, string> = {
  success: "text-support-green",
  error: "text-support-red",
  warning: "text-support-yellow",
  info: "text-secondary",
  loading: "text-secondary",
};

interface ToastAction {
  label: string;
  onClick?: () => void;
}

interface ToastProps {
  id: string | number;
  type: ToastType;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: ToastAction[];
}

function ToastActionButton({ id, action }: { id: string | number; action: ToastAction }) {
  return (
    <Button
      variant="filled"
      size="small"
      onClick={() => {
        action.onClick?.();
        sonnerToast.dismiss(id);
      }}
    >
      {action.label}
    </Button>
  );
}

function Toast({ id, type, title, description, actions }: ToastProps) {
  return (
    <div className="relative group/toast isolate">
      <button
        aria-label="Dismiss toast"
        className="absolute z-10 -top-1 -right-1 size-5 rounded-pill bg-popover border border-secondary opacity-0 group-hover/toast:opacity-100 transition-opacity hover:bg-popover-hover"
        onClick={() => sonnerToast.dismiss(id)}
      >
        <XIcon className="size-3 text-secondary absolute inset-0 m-auto" />
      </button>
      <div
        className="bg-glass-toast flex w-full items-center gap-2.5 px-4 py-3 mx-auto"
        style={{ borderRadius: "min(9999px, 1.5rem + 0.5lh)" }}
      >
        <div className={cn("min-h-7 flex items-center", typeColors[type])}>{icons[type]}</div>
        <div className="min-w-0 flex-1 min-h-7 flex flex-col justify-center">
          <Text as="p" variant="strong" truncate>
            {title}
          </Text>
          {description && (
            <Text as="p" color="secondary" className="mr-1">
              {description}
            </Text>
          )}
        </div>
        {actions?.map((action) => (
          <ToastActionButton key={action.label} id={id} action={action} />
        ))}
      </div>
    </div>
  );
}

/**
 * Native-coupling fix (PORT_PLAN 2.1): the SDK's `Toaster` reads dark/light from
 * `../hooks/use-theme`, which returns a live `boolean` synced off the native `nativeTheme`
 * IPC handler. The Phase-1/2.2 compat `useTheme` (src/glaze-compat/hooks/index.ts) has a
 * different, side-effect-only signature (it just toggles the `.dark` class on `<html>` and
 * returns `void`) — reused as-is by root-view.tsx. Rather than change that hook's public
 * shape, this reads the same `.dark` class it applies via a tiny local observer.
 */
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = React.useState(() => document.documentElement.classList.contains("dark"));

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

const Toaster = (props: ToasterProps) => {
  const isDarkMode = useIsDarkMode();

  return (
    <Sonner
      theme={isDarkMode ? "dark" : "light"}
      className="toaster group z-50"
      position="bottom-center"
      expand
      style={
        {
          "--normal-text": "var(--color-text-primary)",
          "--normal-border": "var(--color-border-secondary)",
          "--border-radius": "18px",
        } as ToasterProps["style"]
      }
      icons={icons}
      toastOptions={{
        classNames: {
          toast: "shadow-none!",
        },
      }}
      {...props}
    />
  );
};

function PromiseToast({ id, initialMessage }: { id: string | number; initialMessage: React.ReactNode }) {
  const [state, setState] = React.useState<PromiseToastState>({ type: "loading", message: initialMessage });

  React.useEffect(() => {
    let entry = promiseToasts.get(id);
    if (!entry) {
      entry = {};
      promiseToasts.set(id, entry);
    }
    entry.setState = setState;
    entry.disposed = false;
    if (entry.pending) {
      setState(entry.pending);
      entry.pending = undefined;
    }
    return () => {
      promiseToasts.delete(id);
    };
  }, [id]);

  return (
    <Toast
      id={id}
      type={state.type}
      title={state.message}
      description={state.type !== "loading" ? state.description : undefined}
    />
  );
}

export { Toast, Toaster, PromiseToast };
export type { ToastProps, ToastType, ToastAction };
