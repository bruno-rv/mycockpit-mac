/**
 * @glaze/core/hooks compat — Phase 0 stub.
 *
 * Typed `any` placeholders returning safe defaults so root-view.tsx type-checks
 * and renders. Real hooks (useTheme backed by nativeTheme, useConnection,
 * useEnvironment) land in Phase 2.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const useTheme: any = () => {};
export const useConnection: any = () => ({ data: { connected: false } });
export const useEnvironment: any = () => ({ data: { type: "dev-server" } });
