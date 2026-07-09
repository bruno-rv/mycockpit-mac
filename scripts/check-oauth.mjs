#!/usr/bin/env node
/**
 * Runnable check for src/glaze-compat/oauth/index.ts (Phase 3).
 *
 * No test framework — plain Node assertions against the real module (via an
 * esbuild-backed loader, see oauth-check.loader.mjs) with `electron` replaced
 * by a minimal mock (safeStorage/app/shell) so it runs outside Electron.
 *
 * Covers:
 *  (a) Google-style authorize URL contains code_challenge/state/redirect_uri=127.0.0.1
 *  (b) loopback callback server accepts the correct state, rejects the wrong one
 *  (c) token store encrypt/decrypt round-trip (via OAuthService.setTokens/getTokens/removeTokens)
 *  (d) GitHub device-flow poll request body shape + interval/slow_down handling
 *
 * Usage: node scripts/check-oauth.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(scriptDir, "..");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ok - ${message}`);
  } else {
    failed++;
    console.error(`  FAIL - ${message}`);
  }
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function checkLoopbackAuthorization(runPKCELoopbackAuthorization) {
  console.log("\n[a+b] Google-style PKCE loopback authorization");

  let capturedUrl;
  const authPromise = runPKCELoopbackAuthorization({
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: "fake-client-id.apps.googleusercontent.com",
    scopes: ["email"],
    openExternal: async (url) => {
      capturedUrl = url;
    },
  });

  // The server binds (async) before openExternal is invoked; give the
  // in-process loopback listener a moment to come up.
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert(!!capturedUrl, "authorize URL was constructed and passed to openExternal");
  const authUrl = new URL(capturedUrl);
  const redirectUri = authUrl.searchParams.get("redirect_uri");
  const state = authUrl.searchParams.get("state");

  assert(!!authUrl.searchParams.get("code_challenge"), "authorize URL contains code_challenge");
  assert(authUrl.searchParams.get("code_challenge_method") === "S256", "code_challenge_method is S256");
  assert(!!state, "authorize URL contains state");
  assert(!!redirectUri && redirectUri.startsWith("http://127.0.0.1:"), "redirect_uri is a 127.0.0.1 loopback URL");

  // Wrong state must be rejected and must NOT complete the flow.
  const wrongStateUrl = new URL(redirectUri);
  wrongStateUrl.searchParams.set("code", "wrong-code");
  wrongStateUrl.searchParams.set("state", "not-the-real-state");
  const wrongRes = await fetch(wrongStateUrl);
  assert(wrongRes.status === 400, "loopback server rejects a callback with the wrong state (400)");

  // Correct state completes the flow with the expected code.
  const correctUrl = new URL(redirectUri);
  correctUrl.searchParams.set("code", "test-auth-code-123");
  correctUrl.searchParams.set("state", state);
  const correctRes = await fetch(correctUrl);
  assert(correctRes.ok, "loopback server accepts the callback with the correct state");

  const result = await authPromise;
  assert(result.code === "test-auth-code-123", "authorization result carries the code from the correct callback");
  assert(!!result.codeVerifier, "a PKCE code verifier was generated");
}

async function checkTokenStoreRoundTrip(OAuthService) {
  console.log("\n[c] Token store encrypt/decrypt round-trip (mocked safeStorage)");

  const svc = new OAuthService({
    providerId: "check-provider",
    clientId: "client-x",
    authorizeUrl: "https://example.com/auth",
    tokenUrl: "https://example.com/token",
  });

  await svc.setTokens({ accessToken: "abc123", refreshToken: "ref456", expiresIn: 3600 });
  const tokens = await svc.getTokens();
  assert(!!tokens, "tokens were persisted");
  assert(tokens?.accessToken === "abc123", "accessToken round-trips through encrypt/decrypt");
  assert(tokens?.refreshToken === "ref456", "refreshToken round-trips through encrypt/decrypt");
  assert(typeof tokens?.isExpired === "function" && tokens.isExpired() === false, "fresh token reports isExpired() === false");

  await svc.removeTokens();
  const afterRemove = await svc.getTokens();
  assert(afterRemove === null, "removeTokens() clears the stored entry");
}

async function checkDeviceFlowPolling(OAuthService) {
  console.log("\n[d] GitHub device-flow poll request shape (interval + slow_down)");

  const calls = [];
  let pollCount = 0;
  const mockFetch = async (url, init) => {
    const urlStr = String(url);
    calls.push({ url: urlStr, method: init?.method, body: init?.body ? String(init.body) : "" });

    if (urlStr === "https://github.com/login/device/code") {
      return jsonResponse(200, {
        device_code: "dc-123",
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 0.05, // seconds — tiny so the check runs fast
      });
    }
    if (urlStr === "https://github.com/login/oauth/access_token") {
      pollCount++;
      if (pollCount === 1) return jsonResponse(200, { error: "authorization_pending" });
      if (pollCount === 2) return jsonResponse(200, { error: "slow_down" });
      return jsonResponse(200, { access_token: "gh-token-xyz", token_type: "bearer", scope: "read:user" });
    }
    throw new Error(`Unexpected fetch to ${urlStr}`);
  };

  let devicePrompt = null;
  const svc = OAuthService.github({
    clientId: "gh-client-id",
    scope: "read:user",
    fetch: mockFetch,
    openExternal: async () => {},
    onDeviceCode: (prompt) => {
      devicePrompt = prompt;
    },
  });

  const tokens = await svc.authorize();
  assert(tokens.accessToken === "gh-token-xyz", "device flow resolves the access token after polling");
  assert(
    devicePrompt?.userCode === "ABCD-1234" && devicePrompt?.verificationUri === "https://github.com/login/device",
    "onDeviceCode surfaced the user_code + verification URI to the user before polling",
  );
  assert(
    pollCount >= 3,
    `poll loop honored authorization_pending + slow_down before succeeding (polls=${pollCount})`,
  );

  const deviceCodeCall = calls.find((c) => c.url === "https://github.com/login/device/code");
  assert(deviceCodeCall?.method === "POST", "device code request is a POST");
  const deviceParams = new URLSearchParams(deviceCodeCall.body);
  assert(deviceParams.get("client_id") === "gh-client-id", "device code request body carries client_id");
  assert(deviceParams.get("scope") === "read:user", "device code request body carries scope");

  const pollCall = calls.find((c) => c.url === "https://github.com/login/oauth/access_token");
  const pollParams = new URLSearchParams(pollCall.body);
  assert(pollParams.get("client_id") === "gh-client-id", "poll request body carries client_id");
  assert(pollParams.get("device_code") === "dc-123", "poll request body carries device_code");
  assert(
    pollParams.get("grant_type") === "urn:ietf:params:oauth:grant-type:device_code",
    "poll request body uses the device_code grant_type",
  );

  await svc.removeTokens();
}

async function main() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), "oauth-check-"));
  process.env.OAUTH_CHECK_USERDATA = userDataDir;

  register("./oauth-check.loader.mjs", import.meta.url);

  const oauthModuleUrl = pathToFileURL(path.join(projectRoot, "src/glaze-compat/oauth/index.ts")).href;
  const { OAuthService, runPKCELoopbackAuthorization } = await import(oauthModuleUrl);

  try {
    await checkLoopbackAuthorization(runPKCELoopbackAuthorization);
    await checkTokenStoreRoundTrip(OAuthService);
    await checkDeviceFlowPolling(OAuthService);
  } finally {
    await rm(userDataDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nCheck script crashed:", err);
  process.exit(1);
});
