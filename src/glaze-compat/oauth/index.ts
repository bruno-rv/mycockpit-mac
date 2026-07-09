/**
 * @glaze/core/oauth compat — Phase 0 stub.
 *
 * Typed `any` placeholder so the OAuth services type-check. The real
 * OAuthService (Google loopback + GitHub device flow, safeStorage token store)
 * is reimplemented in Phase 3.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const OAuthService: any = class {
  static github: any = () => ({});
};
export type OAuthService = any;
