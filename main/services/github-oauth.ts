/**
 * GitHub OAuth Service
 *
 * Uses OAuthService.github preset. Scope: read:user for profile.
 */

import { OAuthService } from "@glaze/core/oauth";

export const githubOAuth = OAuthService.github({
  scope: "read:user",
});
