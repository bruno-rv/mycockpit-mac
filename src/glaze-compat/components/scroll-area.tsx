import * as React from "react";
import { cn } from "../utils";
import { usePreferredScrollerStyle } from "./use-preferred-scroller-style";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import { Button } from "./button";
import { ArrowDownToLineIcon } from "lucide-react";
import { useSplitViewColumnContext } from "./split-view-column-context";
import { usePanelContext } from "./panel-context";
import { applyContentToolbarButtonDefaults } from "./apply-button-defaults";
import { Toolbar, ToolbarContent, ToolbarTitle, ToolbarDescription, ToolbarActions } from "./toolbar";

// Extra bottom offset in last-column ScrollAreas so the scrollbar's bottom pixel clears the
// macOS window's rounded corner. Added on top of any caller-supplied `scrollbarBottomOffset`.
const LAST_COLUMN_SCROLLBAR_BOTTOM_OFFSET = 18;

type ScrollAreaRootType = NonNullable<React.ComponentProps<typeof ScrollAreaPrimitive.Root>["type"]>;

function scrollAreaTypeForPreferredScrollerStyle(
  preferredScrollerStyle: ReturnType<typeof usePreferredScrollerStyle>,
): ScrollAreaRootType | undefined {
  switch (preferredScrollerStyle) {
    case "legacy":
      return "auto";
    case "overlay":
      return "scroll";
    default:
      return undefined;
  }
}

export type ScrollAreaControl = {
  /** Scroll to bottom unconditionally, properly setting internal tracking state. */
  forceScrollToBottom: () => void;
  /**
   * Freeze auto-follow-bottom during a programmatic scroll correction (e.g. a
   * reverse-pagination prepend); reference-counted — pair with `resumeAutoFollow()`
   * @internal
   */
  suspendAutoFollow: () => void;
  /**
   * Resume auto-follow-bottom; on the final resume the at-bottom belief is recomputed from live geometry
   * @internal
   */
  resumeAutoFollow: () => void;
};

// Threshold (px) within which the viewport counts as "at the bottom" for
// auto-follow. Shared by the scroll handler and the resume recomputation.
const AT_BOTTOM_THRESHOLD_PX = 5;

type MeasuredContainerProps = {
  children: React.ReactNode;
  onHeightChange: (height: number) => void;
  position: "top" | "bottom";
  className?: string;
};

const MeasuredContainer = ({ children, onHeightChange, position, className }: MeasuredContainerProps) => {
  const callbackRef = React.useRef(onHeightChange);
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const lastHeightRef = React.useRef<number>(-1);

  React.useEffect(() => {
    callbackRef.current = onHeightChange;
  }, [onHeightChange]);

  const ref = React.useCallback((element: HTMLDivElement | null) => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!element) return;

    // Measure immediately on mount
    const initialHeight = Math.round(element.getBoundingClientRect().height);
    lastHeightRef.current = initialHeight;
    callbackRef.current(initialHeight);

    // Set up observer for future changes
    observerRef.current = new ResizeObserver((entries) => {
      // Only trigger callback if height actually changed (rounded to avoid subpixel noise)
      const newHeight = Math.round(entries[0].contentRect.height);
      if (newHeight !== lastHeightRef.current) {
        lastHeightRef.current = newHeight;
        callbackRef.current(newHeight);
      }
    });

    observerRef.current.observe(element);
  }, []);

  return (
    <div ref={ref} className={cn("absolute left-0 right-0 z-10", position === "top" ? "top-0" : "bottom-0", className)}>
      {children}
    </div>
  );
};

/**
 * Self-contained scroll-to-bottom button. Manages its own scroll tracking
 * so it re-renders independently from ScrollArea (only on isAtBottom transitions).
 */
const ScrollToBottomButton = React.memo(function ScrollToBottomButton({
  viewportRef,
  scrollToBottom,
  bottomOffset,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
  bottomOffset: number;
}) {
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let current = true;

    const check = () => {
      const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const atBottom = distance < 5;
      if (atBottom !== current) {
        current = atBottom;
        setIsAtBottom(atBottom);
      }
    };

    viewport.addEventListener("scroll", check, { passive: true });
    check();

    return () => viewport.removeEventListener("scroll", check);
  }, [viewportRef]);

  return (
    <div
      className={cn(
        "absolute right-[13px] z-20 bottom-3 transition-all duration-200 ease-in-out",
        isAtBottom ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100 pointer-events-auto translate-y-0",
      )}
      style={bottomOffset ? { bottom: `${bottomOffset + 12}px` } : undefined}
    >
      <Button title="Scroll to bottom" onClick={scrollToBottom} size="small" iconOnly aria-label="Scroll to bottom">
        <ArrowDownToLineIcon className="w-4 h-4" />
      </Button>
    </div>
  );
});

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none select-none mr-[3px] hover:bg-foreground-10 rounded-full",
        orientation === "vertical" && "h-full w-[8px] hover:w-[12px] border-l border-l-transparent",
        orientation === "horizontal" && "h-[8px] hover:h-[12px] flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className={cn(
          "relative flex-1 after:content-[''] after:absolute after:left-0 after:top-0 after:rounded-full after:bg-foreground-40 after:pointer-events-none",
          orientation === "vertical" && "after:w-full after:h-[var(--radix-scroll-area-thumb-visual-size,100%)]",
          orientation === "horizontal" && "after:h-full after:w-[var(--radix-scroll-area-thumb-visual-size,100%)]",
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

type ScrollAreaProps = {
  /**
   * Escape hatch: pass a fully custom `<Toolbar>`. Takes precedence over `title`/`subtitle`/`actions`.
   */
  toolbar?: React.ReactNode;
  /**
   * Renders a `<ToolbarTitle>` inside an auto-built Toolbar. Should describe
   * the active view: filename, selected item, section name. **Not** the app name. macOS
   * convention: Preview shows `"IMG_0042.png"`, not `"Preview"`. For simple apps (calculators,
   * clocks) with no view context, omit this prop entirely. Ignored when `toolbar` is also set.
   */
  title?: React.ReactNode;
  /**
   * Renders a `<ToolbarDescription>` under the title inside the auto-built Toolbar.
   * Ignored when `toolbar` is also set.
   */
  subtitle?: React.ReactNode;
  /**
   * Renders action buttons in a `<ToolbarActions>` slot. Button children are
   * auto-styled with `variant="glass" size="large"` (content-area defaults) through any wrappers
   * (Tooltip, DropdownMenuTrigger asChild, Popover.Trigger asChild). Ignored when `toolbar` is set.
   */
  actions?: React.ReactNode;
  /**
   * Content rendered on the leading (left) edge of the auto-built Toolbar, before the title.
   * Primary use is a back affordance on detail pages — pass `<ToolbarBackButton onClick={...} />`.
   * Button children are auto-styled with content-area defaults (`variant="glass" size="large"`),
   * same as `actions`. Ignored when `toolbar` is set.
   */
  leading?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  fadeEdges?: boolean;
  autoScrollToBottom?: boolean;
  autoScrollDeps?: React.DependencyList;
  showScrollToBottomButton?: boolean;
  scrollbars?: "vertical" | "horizontal" | "both";
  scrollbarBottomOffset?: number;
  scrollbarTopOffset?: number;
  scrollControlRef?: React.MutableRefObject<ScrollAreaControl | null>;
} & Omit<React.ComponentProps<typeof ScrollAreaPrimitive.Root>, "title">;

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      toolbar,
      title,
      subtitle,
      actions,
      leading,
      footer,
      children,
      className,
      viewportClassName,
      fadeEdges,
      autoScrollToBottom,
      autoScrollDeps,
      showScrollToBottomButton,
      scrollbars = "vertical",
      scrollbarBottomOffset = 0,
      scrollbarTopOffset = 0,
      scrollControlRef,
      type,
      ...props
    },
    ref,
  ) => {
    const preferredScrollerStyle = usePreferredScrollerStyle();
    const columnContext = useSplitViewColumnContext();
    const panelContext = usePanelContext();
    // SplitView context wins. Otherwise fall back to PanelContext's `isLastPanel` for horizontal
    // groups — same heuristic grade as Toolbar's `isFirstPanel` fallback. Lets raw `PanelGroup`
    // consumers get the Tahoe scrollbar clearance without manually setting `scrollbarBottomOffset`.
    const isInLastColumn =
      columnContext?.isLast ?? (panelContext?.isLastPanel === true && panelContext.orientation === "horizontal");

    const propsMode = title !== undefined || subtitle !== undefined || actions !== undefined || leading !== undefined;
    if (toolbar && propsMode && process.env.NODE_ENV !== "production") {
      console.warn(
        "[ScrollArea] `toolbar` overrides `title` / `subtitle` / `actions` / `leading` — pass only one. Using `toolbar`.",
      );
    }
    const resolvedToolbar =
      toolbar ?? (propsMode ? buildToolbarFromProps({ title, subtitle, actions, leading }) : undefined);

    const effectiveScrollbarBottomOffset =
      scrollbarBottomOffset + (isInLastColumn ? LAST_COLUMN_SCROLLBAR_BOTTOM_OFFSET : 0);
    const [toolbarHeight, setToolbarHeight] = React.useState(0);
    const [footerHeight, setFooterHeight] = React.useState(0);
    const [isTopVisible, setIsTopVisible] = React.useState(true);
    const [isBottomVisible, setIsBottomVisible] = React.useState(true);

    const topSentinelRef = React.useRef<HTMLDivElement>(null);
    const bottomSentinelRef = React.useRef<HTMLDivElement>(null);
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const isUserAtBottomRef = React.useRef(true);
    const isScrollingProgrammatically = React.useRef(false);
    // Depth of nested auto-follow suspensions. While > 0 the at-bottom belief is
    // frozen and content-resize auto-scroll is skipped (see suspendAutoFollow).
    const autoFollowSuspendDepthRef = React.useRef(0);
    const resetTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

    const recomputeIsAtBottom = React.useCallback(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      isUserAtBottomRef.current = distanceFromBottom < AT_BOTTOM_THRESHOLD_PX;
    }, []);

    const suspendAutoFollow = React.useCallback(() => {
      autoFollowSuspendDepthRef.current += 1;
    }, []);

    const resumeAutoFollow = React.useCallback(() => {
      if (autoFollowSuspendDepthRef.current === 0) return;
      autoFollowSuspendDepthRef.current -= 1;
      // Only recompute once the last suspension lifts: nested corrections should
      // not thrash the belief between writes.
      if (autoFollowSuspendDepthRef.current === 0) {
        recomputeIsAtBottom();
      }
    }, [recomputeIsAtBottom]);

    // Combine refs for viewport
    React.useImperativeHandle(ref, () => viewportRef.current as HTMLDivElement);

    // Force-scroll to bottom: sets internal state so subsequent auto-scroll
    // (ResizeObserver, footer height changes) continues working correctly.
    // Used by external consumers (e.g. ChatMessages on new request).
    const forceScrollToBottom = React.useCallback(() => {
      if (!viewportRef.current) return;

      isScrollingProgrammatically.current = true;
      isUserAtBottomRef.current = true;

      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: "instant",
      });

      // Keep the flag on long enough to cover virtualizer re-measurements
      // (which can change scrollHeight in a subsequent render cycle).
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 200);
    }, []);

    // Expose control ref for external consumers
    React.useLayoutEffect(() => {
      if (!scrollControlRef) return;
      scrollControlRef.current = { forceScrollToBottom, suspendAutoFollow, resumeAutoFollow };
      return () => {
        if (scrollControlRef) scrollControlRef.current = null;
      };
    }, [scrollControlRef, forceScrollToBottom, suspendAutoFollow, resumeAutoFollow]);

    // Handler to scroll to bottom (smooth — for the "scroll to bottom" button)
    const scrollToBottom = React.useCallback(() => {
      if (!viewportRef.current) return;

      isScrollingProgrammatically.current = true;
      isUserAtBottomRef.current = true;

      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: "smooth",
      });

      // Reset flag after scroll
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        isScrollingProgrammatically.current = false;
        isUserAtBottomRef.current = true;
      }, 500); // Wait for smooth scroll to complete
    }, []);

    // Track if user is at bottom (ref-only, for auto-scroll logic — no state, no re-renders)
    React.useEffect(() => {
      if (!autoScrollToBottom || !viewportRef.current) return;

      const viewport = viewportRef.current;

      const checkIfAtBottom = () => {
        // Freeze the belief during our own programmatic scrolls and while a
        // consumer-driven correction is suspending auto-follow — the transient
        // geometry from those writes must not be read as a user gesture.
        if (isScrollingProgrammatically.current || autoFollowSuspendDepthRef.current > 0) return;

        const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        const isAtBottom = distanceFromBottom < AT_BOTTOM_THRESHOLD_PX;

        isUserAtBottomRef.current = isAtBottom;
      };

      viewport.addEventListener("scroll", checkIfAtBottom, { passive: true });

      // Initial check
      checkIfAtBottom();

      return () => {
        viewport.removeEventListener("scroll", checkIfAtBottom);
      };
    }, [autoScrollToBottom]);

    // Auto-scroll when content height changes, in either direction.
    React.useEffect(() => {
      if (!autoScrollToBottom || !contentRef.current || !viewportRef.current) return;

      const content = contentRef.current;
      const viewport = viewportRef.current;
      let lastHeight = content.getBoundingClientRect().height;

      const observer = new ResizeObserver((entries) => {
        const newHeight = entries[0].contentRect.height;

        // Scroll if height changed in either direction and user was at bottom.
        // Height can *decrease* when virtualization swaps a fully-rendered DOM
        // element for a smaller size estimate, so we must handle both directions.
        // Skip while auto-follow is suspended: a resize from a consumer-driven
        // correction (e.g. an older-page prepend) must not yank the viewport to
        // the bottom. `lastHeight` still updates below so we don't spuriously
        // scroll on the next resize once suspension lifts.
        if (newHeight !== lastHeight && isUserAtBottomRef.current && autoFollowSuspendDepthRef.current === 0) {
          isScrollingProgrammatically.current = true;

          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: "instant",
          });

          // Debounce the reset: clear any pending timer so the flag stays true
          // for 50 ms after the *last* programmatic scroll, not the first.
          // Without this, rapid-fire ResizeObserver callbacks (e.g. during
          // streaming) can leave a stale timeout that flips the flag too early,
          // causing isUserAtBottomRef to incorrectly become false.
          clearTimeout(resetTimerRef.current);
          resetTimerRef.current = setTimeout(() => {
            isScrollingProgrammatically.current = false;
          }, 50);
        }

        lastHeight = newHeight;
      });

      observer.observe(content);

      return () => {
        observer.disconnect();
      };
    }, [autoScrollToBottom]);

    // Also scroll on initial mount and when deps change (for immediate scroll before paint)
    React.useLayoutEffect(() => {
      if (!autoScrollToBottom || !autoScrollDeps || !viewportRef.current) return;

      // Only scroll if user was at bottom
      if (!isUserAtBottomRef.current) {
        return;
      }
      if (autoFollowSuspendDepthRef.current > 0) return;

      const viewport = viewportRef.current;

      isScrollingProgrammatically.current = true;

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "instant",
      });

      // Reset flag after a short delay
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 100);
    }, autoScrollDeps || []);

    // Auto-scroll when footer or toolbar height changes (e.g. composer textarea
    // growing/shrinking). These affect scroll geometry via paddingTop/paddingBottom
    // but are NOT caught by the content ResizeObserver.
    const prevFooterHeightRef = React.useRef(footerHeight);
    const prevToolbarHeightRef = React.useRef(toolbarHeight);
    React.useLayoutEffect(() => {
      if (!autoScrollToBottom || !viewportRef.current) return;

      const footerChanged = footerHeight !== prevFooterHeightRef.current;
      const toolbarChanged = toolbarHeight !== prevToolbarHeightRef.current;
      prevFooterHeightRef.current = footerHeight;
      prevToolbarHeightRef.current = toolbarHeight;

      if (!footerChanged && !toolbarChanged) return;
      if (!isUserAtBottomRef.current) return;
      if (autoFollowSuspendDepthRef.current > 0) return;

      isScrollingProgrammatically.current = true;

      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: "instant",
      });

      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 50);
    }, [autoScrollToBottom, footerHeight, toolbarHeight]);

    // Fade edges detection
    React.useEffect(() => {
      if (!fadeEdges || !viewportRef.current) return;

      const viewport = viewportRef.current;
      const topSentinel = topSentinelRef.current;
      const bottomSentinel = bottomSentinelRef.current;

      if (!topSentinel || !bottomSentinel) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target === topSentinel) {
              setIsTopVisible(entry.isIntersecting);
            } else if (entry.target === bottomSentinel) {
              setIsBottomVisible(entry.isIntersecting);
            }
          });
        },
        {
          root: viewport,
          threshold: 0,
        },
      );

      observer.observe(topSentinel);
      observer.observe(bottomSentinel);

      return () => {
        observer.disconnect();
      };
    }, [fadeEdges]);

    const fadeSize = 32; // pixels to fade
    const maskImage = React.useMemo(() => {
      if (!fadeEdges) return undefined;

      const fadeTop = !isTopVisible;
      const fadeBottom = !isBottomVisible;

      if (!fadeTop && !fadeBottom) return undefined;

      if (fadeTop && fadeBottom) {
        return `linear-gradient(to bottom, transparent 0px, black ${fadeSize}px, black calc(100% - ${fadeSize}px), transparent 100%)`;
      }

      if (fadeTop) {
        return `linear-gradient(to bottom, transparent 0px, black ${fadeSize}px)`;
      }

      if (fadeBottom) {
        return `linear-gradient(to bottom, black calc(100% - ${fadeSize}px), transparent 100%)`;
      }

      return undefined;
    }, [fadeEdges, isTopVisible, isBottomVisible]);

    const hasVerticalScrollbar = scrollbars === "vertical" || scrollbars === "both";
    const hasHorizontalScrollbar = scrollbars === "horizontal" || scrollbars === "both";
    const scrollAreaType = type ?? scrollAreaTypeForPreferredScrollerStyle(preferredScrollerStyle);

    return (
      <ScrollAreaPrimitive.Root
        className={cn("relative", hasVerticalScrollbar && "h-full max-h-screen", className)}
        type={scrollAreaType}
        {...props}
      >
        {resolvedToolbar && (
          <MeasuredContainer position="top" onHeightChange={setToolbarHeight}>
            {resolvedToolbar}
          </MeasuredContainer>
        )}
        <ScrollAreaPrimitive.Viewport
          ref={viewportRef}
          className={cn("size-full *:block!", viewportClassName)}
          style={{
            paddingTop: toolbarHeight,
            paddingBottom: footerHeight,
            maskImage,
            WebkitMaskImage: maskImage,
            overflowX: hasHorizontalScrollbar ? "scroll" : "hidden",
            overflowY: hasVerticalScrollbar ? "scroll" : "hidden",
            overscrollBehaviorX: hasHorizontalScrollbar ? "contain" : "auto",
            overscrollBehaviorY: hasVerticalScrollbar ? "contain" : "auto",
          }}
        >
          {fadeEdges && <div ref={topSentinelRef} className="h-px" aria-hidden="true" />}
          <div ref={contentRef} className={cn(hasHorizontalScrollbar && "min-w-fit")}>
            {children}
          </div>
          {fadeEdges && <div ref={bottomSentinelRef} className="h-px" aria-hidden="true" />}
        </ScrollAreaPrimitive.Viewport>
        {hasVerticalScrollbar && (
          <ScrollBar
            orientation="vertical"
            style={{
              marginTop: toolbarHeight + scrollbarTopOffset,
              height: `calc(100% - ${toolbarHeight + footerHeight + effectiveScrollbarBottomOffset + scrollbarTopOffset}px)`,
            }}
          />
        )}
        {hasHorizontalScrollbar && <ScrollBar orientation="horizontal" />}
        <ScrollAreaPrimitive.Corner />
        {footer && (
          <MeasuredContainer position="bottom" onHeightChange={setFooterHeight}>
            {footer}
          </MeasuredContainer>
        )}
        {showScrollToBottomButton && (
          <ScrollToBottomButton
            viewportRef={viewportRef}
            scrollToBottom={scrollToBottom}
            bottomOffset={footerHeight + effectiveScrollbarBottomOffset + scrollbarTopOffset}
          />
        )}
      </ScrollAreaPrimitive.Root>
    );
  },
);

ScrollArea.displayName = "ScrollArea";

function buildToolbarFromProps({
  title,
  subtitle,
  actions,
  leading,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  leading?: React.ReactNode;
}): React.ReactNode {
  const hasTitleOrSubtitle = title !== undefined || subtitle !== undefined;
  const titleNode = hasTitleOrSubtitle ? (
    <ToolbarContent>
      {title !== undefined && <ToolbarTitle>{title}</ToolbarTitle>}
      {subtitle !== undefined && <ToolbarDescription>{subtitle}</ToolbarDescription>}
    </ToolbarContent>
  ) : null;
  return (
    <Toolbar>
      {leading !== undefined ? (
        // Group leading + title so `justify-between` on the row doesn't spread them apart.
        <div className="flex items-center gap-2 min-w-0">
          {applyContentToolbarButtonDefaults(leading)}
          {titleNode}
        </div>
      ) : (
        titleNode
      )}
      {actions !== undefined && <ToolbarActions>{applyContentToolbarButtonDefaults(actions)}</ToolbarActions>}
    </Toolbar>
  );
}

export { ScrollArea };
