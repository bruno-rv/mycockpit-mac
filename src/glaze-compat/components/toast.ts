import { createElement, type ReactNode } from "react";

import { toast as sonnerToast, type ExternalToast } from "sonner";

import { Toast, PromiseToast, type ToastAction } from "./sonner";
import { promiseToasts, updatePromiseToast } from "./toast-state";

type ToastType = "success" | "error" | "warning" | "info" | "loading";

function extractAction(opt: ExternalToast["action"] | ExternalToast["cancel"]): ToastAction | undefined {
  return opt && typeof opt === "object" && "label" in opt ? (opt as ToastAction) : undefined;
}

function createToast(type: ToastType, message: ReactNode, options?: ExternalToast) {
  const action = extractAction(options?.action);
  const cancel = extractAction(options?.cancel);
  const description = options?.description != null ? (options.description as ReactNode) : undefined;
  const actions = [action, cancel].filter((a): a is ToastAction => a != null);

  const { action: _a, cancel: _c, description: _d, ...restOptions } = options ?? {};
  const duration = restOptions.duration ?? (type === "loading" ? Infinity : 4000);

  return sonnerToast.custom(
    (id) =>
      createElement(Toast, {
        id,
        type,
        title: message,
        description,
        actions: actions.length > 0 ? actions : undefined,
      }),
    { ...restOptions, duration },
  );
}

interface PromiseResult {
  message: ReactNode;
  description?: string;
}

type PromiseStateResult<T = unknown> =
  | ReactNode
  | PromiseResult
  | ((data: T) => ReactNode | PromiseResult | Promise<ReactNode | PromiseResult>);

interface PromiseOptions<T> extends Omit<ExternalToast, "description"> {
  loading?: ReactNode;
  success?: PromiseStateResult<T>;
  error?: PromiseStateResult;
  finally?: () => void | Promise<void>;
}

function resolvePromiseResult(result: ReactNode | PromiseResult): {
  message: ReactNode;
  description?: string;
} {
  if (typeof result === "object" && result !== null && "message" in result) {
    const r = result as PromiseResult;
    return { message: r.message, description: r.description };
  }
  return { message: result };
}

function toastPromise<T>(promise: Promise<T> | (() => Promise<T>), options: PromiseOptions<T>) {
  const p = typeof promise === "function" ? promise() : promise;
  const { loading, success, error, finally: finallyFn, ...restOptions } = options;

  const toastId = sonnerToast.custom(
    (id) => createElement(PromiseToast, { id, initialMessage: loading ?? "Loading..." }),
    {
      ...restOptions,
      duration: Infinity,
    },
  );

  promiseToasts.set(toastId, {});

  const autoDismiss = () => {
    const ms = restOptions.duration ?? 4000;
    if (ms !== Infinity) {
      setTimeout(() => sonnerToast.dismiss(toastId), ms);
    }
  };

  p.then(
    async (data) => {
      if (success) {
        const result = typeof success === "function" ? await success(data) : success;
        const { message, description } = resolvePromiseResult(result);
        updatePromiseToast(toastId, { type: "success", message, description });
        autoDismiss();
      } else {
        sonnerToast.dismiss(toastId);
      }
    },
    async (err) => {
      if (error) {
        const result = typeof error === "function" ? await (error as (e: unknown) => unknown)(err) : error;
        const { message, description } = resolvePromiseResult(result as ReactNode | PromiseResult);
        updatePromiseToast(toastId, { type: "error", message, description });
        autoDismiss();
      } else {
        sonnerToast.dismiss(toastId);
      }
    },
  ).finally(finallyFn);

  return toastId;
}

const toast = Object.assign((message: ReactNode, options?: ExternalToast) => createToast("info", message, options), {
  success: (message: ReactNode, options?: ExternalToast) => createToast("success", message, options),
  error: (message: ReactNode, options?: ExternalToast) => createToast("error", message, options),
  warning: (message: ReactNode, options?: ExternalToast) => createToast("warning", message, options),
  info: (message: ReactNode, options?: ExternalToast) => createToast("info", message, options),
  loading: (message: ReactNode, options?: ExternalToast) => createToast("loading", message, options),
  promise: toastPromise,
  dismiss: sonnerToast.dismiss as typeof sonnerToast.dismiss,
  custom: sonnerToast.custom as typeof sonnerToast.custom,
  message: sonnerToast.message as typeof sonnerToast.message,
});

export { toast };
