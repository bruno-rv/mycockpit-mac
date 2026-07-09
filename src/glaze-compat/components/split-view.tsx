import * as React from "react";
import { createPortal } from "react-dom";
import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { cn, isMacOS27Plus } from "../utils";
import { Button, type ButtonProps } from "./button";
import { Panel, PanelGroup } from "./panel";
import { useSidebarContext } from "./sidebar-context";
import {
  SplitViewColumnContext,
  useSplitViewColumnContext,
  type SplitViewColumnContextValue,
} from "./split-view-column-context";
import { SplitViewContext, useSplitView, type SplitViewContextValue } from "./split-view-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const SIDEBAR_DEFAULT_SIZE = 200;
const SIDEBAR_MIN_SIZE = 180;
const SIDEBAR_MAX_SIZE = 300;

const LIST_DEFAULT_SIZE = 300;
const LIST_MIN_SIZE = 240;

const INSPECTOR_DEFAULT_SIZE = 280;
const INSPECTOR_MIN_SIZE = 240;

const TOGGLE_DURATION_MS = 200;
const TOGGLE_EASE_IN = "cubic-bezier(0.165, 0.84, 0.44, 1)";
const TOGGLE_EASE_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

type SlotSize = {
  default?: number;
  min?: number;
  max?: number;
};

type SplitViewProps = {
  /** Leftmost column (typically a `<Sidebar>`). */
  sidebar?: React.ReactNode;
  sidebarSize?: SlotSize;
  /** Controlled sidebar collapse state. */
  sidebarCollapsed?: boolean;
  /** Initial collapse state when uncontrolled. Persisted alongside `storageKey`. */
  defaultSidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  /** Browsing/selection column between `sidebar` and the primary column. */
  list?: React.ReactNode;
  listSize?: SlotSize;
  /** Primary column (always flex). */
  children: React.ReactNode;
  /** Trailing metadata/preview column. Apple calls this the "inspector" (Xcode, Pages). */
  inspector?: React.ReactNode;
  inspectorSize?: SlotSize;
  inspectorCollapsed?: boolean;
  defaultInspectorCollapsed?: boolean;
  onInspectorCollapsedChange?: (collapsed: boolean) => void;
  /** Scoped key for resize + collapse persistence. Must be unique when nesting. */
  storageKey?: string;
  className?: string;
};

/**
 * Mac-style split view. Slots render left-to-right: `sidebar` → `list` → `children` → `inspector`.
 * `children` is the flex column; other slots are fixed-size and resizable.
 *
 * Sidebar and inspector support animated collapse. `<SplitView.SidebarToggle />` and
 * `<SplitView.InspectorToggle />` are pre-wired buttons; `useSplitView()` exposes the same
 * state/actions anywhere in the tree. ⌃⌘S / ⌃⌘I are wired when a matching toggle is mounted.
 *
 * Nested `SplitView`s compose: only the overall leftmost column gets the window-control
 * inset, only the overall rightmost gets the Tahoe scrollbar clearance.
 */
function SplitView({
  sidebar,
  sidebarSize,
  sidebarCollapsed: sidebarCollapsedProp,
  defaultSidebarCollapsed = false,
  onSidebarCollapsedChange,
  list,
  listSize,
  children,
  inspector,
  inspectorSize,
  inspectorCollapsed: inspectorCollapsedProp,
  defaultInspectorCollapsed = false,
  onInspectorCollapsedChange,
  storageKey,
  className,
}: SplitViewProps) {
  const parent = useSplitViewColumnContext();
  const parentIsFirst = parent?.isFirst ?? true;
  const parentIsLast = parent?.isLast ?? true;
  const isOutermost = parent == null;

  const hasSidebar = sidebar != null;
  const hasList = list != null;
  const hasInspector = inspector != null;

  const collapseStorageKey = storageKey ? `${storageKey}-collapse` : undefined;
  const [persistedCollapse, setPersistedCollapse] = usePersistedCollapse(collapseStorageKey, {
    sidebar: defaultSidebarCollapsed,
    inspector: defaultInspectorCollapsed,
  });

  const [sidebarCollapsedState, setSidebarCollapsedState] = useControllable({
    value: sidebarCollapsedProp,
    defaultValue: persistedCollapse.sidebar,
    onChange: onSidebarCollapsedChange,
  });
  const [inspectorCollapsedState, setInspectorCollapsedState] = useControllable({
    value: inspectorCollapsedProp,
    defaultValue: persistedCollapse.inspector,
    onChange: onInspectorCollapsedChange,
  });

  const sidebarCollapsed = hasSidebar && sidebarCollapsedState;
  const inspectorCollapsed = hasInspector && inspectorCollapsedState;

  const setSidebarCollapsed = React.useCallback(
    (collapsed: boolean) => {
      setSidebarCollapsedState(collapsed);
      if (sidebarCollapsedProp === undefined) {
        setPersistedCollapse((prev) => ({ ...prev, sidebar: collapsed }));
      }
    },
    [setSidebarCollapsedState, setPersistedCollapse, sidebarCollapsedProp],
  );
  const setInspectorCollapsed = React.useCallback(
    (collapsed: boolean) => {
      setInspectorCollapsedState(collapsed);
      if (inspectorCollapsedProp === undefined) {
        setPersistedCollapse((prev) => ({ ...prev, inspector: collapsed }));
      }
    },
    [setInspectorCollapsedState, setPersistedCollapse, inspectorCollapsedProp],
  );
  const toggleSidebar = React.useCallback(
    () => setSidebarCollapsed(!sidebarCollapsed),
    [setSidebarCollapsed, sidebarCollapsed],
  );
  const toggleInspector = React.useCallback(
    () => setInspectorCollapsed(!inspectorCollapsed),
    [setInspectorCollapsed, inspectorCollapsed],
  );

  const [pinnedLeadingAnchor, setPinnedLeadingAnchor] = React.useState<HTMLDivElement | null>(null);
  const [pinnedTrailingAnchor, setPinnedTrailingAnchor] = React.useState<HTMLDivElement | null>(null);
  const [pinnedSidebarRefCount, setPinnedSidebarRefCount] = React.useState(0);
  const [sidebarToggleRefCount, setSidebarToggleRefCount] = React.useState(0);
  const [inspectorToggleRefCount, setInspectorToggleRefCount] = React.useState(0);
  const hasPinnedSidebarToggle = pinnedSidebarRefCount > 0;
  const hasSidebarToggle = sidebarToggleRefCount > 0;
  const hasInspectorToggle = inspectorToggleRefCount > 0;
  const registerPinnedSidebarToggle = React.useCallback(() => {
    setPinnedSidebarRefCount((n) => n + 1);
    return () => setPinnedSidebarRefCount((n) => n - 1);
  }, []);
  const registerSidebarToggle = React.useCallback(() => {
    setSidebarToggleRefCount((n) => n + 1);
    return () => setSidebarToggleRefCount((n) => n - 1);
  }, []);
  const registerInspectorToggle = React.useCallback(() => {
    setInspectorToggleRefCount((n) => n + 1);
    return () => setInspectorToggleRefCount((n) => n - 1);
  }, []);

  // Outermost SplitView only, and only if a toggle is actually mounted.
  React.useEffect(() => {
    if (!isOutermost) return;
    if (!hasSidebarToggle && !hasInspectorToggle) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey || !e.ctrlKey || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (hasSidebarToggle && key === "s") {
        e.preventDefault();
        toggleSidebar();
      } else if (hasInspectorToggle && key === "i") {
        e.preventDefault();
        toggleInspector();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOutermost, hasSidebarToggle, hasInspectorToggle, toggleSidebar, toggleInspector]);

  const contextValue = React.useMemo<SplitViewContextValue>(
    () => ({
      hasSidebar,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      hasInspector,
      inspectorCollapsed,
      setInspectorCollapsed,
      toggleInspector,
      pinnedAnchors: { leading: pinnedLeadingAnchor, trailing: pinnedTrailingAnchor },
      hasPinnedSidebarToggle,
      registerPinnedSidebarToggle,
      hasSidebarToggle,
      registerSidebarToggle,
      hasInspectorToggle,
      registerInspectorToggle,
    }),
    [
      hasSidebar,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      hasInspector,
      inspectorCollapsed,
      setInspectorCollapsed,
      toggleInspector,
      pinnedLeadingAnchor,
      pinnedTrailingAnchor,
      hasPinnedSidebarToggle,
      registerPinnedSidebarToggle,
      hasSidebarToggle,
      registerSidebarToggle,
      hasInspectorToggle,
      registerInspectorToggle,
    ],
  );

  let index = 0;
  const sidebarIndex = hasSidebar ? index++ : -1;
  const listIndex = hasList ? index++ : -1;
  const primaryIndex = index++;
  const inspectorIndex = hasInspector ? index : -1;

  // A collapsed sidebar/inspector cedes `isFirst` / `isLast` to the next visible column so
  // the traffic-light inset and Tahoe scroll clearance seamlessly reassign.
  const visibleIndices: number[] = [];
  if (hasSidebar && !sidebarCollapsed) visibleIndices.push(sidebarIndex);
  if (hasList) visibleIndices.push(listIndex);
  visibleIndices.push(primaryIndex);
  if (hasInspector && !inspectorCollapsed) visibleIndices.push(inspectorIndex);
  const firstVisible = visibleIndices[0];
  const lastVisible = visibleIndices[visibleIndices.length - 1];

  // `data-split-view-mounting` lives on the root for one frame; the CSS rule in
  // `styles.css` kills descendant transitions while the pinned toggle's effect flips
  // `hasPinnedSidebarToggle` and the toolbar padding snaps into place.
  const [mountAnimationsReady, setMountAnimationsReady] = React.useState(false);
  React.useLayoutEffect(() => {
    if (mountAnimationsReady) return;
    const raf = requestAnimationFrame(() => setMountAnimationsReady(true));
    return () => cancelAnimationFrame(raf);
  }, [mountAnimationsReady]);
  // Direction-aware so the toolbar inset slides in step with the panel's flex-basis.
  const toolbarInsetEase = sidebarCollapsed ? TOGGLE_EASE_OUT : TOGGLE_EASE_IN;
  const insetTransition = `padding ${TOGGLE_DURATION_MS}ms ${toolbarInsetEase}`;

  const columnValue = (index: number): SplitViewColumnContextValue => {
    const isFirst = index === firstVisible && parentIsFirst;
    const isLast = index === lastVisible && parentIsLast;
    // A pinned sidebar toggle on an *outer* SplitView still obscures this nested
    // SplitView's leading column, so propagate `windowControlsAndButton` down via the
    // parent column context. Inherit the parent's transition too so the inset easing
    // stays in lockstep with whichever SplitView's collapse actually triggered it.
    const parentWantsButton = parent?.insetHint === "windowControlsAndButton";
    let hint: SplitViewColumnContextValue["insetHint"] = "none";
    let transition = insetTransition;
    if (isFirst) {
      hint = hasPinnedSidebarToggle || parentWantsButton ? "windowControlsAndButton" : "windowControls";
      if (parentWantsButton && !hasPinnedSidebarToggle && parent?.insetTransition) {
        transition = parent.insetTransition;
      }
    }
    return { isFirst, isLast, insetHint: hint, insetTransition: transition };
  };

  return (
    <SplitViewContext.Provider value={contextValue}>
      <div
        className={cn("relative h-full", className)}
        data-split-view-mounting={mountAnimationsReady ? undefined : ""}
      >
        <PanelGroup storageKey={storageKey}>
          {hasSidebar && (
            <Panel
              defaultSize={sidebarSize?.default ?? SIDEBAR_DEFAULT_SIZE}
              minSize={sidebarSize?.min ?? SIDEBAR_MIN_SIZE}
              maxSize={sidebarSize?.max ?? SIDEBAR_MAX_SIZE}
              hidden={sidebarCollapsed}
              anchor="end"
            >
              <SplitViewColumnContext.Provider value={columnValue(sidebarIndex)}>
                <div className="size-full *:h-full">{sidebar}</div>
              </SplitViewColumnContext.Provider>
            </Panel>
          )}
          {hasList && (
            <Panel
              defaultSize={listSize?.default ?? LIST_DEFAULT_SIZE}
              minSize={listSize?.min ?? LIST_MIN_SIZE}
              maxSize={listSize?.max}
            >
              <SplitViewColumnContext.Provider value={columnValue(listIndex)}>
                <div className="size-full *:h-full">{list}</div>
              </SplitViewColumnContext.Provider>
            </Panel>
          )}
          <Panel>
            <SplitViewColumnContext.Provider value={columnValue(primaryIndex)}>
              <div className="size-full *:h-full">{children}</div>
            </SplitViewColumnContext.Provider>
          </Panel>
          {hasInspector && (
            <Panel
              defaultSize={inspectorSize?.default ?? INSPECTOR_DEFAULT_SIZE}
              minSize={inspectorSize?.min ?? INSPECTOR_MIN_SIZE}
              maxSize={inspectorSize?.max}
              hidden={inspectorCollapsed}
            >
              <SplitViewColumnContext.Provider value={columnValue(inspectorIndex)}>
                <div className="size-full *:h-full">{inspector}</div>
              </SplitViewColumnContext.Provider>
            </Panel>
          )}
        </PanelGroup>
        {/* Portal targets for `pinned` toggles. Leading sits past the traffic-light inset
            (80px + 10px gap); the 36×52 slot + `justify-center` keeps the pill center steady
            as it morphs 28 ↔ 36. */}
        <div
          ref={setPinnedLeadingAnchor}
          aria-hidden
          className="absolute top-0 left-[90px] w-9 h-13 flex items-center justify-center z-30 pointer-events-none [&>*]:pointer-events-auto"
        />
        <div
          ref={setPinnedTrailingAnchor}
          aria-hidden
          className="absolute top-0 right-0 h-13 flex items-center justify-end gap-2 pr-3 z-30 pointer-events-none [&>*]:pointer-events-auto"
        />
      </div>
    </SplitViewContext.Provider>
  );
}

type SplitViewToggleProps = Omit<ButtonProps, "aria-pressed" | "aria-label" | "onClick" | "children"> & {
  "aria-label"?: string;
  children?: React.ReactNode;
  /**
   * Default `true`: portals the button to a fixed anchor at the SplitView frame's
   * leading / trailing edge so it stays in the same pixel position whether the panel
   * is open or collapsed (Xcode / Mail / Pages behavior).
   *
   * Pass `pinned={false}` to render the button inline at its JSX location instead —
   * useful for toggles that should sit alongside other toolbar actions. Note that a
   * non-pinned `SidebarToggle` placed inside `Sidebar.actions` disappears when the
   * sidebar collapses (the whole panel is hidden), so users can only re-open via the
   * keyboard shortcut.
   */
  pinned?: boolean;
};

const SIDEBAR_SHORTCUT = ["⌃", "⌘", "S"];
const INSPECTOR_SHORTCUT = ["⌃", "⌘", "I"];

const SidebarToggle = React.forwardRef<HTMLButtonElement, SplitViewToggleProps>(
  ({ variant, size, iconOnly = true, className, children, pinned = true, ...props }, ref) => {
    const {
      hasSidebar,
      sidebarCollapsed,
      toggleSidebar,
      pinnedAnchors,
      registerPinnedSidebarToggle,
      registerSidebarToggle,
    } = useSplitView();
    const inSidebar = useSidebarContext();

    React.useEffect(() => registerSidebarToggle(), [registerSidebarToggle]);
    // Layout-effect so the toolbar's padding lands before the first paint; otherwise
    // it flashes `windowControls` for a frame before updating to `windowControlsAndButton`.
    React.useLayoutEffect(() => {
      if (!pinned) return;
      return registerPinnedSidebarToggle();
    }, [pinned, registerPinnedSidebarToggle]);

    if (!hasSidebar) return null;

    let resolvedVariant = variant;
    let resolvedSize = size;
    let pillSize = 36;
    if (isMacOS27Plus()) {
      resolvedVariant = "glass";
      resolvedSize = "large";
    } else {
      resolvedVariant = variant ?? (pinned || inSidebar ? "transparent" : "glass");
      resolvedSize = size ?? (pinned || inSidebar ? "small" : "large");
      pillSize = sidebarCollapsed ? 36 : 28;
    }

    const label = props["aria-label"] ?? (sidebarCollapsed ? "Show sidebar" : "Hide sidebar");
    const iconNode = children ?? <PanelLeftIcon className="size-4.5 text-primary" />;

    const button = (
      <Button
        ref={ref}
        variant={resolvedVariant}
        size={resolvedSize}
        iconOnly={iconOnly}
        className={cn(pinned && "relative", className)}
        aria-label={label}
        aria-pressed={!sidebarCollapsed}
        onClick={toggleSidebar}
        {...props}
        style={
          pinned
            ? {
                width: pillSize,
                height: pillSize,
                // Includes `background-color` + `color` so Button's hover fade still works
                // — this inline `transition` fully replaces the base `transition-colors`.
                transition: ["width", "height", "background-color", "color"]
                  .map((p) => `${p} ${TOGGLE_DURATION_MS}ms ${TOGGLE_EASE_IN}`)
                  .join(", "),
              }
            : undefined
        }
      >
        {pinned ? (
          <span
            aria-hidden
            className="bg-glass absolute inset-0 rounded-full pointer-events-none"
            style={{
              opacity: sidebarCollapsed ? 1 : 0,
              transition: `opacity ${TOGGLE_DURATION_MS}ms ${TOGGLE_EASE_IN}`,
            }}
          />
        ) : (
          iconNode
        )}
      </Button>
    );
    // Static label: the native tooltip doesn't resize if its text changes mid-hover.
    const buttonWithTooltip = (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent shortcut={SIDEBAR_SHORTCUT}>Toggle Sidebar</TooltipContent>
      </Tooltip>
    );

    if (pinned) {
      if (!pinnedAnchors.leading) return null;
      // Icon is a sibling of the button, centered in the fixed-size anchor — centering
      // it inside the morphing button caused subpixel jitter each frame.
      return createPortal(
        <>
          {buttonWithTooltip}
          <span
            aria-hidden
            className="dimmable absolute inset-0 flex items-center justify-center"
            style={{ pointerEvents: "none" }}
          >
            {iconNode}
          </span>
        </>,
        pinnedAnchors.leading,
      );
    }
    return buttonWithTooltip;
  },
);
SidebarToggle.displayName = "SplitView.SidebarToggle";

const InspectorToggle = React.forwardRef<HTMLButtonElement, SplitViewToggleProps>(
  ({ variant, size, iconOnly = true, className, children, pinned = true, ...props }, ref) => {
    const { hasInspector, inspectorCollapsed, toggleInspector, pinnedAnchors, registerInspectorToggle } =
      useSplitView();
    const inSidebar = useSidebarContext();

    React.useEffect(() => registerInspectorToggle(), [registerInspectorToggle]);

    if (!hasInspector) return null;
    const resolvedVariant = variant ?? (inSidebar && !pinned ? "transparent" : "glass");
    const resolvedSize = size ?? (inSidebar && !pinned ? "small" : "large");
    const label = props["aria-label"] ?? (inspectorCollapsed ? "Show inspector" : "Hide inspector");
    const button = (
      <Button
        ref={ref}
        variant={resolvedVariant}
        size={resolvedSize}
        iconOnly={iconOnly}
        className={className}
        aria-label={label}
        aria-pressed={!inspectorCollapsed}
        onClick={toggleInspector}
        {...props}
      >
        {children ?? <PanelRightIcon className={cn(resolvedSize === "large" ? "size-4.5" : "size-4")} />}
      </Button>
    );
    const buttonWithTooltip = (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent shortcut={INSPECTOR_SHORTCUT}>Toggle Inspector</TooltipContent>
      </Tooltip>
    );
    if (pinned) {
      if (!pinnedAnchors.trailing) return null;
      return createPortal(buttonWithTooltip, pinnedAnchors.trailing);
    }
    return buttonWithTooltip;
  },
);
InspectorToggle.displayName = "SplitView.InspectorToggle";

SplitView.SidebarToggle = SidebarToggle;
SplitView.InspectorToggle = InspectorToggle;

type PersistedCollapse = { sidebar: boolean; inspector: boolean };

function usePersistedCollapse(
  storageKey: string | undefined,
  defaults: PersistedCollapse,
): [PersistedCollapse, React.Dispatch<React.SetStateAction<PersistedCollapse>>] {
  const [state, setState] = React.useState<PersistedCollapse>(() => {
    if (!storageKey) return defaults;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        sidebar: typeof parsed?.sidebar === "boolean" ? parsed.sidebar : defaults.sidebar,
        inspector: typeof parsed?.inspector === "boolean" ? parsed.inspector : defaults.inspector,
      };
    } catch {
      return defaults;
    }
  });

  const setAndPersist: React.Dispatch<React.SetStateAction<PersistedCollapse>> = React.useCallback(
    (update) => {
      setState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // ignore storage errors (quota, disabled storage, etc.)
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  return [state, setAndPersist];
}

function useControllable<T>({
  value,
  defaultValue,
  onChange,
}: {
  value: T | undefined;
  defaultValue: T;
  onChange?: (next: T) => void;
}): [T, (next: T) => void] {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<T>(defaultValue);
  const current = isControlled ? (value as T) : internal;
  const set = React.useCallback(
    (next: T) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  return [current, set];
}

export { SplitView };
export type { SplitViewProps, SlotSize };
