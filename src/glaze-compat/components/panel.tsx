import React, { useState, useRef, useCallback, useLayoutEffect } from "react";
import { cn } from "../utils";
import { PanelContext } from "./panel-context";
import { SplitViewColumnContext } from "./split-view-column-context";

const PANEL_COLLAPSE_DURATION_MS = 200;
const PANEL_COLLAPSE_EASE_IN = "cubic-bezier(0.165, 0.84, 0.44, 1)";
const PANEL_COLLAPSE_EASE_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

type PanelGroupProps = {
  children: React.ReactNode;
  orientation?: "horizontal" | "vertical";
  className?: string;
  onChange?: (sizes: number[]) => void;
  onResizeStateChange?: (isDragging: boolean) => void;
  storageKey?: string;
};

type PanelProps = {
  children: React.ReactNode;
  minSize?: number;
  maxSize?: number;
  defaultSize?: number;
  className?: string;
  hidden?: boolean;
  style?: React.CSSProperties;
  /**
   * Which edge the contents stay anchored to when the panel collapses. Combined with the
   * `min-width` on the inner wrapper, this produces the "content slides out of view in one
   * direction" effect (no squishing). `"start"` (default) keeps content pinned to the leading
   * edge — natural for trailing panels like inspectors. `"end"` pins it to the trailing edge —
   * use for leading panels like sidebars, so the right edge stays visible while the left side
   * gets cut off as the panel collapses.
   */
  anchor?: "start" | "end";
};

// Match by displayName, not `child.type === Panel`: reference equality breaks after HMR.
function isPanelElement(child: unknown): child is React.ReactElement<PanelProps> {
  return (
    React.isValidElement(child) &&
    typeof child.type === "function" &&
    (child.type as { displayName?: string }).displayName === "Panel"
  );
}

type ResizeHandleProps = {
  onResize: (delta: number, isDragStart?: boolean, isDragEnd?: boolean) => void;
  orientation: "horizontal" | "vertical";
  isDragging: boolean;
};

// Panel is flex if no defaultSize
const isFlexPanel = (props: PanelProps) => props.defaultSize === undefined;

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

const ResizeHandle = ({ onResize, orientation, isDragging }: ResizeHandleProps) => {
  const startPosRef = useRef(0);
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startPosRef.current = orientation === "horizontal" ? e.clientX : e.clientY;
      onResize(0, true, false);

      document.body.style.cursor = orientation === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (e: MouseEvent) => {
        const currentPos = orientation === "horizontal" ? e.clientX : e.clientY;
        const delta = currentPos - startPosRef.current;
        startPosRef.current = currentPos;
        onResize(delta);
      };

      const handleMouseUp = () => {
        onResize(0, false, true);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [orientation, onResize],
  );

  const highlighted = isDragging;

  return (
    <div
      className={cn("resize-handle flex-shrink-0 relative", orientation === "horizontal" ? "w-px" : "h-px")}
      style={{
        backgroundColor: highlighted ? "var(--panel-border-hover, var(--panel-border))" : "var(--panel-border)",
        transition: "background-color 300ms ease",
        maskImage:
          orientation === "horizontal"
            ? "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)"
            : "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
        WebkitMaskImage:
          orientation === "horizontal"
            ? "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)"
            : "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
      }}
      data-resize-handle
    >
      <div
        className={cn(
          "absolute z-10",
          orientation === "horizontal"
            ? "w-2 h-full cursor-col-resize -left-1 top-0 active:w-10 active:-left-5"
            : "h-2 w-full cursor-row-resize -top-1 left-0 active:h-10 active:-top-5",
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

type StoredSizes = Record<string, number>;

const parseStoredSizes = (stored: string, panels: React.ReactElement<PanelProps>[]): StoredSizes | null => {
  try {
    const parsed = JSON.parse(stored);
    const entries = Array.isArray(parsed)
      ? parsed.map((size, i) => [String(i), size] as [string, unknown])
      : Object.entries(parsed);
    const result: StoredSizes = {};
    for (const [k, v] of entries) {
      const i = parseInt(k, 10);
      if (!isNaN(i) && typeof v === "number" && panels[i] && !isFlexPanel(panels[i].props)) {
        result[i] = clamp(v, panels[i].props.minSize ?? 50, panels[i].props.maxSize ?? Infinity);
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
};

// Build initial sizes (numeric pixels) from localStorage + panel defaults. Flex panels get no
// entry. Callers should look up per-index; missing entries fall back to 0.
const initialSizes = (panels: React.ReactElement<PanelProps>[], storageKey: string): Record<number, number> => {
  const sizes: Record<number, number> = {};
  let stored: StoredSizes | null = null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) stored = parseStoredSizes(raw, panels);
  } catch {
    // Ignore — fall back to defaults
  }
  panels.forEach((panel, i) => {
    if (isFlexPanel(panel.props)) return;
    sizes[i] = stored?.[i] ?? panel.props.defaultSize ?? 200;
  });
  return sizes;
};

const PanelGroup = ({
  children,
  orientation = "horizontal",
  className,
  onChange,
  onResizeStateChange,
  storageKey,
}: PanelGroupProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const panels: React.ReactElement<PanelProps>[] = [];
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child)) continue;
    if (!isPanelElement(child)) {
      const typeName =
        typeof child.type === "string"
          ? child.type
          : ((child.type as { displayName?: string; name?: string })?.displayName ??
            (child.type as { displayName?: string; name?: string })?.name ??
            "Unknown");
      throw new Error(
        `PanelGroup children must be <Panel> elements, got <${typeName}>. ` +
          `Move it outside PanelGroup or render it inside a Panel's children.`,
      );
    }
    panels.push(child);
  }

  const effectiveStorageKey = storageKey ? `${storageKey}-${panels.length}` : `panel-sizes-${panels.length}`;

  // Numeric pixel sizes per panel index. Flex panels have no entry.
  // State drives the rendered flex-basis (so collapse/expand transitions between concrete
  // pixel values). A ref shadows the state so the drag handler can update sizes imperatively
  // without re-rendering on every mousemove; the final size is committed to state on drag end.
  const [sizes, setSizes] = useState<Record<number, number>>(() => initialSizes(panels, effectiveStorageKey));
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;

  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  // Rebuild `sizes` when panel count or defaults change — e.g. adding/removing a column.
  const panelStructureKey = panels.map((p, i) => `${i}:${p.props.defaultSize ?? "flex"}`).join("|");
  const prevStructureKeyRef = useRef(panelStructureKey);
  useLayoutEffect(() => {
    if (prevStructureKeyRef.current === panelStructureKey) return;
    prevStructureKeyRef.current = panelStructureKey;
    setSizes(initialSizes(panelsRef.current, effectiveStorageKey));
  }, [panelStructureKey, effectiveStorageKey]);

  // Enable transitions one frame after mount so the very first paint doesn't animate from
  // the pre-layout value to the resolved size.
  useLayoutEffect(() => {
    if (hasMounted) return;
    const raf = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [hasMounted]);

  const persistSizes = useCallback(
    (next: Record<number, number>) => {
      try {
        localStorage.setItem(effectiveStorageKey, JSON.stringify(next));
      } catch {
        // Ignore
      }
    },
    [effectiveStorageKey],
  );

  const getFlexBasisFor = (panelIndex: number): string => {
    return `${sizesRef.current[panelIndex] ?? 0}px`;
  };

  const handleResize = useCallback(
    (panelIndex: number, delta: number, isDragStart?: boolean, isDragEnd?: boolean) => {
      const container = containerRef.current;
      const currentPanels = panelsRef.current;
      if (!container) return;

      const left = currentPanels[panelIndex];
      const right = currentPanels[panelIndex + 1];
      if (!left || !right || left.props.hidden || right.props.hidden) return;

      if (isDragStart) {
        setIsDragging(true);
        onResizeStateChange?.(true);
        return;
      }

      if (isDragEnd) {
        setIsDragging(false);
        onResizeStateChange?.(false);
        const next = { ...sizesRef.current };
        setSizes(next);
        persistSizes(next);
        if (onChange) {
          const allSizes = currentPanels.map((panel, i) => {
            if (panel.props.hidden) return 0;
            if (isFlexPanel(panel.props)) {
              const el = container.querySelector(`[data-panel-index="${i}"]`) as HTMLElement;
              return el ? (orientation === "horizontal" ? el.offsetWidth : el.offsetHeight) : 0;
            }
            return next[i] ?? 0;
          });
          onChange(allSizes);
        }
        return;
      }

      // During drag: mutate the ref + imperatively update element.style.flexBasis so the user
      // sees smooth resizing without the cost of re-rendering React every mousemove.
      const sizeKey = orientation === "horizontal" ? "clientWidth" : "clientHeight";
      const leftFlex = isFlexPanel(left.props);
      const rightFlex = isFlexPanel(right.props);

      const otherFixedTotal = (excludeIndex: number) =>
        currentPanels.reduce((acc, p, i) => {
          if (i === excludeIndex || isFlexPanel(p.props)) return acc;
          return acc + (sizesRef.current[i] ?? 0);
        }, 0);

      const applySize = (index: number, nextSize: number) => {
        sizesRef.current = { ...sizesRef.current, [index]: nextSize };
        const el = container.querySelector(`[data-panel-index="${index}"]`) as HTMLElement | null;
        if (el) el.style.flexBasis = `${nextSize}px`;
      };

      if (!leftFlex) {
        const current = sizesRef.current[panelIndex] ?? 0;
        const min = left.props.minSize ?? 50;
        const max = left.props.maxSize ?? Infinity;
        let maxAllowed = max;
        if (rightFlex && right.props.minSize) {
          const containerSize = container[sizeKey];
          maxAllowed = Math.min(
            max,
            containerSize - otherFixedTotal(panelIndex) - right.props.minSize - currentPanels.length,
          );
        }
        applySize(panelIndex, clamp(current + delta, min, maxAllowed));
      }

      if (!rightFlex) {
        const current = sizesRef.current[panelIndex + 1] ?? 0;
        const min = right.props.minSize ?? 50;
        const max = right.props.maxSize ?? Infinity;
        let maxAllowed = max;
        if (leftFlex && left.props.minSize) {
          const containerSize = container[sizeKey];
          maxAllowed = Math.min(
            max,
            containerSize - otherFixedTotal(panelIndex + 1) - left.props.minSize - currentPanels.length,
          );
        }
        applySize(panelIndex + 1, clamp(current - delta, min, maxAllowed));
      }
    },
    [orientation, onResizeStateChange, onChange, persistSizes],
  );

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full w-full panel-sidebar-dividers", orientation === "vertical" && "flex-col", className)}
    >
      {panels.map((panel, index) => {
        const flex = isFlexPanel(panel.props);
        const minProp = orientation === "horizontal" ? "minWidth" : "minHeight";
        const flexBasis = flex ? "0%" : panel.props.hidden ? "0px" : getFlexBasisFor(index);
        const panelStyle: React.CSSProperties = flex
          ? { flexGrow: 1, flexShrink: 1, flexBasis, [minProp]: panel.props.minSize ?? 0 }
          : { flexGrow: 0, flexShrink: 0, flexBasis };
        // Direction-aware easing: `OUT` when collapsing (hidden just flipped to true) and `IN`
        // when expanding. The curve's active at the moment the basis changes, so the transition
        // fires with the right feel — pulling away vs settling into place.
        const collapseEase = panel.props.hidden ? PANEL_COLLAPSE_EASE_OUT : PANEL_COLLAPSE_EASE_IN;
        const transitionValue =
          hasMounted && !isDragging ? `flex-basis ${PANEL_COLLAPSE_DURATION_MS}ms ${collapseEase}` : undefined;
        // During collapse/expand we want the panel's contents to keep their natural width
        // instead of squishing with flex-basis (Apple's behavior — content appears to slide
        // out, the box doesn't reflow under it). The inner wrapper takes a `min-width` equal
        // to the panel's last-known expanded size; when the outer shrinks below that during
        // the transition the inner refuses to shrink and the outer's `overflow-hidden` clips
        // it. We skip `min-width` during drag so live resizing does reflow content naturally.
        const naturalSize = !flex ? (sizesRef.current[index] ?? panel.props.defaultSize ?? 200) : undefined;
        const innerMinSize = naturalSize && !isDragging ? naturalSize : undefined;
        return (
          <React.Fragment key={index}>
            <PanelContext.Provider
              value={{
                panelIndex: index,
                isFirstPanel: index === 0,
                isLastPanel: index === panels.length - 1,
                orientation,
              }}
            >
              <div
                data-panel-index={index}
                data-panel-flex={flex ? "true" : undefined}
                className={cn(
                  "panel-wrapper min-w-0",
                  !flex && "flex-shrink-0 flex",
                  !flex && (panel.props.anchor === "end" ? "justify-end" : "justify-start"),
                )}
                style={{ ...panelStyle, transition: transitionValue }}
              >
                <div
                  className="h-full w-full"
                  style={{
                    [orientation === "horizontal" ? "minWidth" : "minHeight"]: innerMinSize
                      ? `${innerMinSize}px`
                      : undefined,
                    opacity: panel.props.hidden ? 0 : 1,
                    pointerEvents: panel.props.hidden ? "none" : isDragging ? "none" : undefined,
                    transition: hasMounted ? `opacity ${PANEL_COLLAPSE_DURATION_MS}ms ${collapseEase}` : undefined,
                  }}
                >
                  <SplitViewColumnContext.Provider value={null}>
                    {React.cloneElement(panel, {
                      ...panel.props,
                      className: cn("h-full w-full", panel.props.className),
                    })}
                  </SplitViewColumnContext.Provider>
                </div>
              </div>
            </PanelContext.Provider>
            {index < panels.length - 1 && !panel.props.hidden && !panels[index + 1]?.props.hidden && (
              <ResizeHandle
                onResize={(delta, isDragStart, isDragEnd) => handleResize(index, delta, isDragStart, isDragEnd)}
                orientation={orientation}
                isDragging={isDragging}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Panel = ({
  children,
  className,
  minSize: _minSize,
  maxSize: _maxSize,
  defaultSize: _defaultSize,
  hidden: _hidden = false,
  anchor: _anchor,
  style,
  ...props
}: PanelProps) => {
  return (
    <div className={cn(className)} style={style} {...props}>
      {children}
    </div>
  );
};

Panel.displayName = "Panel";

export { PanelGroup, Panel };
