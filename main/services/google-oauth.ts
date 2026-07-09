/**
 * Google OAuth Service
 *
 * Built lazily from stored clientId/clientSecret in config-service.
 * Supports Gmail and Calendar access.
 */

import { OAuthService } from "@glaze/core/oauth";
import { logger } from "@glaze/core/backend";
import { configService } from "./config-service.js";

let googleOAuthInstance: OAuthService | null = null;

/**
 * Return a (possibly cached) OAuthService built from stored Google credentials.
 * Throws if credentials are not yet configured.
 */
export async function getGoogleOAuth(): Promise<OAuthService> {
  const creds = await configService.getGoogleCredentials();
  if (!creds) {
    throw new Error(
      "Google credentials not configured. Set clientId and clientSecret in Settings first.",
    );
  }

  // Re-build the service when creds are present but instance was never created
  // (or after credentials were updated — caller should reset via resetGoogleOAuth).
  if (!googleOAuthInstance) {
    logger.info("google-oauth", "Building Google OAuthService from stored credentials");
    googleOAuthInstance = new OAuthService({
      providerId: "google",
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/youtube.readonly",
      ],
      extraAuthorizationParameters: {
        access_type: "offline",
        prompt: "consent",
      },
    });
  }

  return googleOAuthInstance;
}

/**
 * Reset the cached instance (call after updating credentials).
 */
export function resetGoogleOAuth(): void {
  googleOAuthInstance = null;
  logger.info("google-oauth", "Google OAuthService instance reset");
}
