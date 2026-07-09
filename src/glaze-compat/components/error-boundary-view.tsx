/**
 * Native-coupling fix (PORT_PLAN 2.1): the SDK's ErrorBoundaryView renders a "Fix with Agent"
 * button that calls `glaze:openAgent` over IPC and shows `<GlazeLogo>` / gates on
 * `isBundledStoreApp()` — none of which exist in this standalone app (no bundled dev-agent
 * relay, no app-store build flavor). Dropped both; kept the error display + reload button.
 */
import * as React from "react";
import { Button } from "./button";
import { Text } from "./text";

export function ErrorBoundaryView({ error }: { error: unknown }) {
  React.useEffect(() => {
    console.error("[Router] Uncaught error:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="drag-region fixed top-0 left-0 right-0 h-13" />
      <Text as="p" variant="heading1">
        Something went wrong
      </Text>
      {error instanceof Error ? (
        <Text as="pre" variant="small-mono" color="quaternary" className="max-w-[80vw] whitespace-pre-wrap wrap-break-word mt-1">
          {error.message}
        </Text>
      ) : (
        <Text as="p" color="secondary" className="max-w-md">
          An unexpected error occurred.
        </Text>
      )}
      <div className="flex items-center gap-2 mt-4">
        <Button variant="filled" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
