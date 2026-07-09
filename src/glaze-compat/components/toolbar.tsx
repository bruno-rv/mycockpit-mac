import * as React from "react";
import { ProgressiveBlur } from "./progressive-blur";
import { cn, isMacOS27Plus } from "../utils";
import { usePanelContext } from "./panel-context";
import { useSidebarContext } from "./sidebar-context";
import { useSplitViewColumnContext } from "./split-view-column-context";
import { cva, VariantProps } from "class-variance-authority";
import { ChevronLeftIcon, SearchIcon } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { Text } from "./text";

interface ToolbarRowContextValue {
  rowIndex: number;
  isFirstRow: boolean;
  effectiveInset: "none" | "windowControls" | "windowControlsAndButton";
  isInSidebar: boolean;
  /** Forwarded from SplitView when available. Keeps inset padding animation in sync with
   * the sidebar collapse (direction-aware easing, matching duration). */
  insetTransition?: string;
}

const ToolbarRowContext = React.createContext<ToolbarRowContextValue | null>(null);

function useToolbarRowContext() {
  const context = React.useContext(ToolbarRowContext);
  if (!context) {
    throw new Error("ToolbarRow must be used within a Toolbar component");
  }
  return context;
}

// Height classes: sidebar uses auto (compact), everything else uses md
const heightClasses = {
  default: "h-13", // 52px
  sidebar: "min-h-9", // 36px minimum, grows with content
};

// Target: 88px total for windowControls, 132px total for windowControlsAndButton
const insetClasses = {
  default: {
    none: "",
    windowControls: "pl-[80px]", // 80px + px-2 (8px) = 88px
    windowControlsAndButton: "pl-[124px]", // 124px + px-2 (8px) = 132px (sidebar toggle at x=124 + 8px gap)
  },
  sidebar: {
    none: "",
    windowControls: "pl-[80px]", // 80px + px-2 (8px) = 88px
    windowControlsAndButton: "pl-[124px]", // 124px + px-2 (8px) = 132px (sidebar toggle at x=124 + 8px gap)
  },
};

export interface ToolbarRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

function ToolbarRow({ children, className, ...props }: ToolbarRowProps) {
  const { isFirstRow, effectiveInset, isInSidebar, insetTransition } = useToolbarRowContext();

  // Only the first row gets the inset
  const rowInset = isFirstRow ? effectiveInset : "none";
  const insetClass = isInSidebar ? insetClasses.sidebar[rowInset] : insetClasses.default[rowInset];
  const heightClass = isInSidebar ? heightClasses.sidebar : heightClasses.default;

  // When inside a SplitView, inherit the direction-aware transition the container publishes
  // so the inset-padding interpolates in lockstep with the sidebar's flex-basis collapse.
  // Outside a SplitView (raw PanelGroup, etc.), fall back to a sensible default.
  const transition = insetTransition ?? "padding 200ms cubic-bezier(0.165, 0.84, 0.44, 1)";

  return (
    <div
      className={cn("w-full flex items-center justify-between gap-2", heightClass, insetClass, className)}
      style={{ transition }}
      {...props}
    >
      {children}
    </div>
  );
}

// Mark ToolbarRow for detection (displayName can be stripped, so use a symbol)
ToolbarRow.displayName = "ToolbarRow";
const TOOLBAR_ROW_TYPE = Symbol.for("glaze.ToolbarRow");
type ToolbarRowMarked = { __toolbarRowType?: symbol; displayName?: string };
(ToolbarRow as unknown as ToolbarRowMarked).__toolbarRowType = TOOLBAR_ROW_TYPE;

function isToolbarRow(child: React.ReactNode): boolean {
  if (!React.isValidElement(child)) return false;
  const type = child.type as ToolbarRowMarked;
  return type?.__toolbarRowType === TOOLBAR_ROW_TYPE || type?.displayName === "ToolbarRow";
}

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  position?: "top" | "bottom";
  /**
   * Control the inset behavior for window controls.
   * - If provided explicitly, that value is used
   * - If not provided, resolved in this order:
   *   1. `SplitViewColumnContext.isFirst === true` → `windowControls`
   *   2. `PanelContext.isFirstPanel` + horizontal orientation → `windowControls`
   *   3. Not in any panel/layout context → `windowControls` (default safe behavior)
   *   4. Otherwise → `none`
   *
   * Note: Only the first ToolbarRow receives the inset. Subsequent rows have no inset.
   */
  inset?: "none" | "windowControls" | "windowControlsAndButton";
  background?: "progressive-blur" | "full-blur";
  /** When true, skip height/layout transitions on the toolbar content wrapper (e.g. docked composer). */
  disableLayoutTransition?: boolean;
}

function Toolbar({
  children,
  className,
  position = "top",
  inset,
  background = "progressive-blur",
  disableLayoutTransition = false,
  ...props
}: ToolbarProps) {
  const panelContext = usePanelContext();
  const columnContext = useSplitViewColumnContext();
  const isInSidebar = useSidebarContext();

  // Resolve inset: explicit prop → AppLayoutColumnContext → PanelContext → safe default.
  // Footers (position="bottom") never get window-control insets.
  let effectiveInset: "none" | "windowControls" | "windowControlsAndButton";
  if (inset !== undefined) {
    effectiveInset = inset;
  } else if (position === "bottom") {
    effectiveInset = "none";
  } else if (columnContext !== null) {
    // SplitView may request a specific inset (e.g. windowControlsAndButton when a pinned
    // sidebar toggle is active), falling back to the isFirst-based default.
    effectiveInset = columnContext.insetHint ?? (columnContext.isFirst ? "windowControls" : "none");
  } else if (panelContext?.isFirstPanel && panelContext.orientation === "horizontal") {
    effectiveInset = "windowControls";
  } else if (panelContext === null) {
    effectiveInset = "windowControls";
  } else {
    effectiveInset = "none";
  }

  // Sidebar toolbar height is thinner, adjust right padding so action padding is in correctly
  const paddingClass = isInSidebar ? (isMacOS27Plus() ? "px-2.5" : "pl-2 pr-[5px]") : "px-2";

  let hasToolbarRows = false;
  React.Children.forEach(children, (child) => {
    if (isToolbarRow(child)) {
      hasToolbarRows = true;
    }
  });

  // With explicit ToolbarRows, wrap each in row context; otherwise wrap all children in one row.
  const processedChildren = hasToolbarRows ? (
    (() => {
      let currentRowIndex = 0;
      return React.Children.map(children, (child) => {
        if (isToolbarRow(child)) {
          const rowIndex = currentRowIndex++;
          return (
            <ToolbarRowContext.Provider
              value={{
                rowIndex,
                isFirstRow: rowIndex === 0,
                effectiveInset,
                isInSidebar,
                insetTransition: columnContext?.insetTransition,
              }}
            >
              {child}
            </ToolbarRowContext.Provider>
          );
        }
        return child;
      });
    })()
  ) : (
    <ToolbarRowContext.Provider
      value={{
        rowIndex: 0,
        isFirstRow: true,
        effectiveInset,
        isInSidebar,
        insetTransition: columnContext?.insetTransition,
      }}
    >
      <ToolbarRow>{children}</ToolbarRow>
    </ToolbarRowContext.Provider>
  );

  return (
    <div
      className={cn("w-full relative z-20", position === "top" && "drag-region", paddingClass, className)}
      data-toolbar
      {...props}
    >
      {background === "progressive-blur" && <ProgressiveBlur position={position} height="100%" className="-z-10" />}
      {background === "full-blur" && (
        <div
          className={cn(
            "absolute inset-0 backdrop-blur -z-10 border-tertiary",
            position === "top" ? "border-b" : "border-t",
            className,
          )}
        />
      )}
      <div className={cn("w-full flex flex-col", !disableLayoutTransition && "transition-all duration-300 ease-out")}>
        {processedChildren}
      </div>
    </div>
  );
}

function ToolbarContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col items-start gap-0 min-w-0", className)} {...props}>
      {children}
    </div>
  );
}

const TEXT_TRUNCATE_WITH_INK_MARGIN = "whitespace-nowrap text-ellipsis overflow-clip [overflow-clip-margin:0.2em]";

/**
 * Title for the current view. Describes what the user is looking at — active filename,
 * selected item, or section name — **not** the app name. macOS convention: Preview shows
 * `"IMG_0042.png"`, Safari shows the page title. For simple apps (calculators, clocks) with
 * no view context, omit the title entirely.
 */
function ToolbarTitle({ children, className, ...props }: Omit<React.ComponentProps<"h2">, "color">) {
  return (
    <Text
      as="h2"
      variant="strong"
      // Native macOS (Tahoe) unified-toolbar titles render at 15pt semibold — a size the type
      // scale doesn't have (13 → 16). Override locally; the explicit weight is needed because
      // the size override replaces `text-strong`'s bundled weight in the class merge.
      className={cn("text-[15px] font-medium dimmable pl-1.5 max-w-full", TEXT_TRUNCATE_WITH_INK_MARGIN, className)}
      {...props}
    >
      {children}
    </Text>
  );
}

function ToolbarDescription({ children, className, ...props }: Omit<React.ComponentProps<"p">, "color">) {
  return (
    <Text
      as="p"
      color="secondary"
      className={cn("dimmable pl-1.5 max-w-full", TEXT_TRUNCATE_WITH_INK_MARGIN, className)}
      {...props}
    >
      {children}
    </Text>
  );
}

function ToolbarActions({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-2 ml-auto", className)} {...props}>
      {children}
    </div>
  );
}

export interface ToolbarBackButtonProps extends Omit<ButtonProps, "children" | "iconOnly"> {
  /** Accessible label + tooltip for the button. Defaults to `"Back"`. */
  label?: string;
}

/**
 * Pre-composed icon-only back button for detail-page toolbars — a chevron in a glass button,
 * matching the native macOS back affordance. Wire your own navigation via `onClick` (e.g.
 * `router.history.back()`). Drop it into a Toolbar's leading position, the `leading` sugar prop
 * of `ScrollArea`, or a sidebar toolbar (`variant="transparent" size="small"`).
 *
 * For paired back/forward navigation (settings, history), use `NavigationButtonGroup` instead.
 */
function ToolbarBackButton({ label = "Back", variant = "glass", size = "large", ...props }: ToolbarBackButtonProps) {
  return (
    <Button variant={variant} size={size} iconOnly aria-label={label} title={label} {...props}>
      <ChevronLeftIcon />
    </Button>
  );
}

ToolbarBackButton.displayName = "ToolbarBackButton";

const toolbarSearchButtonVariants = cva(
  "bg-glass rounded-pill px-2 transition-all duration-200 flex items-center justify-center gap-2",
  {
    variants: {
      size: {
        small: "h-7 w-7",
        medium: "h-8 w-8",
        large: "h-9 w-9",
      },
    },
    defaultVariants: {
      size: "medium",
    },
  },
);

type ToolbarSearchButtonProps = VariantProps<typeof toolbarSearchButtonVariants> & {
  value: string;
  onChange: (value: string) => void;
};

export type ToolbarSearchButtonRef = {
  focus: () => void;
  blur: () => void;
};

const ToolbarSearchButton = React.forwardRef<ToolbarSearchButtonRef, ToolbarSearchButtonProps>(
  ({ value, onChange, size = "medium" }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => ({
      focus: () => {
        setIsOpen(true);
        // Focus after state update renders the input
        setTimeout(() => inputRef.current?.focus(), 0);
      },
      blur: () => {
        inputRef.current?.blur();
      },
    }));

    return (
      <div
        className={cn(toolbarSearchButtonVariants({ size }), isOpen ? "w-[200px]" : "hover:bg-control-subtle")}
        role="button"
        onClick={() => setIsOpen(true)}
      >
        <SearchIcon
          className={cn("shrink-0", size === "large" ? "w-4.5 h-4.5" : "w-4 h-4", isOpen && "text-tertiary")}
        />
        {(isOpen || value) && (
          <input
            ref={inputRef}
            placeholder="Search…"
            autoFocus
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            autoCapitalize="off"
            value={value}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                if (value) {
                  onChange("");
                } else {
                  setIsOpen(false);
                  inputRef.current?.blur();
                }
              }
            }}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              if (!value) {
                setIsOpen(false);
              }
            }}
            className="w-full h-full outline-none bg-transparent"
          />
        )}
      </div>
    );
  },
);

ToolbarSearchButton.displayName = "ToolbarSearchButton";

export {
  Toolbar,
  ToolbarRow,
  ToolbarTitle,
  ToolbarDescription,
  ToolbarContent,
  ToolbarActions,
  ToolbarBackButton,
  ToolbarSearchButton,
};
