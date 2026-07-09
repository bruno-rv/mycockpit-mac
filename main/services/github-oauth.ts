/**
 * GitHub OAuth Service
 *
 * Device flow — no client secret, no redirect. Built lazily from the
 * user-configured client ID in config-service (mirrors google-oauth.ts).
 */

import { clipboard, dialog } from "electron";

import { OAuthService } from "@glaze/core/oauth";
import { logger } from "@glaze/core/backend";
import { configService } from "./config-service.js";

let githubOAuthInstance: OAuthService | null = null;

/**
 * Device flow returns a user_code the user must type at github.com/login/device
 * (GitHub does not provide a pre-filled verification_uri_complete). Copy it to
 * the clipboard and show it in a modal so the flow is actually completable,
 * then the service opens the browser.
 */
async function promptDeviceCode({
  userCode,
  verificationUri,
}: {
  userCode: string;
  verificationUri: string;
}): Promise<void> {
  clipboard.writeText(userCode);
  logger.info("github-oauth", `[device-flow] user_code=${userCode} copied to clipboard`);
  await dialog.showMessageBox({
    type: "info",
    title: "Connect GitHub",
    message: `Enter this code on GitHub to connect:\n\n${userCode}`,
    detail: `The code has been copied to your clipboard. Click OK to open ${verificationUri} in your browser, then paste the code to authorize. This window will finish connecting automatically once you approve.`,
    buttons: ["OK"],
    defaultId: 0,
  });
}

/**
 * Return a (possibly cached) OAuthService built from the stored GitHub client ID.
 * Throws if the client ID is not yet configured.
 */
export async function getGithubOAuth(): Promise<OAuthService> {
  const clientId = await configService.getGitHubClientId();
  if (!clientId) {
    throw new Error("GitHub client ID not configured. Set it in Settings first.");
  }

  if (!githubOAuthInstance) {
    logger.info("github-oauth", "Building GitHub OAuthService (device flow) from stored client ID");
    githubOAuthInstance = OAuthService.github({
      clientId,
      scope: "read:user",
      onDeviceCode: promptDeviceCode,
    });
  }

  return githubOAuthInstance;
}

/**
 * Reset the cached instance (call after updating the client ID).
 */
export function resetGithubOAuth(): void {
  githubOAuthInstance = null;
  logger.info("github-oauth", "GitHub OAuthService instance reset");
}
