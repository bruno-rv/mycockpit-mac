import * as React from "react";
import { useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils";
import { Label } from "./label";
import { Separator } from "./separator";
import { Text } from "./text";

/**
 * FieldSet — a grouped section of related form rows.
 *
 * When `title` is set, renders `<FieldLegend>` automatically, and if no direct child is a
 * `<FieldGroup>` the children get wrapped in one (the rounded gray container). This collapses
 * the common 4-deep nesting to a single wrapper.
 */
type FieldSetOwnProps = {
  /** Section header. Auto-rendered as a `<FieldLegend>`. */
  title?: React.ReactNode;
  /** Optional section subtext under the legend. Auto-rendered as a `<FieldDescription>`. */
  description?: React.ReactNode;
};

function FieldSet({
  className,
  title,
  description,
  children,
  ...props
}: Omit<React.ComponentProps<"fieldset">, "title"> & FieldSetOwnProps) {
  const propsMode = title !== undefined || description !== undefined;
  const alreadyHasGroup = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && (child.type as { displayName?: string })?.displayName === "FieldGroup",
  );

  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className,
      )}
      {...props}
    >
      {title !== undefined && <FieldLegend>{title}</FieldLegend>}
      {description !== undefined && (
        <FieldDescription className={cn("mx-4 max-w-none", title !== undefined && "-mt-3")}>
          {description}
        </FieldDescription>
      )}
      {propsMode && !alreadyHasGroup ? <FieldGroup>{children}</FieldGroup> : children}
    </fieldset>
  );
}
FieldSet.displayName = "FieldSet";

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: Omit<React.ComponentProps<"legend">, "color"> & { variant?: "legend" | "label" }) {
  return (
    <Text
      as="legend"
      variant="strong"
      data-slot="field-legend"
      data-variant={variant}
      className={cn("mb-3 data-[variant=legend]:mx-4", className)}
      {...props}
    />
  );
}
FieldLegend.displayName = "FieldLegend";

/**
 * Auto-divider participation: true when this element represents a "content" settings row.
 * - A `<Field>` is a content row when it uses the props API (label / description / error) or composes
 *   a `FieldContent` child. Action-only `<Field>`s (just a `<Button>`) stay false — they
 *   visually belong to the preceding row and shouldn't get a divider above them.
 * - A `<Dialog>` or `<AlertDialog>` used as a disclosure row inherits from its `trigger` prop.
 *   So `<Dialog trigger={<Field label="Bio" …/>} …/>` participates exactly like an inline Field.
 */
function isContentFieldElement(child: unknown): boolean {
  if (!React.isValidElement(child)) return false;
  const displayName = (child.type as { displayName?: string })?.displayName;
  if (displayName === "Field") {
    const props = (child as React.ReactElement<FieldOwnProps & { children?: React.ReactNode }>).props;
    if (props.label !== undefined || props.description !== undefined || props.error != null) return true;
    return React.Children.toArray(props.children).some(
      (c) => React.isValidElement(c) && (c.type as { displayName?: string })?.displayName === "FieldContent",
    );
  }
  if (displayName === "Dialog" || displayName === "AlertDialog") {
    const triggerProp = (child as React.ReactElement<{ trigger?: React.ReactNode }>).props.trigger;
    return isContentFieldElement(triggerProp);
  }
  return false;
}

function FieldGroup({ className, children, ...props }: React.ComponentProps<"div">) {
  // Auto-insert `<FieldSeparator />` between adjacent Field rows (native macOS convention).
  // Only between two content rows — action-only rows (just a button) don't get a divider,
  // matching the native pattern where a Save button visually belongs to its preceding input.
  const interspersed: React.ReactNode[] = [];
  const childArray = React.Children.toArray(children);
  childArray.forEach((child, index) => {
    const prev = index > 0 ? childArray[index - 1] : null;
    if (prev && isContentFieldElement(prev) && isContentFieldElement(child)) {
      interspersed.push(<FieldSeparator key={`auto-sep-${index}`} />);
    }
    interspersed.push(child);
  });

  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
        "bg-well rounded-card w-full overflow-hidden",
        className,
      )}
      {...props}
    >
      {interspersed}
    </div>
  );
}
FieldGroup.displayName = "FieldGroup";

const fieldVariants = cva(
  "group/field px-4 pt-4 pb-4 min-h-12 flex w-full gap-3 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          // Row stays items-center even when a FieldContent child (label + description) is
          // present — the control should sit vertically centered with the content block, the
          // native macOS settings-row convention. The `:mt-px` nudge keeps checkbox/radio
          // visuals aligned with the first line of the label.
          "flex-row items-center",
          "[&>[data-slot=field-label]]:flex-auto",
          "has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto",
          "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  },
);

/**
 * Field — a single form row.
 *
 * When `label` is set, auto-builds `<FieldContent><FieldLabel/><FieldDescription/></FieldContent>`
 * and wraps the children in a right-aligned, flex-wrapping control slot that prevents buttons
 * from stretching to full width ("sausage buttons"). Default orientation is `horizontal`.
 *
 * **Primitive mode** (no `label`): children are rendered as-is. Default orientation is `vertical`
 * for backwards compatibility with existing call sites that compose `<FieldContent>` manually.
 */
type FieldOwnProps = {
  /** Row label. Auto-rendered as a `<FieldLabel>`. */
  label?: React.ReactNode;
  /** Row subtext. Auto-rendered as a `<FieldDescription>`. */
  description?: React.ReactNode;
  /** Validation error message. Auto-rendered as a `<FieldError>` under the content. */
  error?: React.ReactNode;
};

function Field({
  className,
  orientation,
  label,
  description,
  error,
  children,
  onClick,
  disabled,
  ref,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> &
  FieldOwnProps & {
    /**
     * Make the row itself interactive — e.g. a settings disclosure row that opens a Dialog.
     * When set, Field renders as `<button>` with hover/active/focus-visible states and keeps
     * its `displayName="Field"` so `FieldGroup`'s auto-divider detection still works. Pair
     * with `Dialog`'s `trigger` prop (`DialogTrigger asChild` spreads onClick via Radix Slot)
     * for the chevron-disclosure pattern — put `<ChevronRightIcon />` as a child.
     *
     * Do NOT mix with interactive children (Input, Switch, Select). `<button>` nesting an
     * interactive element is invalid HTML and breaks focus/click behavior.
     */
    onClick?: React.MouseEventHandler<HTMLElement>;
    disabled?: boolean;
    ref?: React.Ref<HTMLElement>;
  }) {
  const hasError = error != null;
  const propsMode = label !== undefined || description !== undefined || hasError;

  // Narrow detection for action rows (`<Field><Button>Save</Button></Field>`): every child
  // must be a `<Button>`. Any other content means the Field is a structured row that must
  // stay vertical — the legacy primitive default that existing call sites rely on.
  const childArray = React.Children.toArray(children);
  const isActionRow =
    !propsMode &&
    childArray.length > 0 &&
    childArray.every((c) => React.isValidElement(c) && (c.type as { displayName?: string })?.displayName === "Button");
  const effectiveOrientation = orientation ?? (propsMode || isActionRow ? "horizontal" : "vertical");

  const isInteractive = onClick !== undefined;
  const content = propsMode ? (
    <>
      {description !== undefined || hasError ? (
        <FieldContent>
          {label !== undefined && <FieldLabel>{label}</FieldLabel>}
          {description !== undefined && <FieldDescription className="max-w-none">{description}</FieldDescription>}
          {hasError && <FieldError>{error}</FieldError>}
        </FieldContent>
      ) : (
        label !== undefined && <FieldLabel>{label}</FieldLabel>
      )}
      {children !== undefined && children !== null && children !== false && (
        <div
          data-slot="field-control"
          className={cn(effectiveOrientation !== "vertical" && "flex flex-wrap items-center justify-end gap-2")}
        >
          {children}
        </div>
      )}
    </>
  ) : (
    children
  );

  const rootClassName = cn(
    fieldVariants({ orientation: effectiveOrientation }),
    // Action rows (Cancel / Save pair) sit flush against the preceding content row's pb-4 —
    // no separator is drawn between them, so zeroing out the top padding prevents the two
    // paddings from compounding into too much vertical space.
    !propsMode && isActionRow && effectiveOrientation === "horizontal" && "justify-end pt-0",
    isInteractive &&
      "cursor-default text-left active:bg-control-subtle focus-visible:bg-control-subtle focus-visible:outline-none disabled:opacity-50",
    className,
  );

  // `data-disabled` so the `group-data-[disabled=true]/field` selectors on FieldLabel /
  // FieldDescription fade in both modes. Button mode also uses the native `disabled` attr
  // for click-suppression and `disabled:opacity-50`.
  const dataDisabled = disabled ? "true" : undefined;

  if (isInteractive) {
    return (
      <button
        type="button"
        ref={ref as React.Ref<HTMLButtonElement>}
        data-slot="field"
        data-orientation={effectiveOrientation}
        data-disabled={dataDisabled}
        onClick={onClick}
        disabled={disabled}
        className={rootClassName}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      role="group"
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="field"
      data-orientation={effectiveOrientation}
      data-disabled={dataDisabled}
      className={rootClassName}
      {...props}
    >
      {content}
    </div>
  );
}
Field.displayName = "Field";

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("group/field-content flex flex-1 flex-col gap-1 leading-snug", className)}
      {...props}
    />
  );
}
FieldContent.displayName = "FieldContent";

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4",
        "has-data-[state=checked]:bg-well has-data-[state=checked]:border-tertiary",
        className,
      )}
      {...props}
    />
  );
}
FieldLabel.displayName = "FieldLabel";

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn("text-strong flex w-fit items-center gap-2 group-data-[disabled=true]/field:opacity-50", className)}
      {...props}
    />
  );
}
FieldTitle.displayName = "FieldTitle";

function FieldDescription({ className, ...props }: Omit<React.ComponentProps<"p">, "color">) {
  return (
    <Text
      as="p"
      variant="small"
      color="secondary"
      data-slot="field-description"
      className={cn(
        "group-has-[[data-orientation=horizontal]]/field:text-balance",
        "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        "max-w-[350px]",
        className,
      )}
      {...props}
    />
  );
}
FieldDescription.displayName = "FieldDescription";

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) {
  // No children → flat 1px separator with no flow gap. A prior version used `-my-2 h-5` with
  // an absolute line at top-1/2; that left 2px of flow-space below the visible line, which
  // was invisible when neighboring Fields had no background but showed as a gap whenever a
  // row with its own background (hover state, disclosure button) sat underneath.
  if (!children) {
    return <Separator data-slot="field-separator" className={cn("mx-4", className)} {...props} />;
  }
  return (
    <div
      data-slot="field-separator"
      data-content="true"
      className={cn("text-regular relative -my-2 mx-4 h-5 group-data-[variant=outline]/field-group:-mb-2", className)}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      <span
        className="bg-background text-secondary relative mx-auto block w-fit px-2"
        data-slot="field-separator-content"
      >
        {children}
      </span>
    </div>
  );
}
FieldSeparator.displayName = "FieldSeparator";

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map((error, index) => error?.message && <li key={index}>{error.message}</li>)}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div role="alert" data-slot="field-error" className={cn("text-regular text-support-red", className)} {...props}>
      {content}
    </div>
  );
}
FieldError.displayName = "FieldError";

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};
