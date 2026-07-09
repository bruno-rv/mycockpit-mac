import { createContext, useContext } from "react";

type SplitViewContextValue = {
  hasSidebar: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  hasInspector: boolean;
  inspectorCollapsed: boolean;
  setInspectorCollapsed: (collapsed: boolean) => void;
  toggleInspector: () => void;
  /** Portal targets for `pinned` toggles. State (not refs) so consumers re-render
   *  once the target is attached. */
  pinnedAnchors: {
    leading: HTMLDivElement | null;
    trailing: HTMLDivElement | null;
  };
  /** Set while a pinned sidebar toggle is mounted. Widens the primary toolbar's inset. */
  hasPinnedSidebarToggle: boolean;
  registerPinnedSidebarToggle: () => () => void;
  /** Set while any sidebar/inspector toggle is mounted. Gates ⌃⌘S / ⌃⌘I. */
  hasSidebarToggle: boolean;
  registerSidebarToggle: () => () => void;
  hasInspectorToggle: boolean;
  registerInspectorToggle: () => () => void;
};

const SplitViewContext = createContext<SplitViewContextValue | null>(null);

function useSplitView(): SplitViewContextValue {
  const ctx = useContext(SplitViewContext);
  if (!ctx) {
    throw new Error("useSplitView must be used inside a <SplitView>.");
  }
  return ctx;
}

export { SplitViewContext, useSplitView };
export type { SplitViewContextValue };
