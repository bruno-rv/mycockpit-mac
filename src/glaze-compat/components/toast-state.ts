import type React from "react";

type PromiseToastState = {
  type: "success" | "error" | "warning" | "info" | "loading";
  message: React.ReactNode;
  description?: string;
};

const promiseToasts = new Map<
  string | number,
  { setState?: (state: PromiseToastState) => void; pending?: PromiseToastState; disposed?: boolean }
>();

function updatePromiseToast(toastId: string | number, state: PromiseToastState) {
  const entry = promiseToasts.get(toastId);
  if (!entry || entry.disposed) return;
  if (entry.setState) {
    entry.setState(state);
  } else {
    entry.pending = state;
  }
}

export { promiseToasts, updatePromiseToast };
export type { PromiseToastState };
