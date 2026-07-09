/**
 * @glaze/core/utils compat — Phase 0 stub.
 *
 * `initLogging` is a no-op for now; `cn` is a minimal class-name joiner (real
 * clsx + tailwind-merge version lands in Phase 2 when components are vendored).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const initLogging: any = () => {};
export const cn: any = (...classes: any[]) => classes.filter(Boolean).join(" ");
