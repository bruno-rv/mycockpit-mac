/**
 * @glaze/core/oauth compat — Phase 3.
 *
 * Desktop-native OAuth, no glaze.app relay:
 *  - Installed-app providers (Google) use the PKCE loopback flow: an ephemeral,
 *    one-shot `http://127.0.0.1:<port>` HTTP server captures the authorization
 *    `code`, validated against the `state` we generated.
 *  - `OAuthService.github()` uses the OAuth **device flow** (no redirect, no
 *    client secret): poll for a token while the user enters a code at
 *    github.com/login/device.
 *
 * Tokens persist via Electron `safeStorage` + a local JSON file keyed by
 * `providerId` (mirrors config-service's secrets.json pattern), so plaintext
 * tokens never touch disk or logs.
 */
import crypto from "crypto";
import fs from "fs/promises";
import http from "http";
import path from "path";

import { app, logger, safeStorage, shell } from "@glaze/core/backend";

// ─── Errors ─────────────────────────────────────────────────────────────────

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

export class OAuthProviderError extends OAuthError {
  constructor(
    readonly providerError: string,
    readonly errorDescription?: string,
  ) {
    super(errorDescription ? `${providerError}: ${errorDescription}` : providerError, "provider_error");
    this.name = "OAuthProviderError";
  }
}

// ─── Token types ────────────────────────────────────────────────────────────

export interface OAuthTokensInput {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  updatedAt?: Date;
}

export interface OAuthTokens extends OAuthTokensInput {
  updatedAt: Date;
  isExpired(): boolean;
}

type StoredTokens = Omit<OAuthTokensInput, "updatedAt"> & { updatedAt: string };

// Treat a token as expired slightly before its real expiry so a refresh has
// time to complete before an in-flight API call would 401.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

function withIsExpired(data: StoredTokens): OAuthTokens {
  const updatedAt = new Date(data.updatedAt);
  return {
    ...data,
    updatedAt,
    isExpired(): boolean {
      if (!data.expiresIn) return false;
      const expiresAt = updatedAt.getTime() + data.expiresIn * 1000;
      return Date.now() > expiresAt - EXPIRY_SAFETY_MARGIN_MS;
    },
  };
}

function tokensFromTokenResponse(json: Record<string, unknown>): OAuthTokensInput {
  return {
    accessToken: String(json.access_token ?? ""),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    idToken: typeof json.id_token === "string" ? json.id_token : undefined,
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
    tokenType: typeof json.token_type === "string" ? json.token_type : undefined,
  };
}

// ─── Token store: safeStorage + a JSON file keyed by providerId ────────────

class OAuthTokenStore {
  private storePath: string | null = null;

  private async getStorePath(): Promise<string> {
    if (!this.storePath) {
      const dir = app.getPath("userData");
      await fs.mkdir(dir, { recursive: true });
      this.storePath = path.join(dir, "oauth-tokens.json");
    }
    return this.storePath;
  }

  private async readStoreFile(): Promise<Record<string, string>> {
    try {
      const raw = await fs.readFile(await this.getStorePath(), "utf-8");
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private async writeStoreFile(data: Record<string, string>): Promise<void> {
    await fs.writeFile(await this.getStorePath(), JSON.stringify(data, null, 2));
  }

  async get(providerId: string): Promise<OAuthTokens | null> {
    try {
      const store = await this.readStoreFile();
      const encoded = store[providerId];
      if (!encoded) return null;
      const decrypted = safeStorage.decryptString(Buffer.from(encoded, "base64"));
      return withIsExpired(JSON.parse(decrypted) as StoredTokens);
    } catch (err) {
      logger.error("oauth", `Failed to read tokens for provider "${providerId}"`, err);
      return null;
    }
  }

  async set(providerId: string, tokens: OAuthTokensInput): Promise<void> {
    const payload: StoredTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expiresIn: tokens.expiresIn,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
      updatedAt: (tokens.updatedAt ?? new Date()).toISOString(),
    };
    const store = await this.readStoreFile();
    store[providerId] = safeStorage.encryptString(JSON.stringify(payload)).toString("base64");
    await this.writeStoreFile(store);
  }

  async remove(providerId: string): Promise<void> {
    const store = await this.readStoreFile();
    delete store[providerId];
    await this.writeStoreFile(store);
  }
}

const tokenStore = new OAuthTokenStore();

// ─── PKCE ───────────────────────────────────────────────────────────────────

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  return base64url(crypto.randomBytes(32));
}

export function generateCodeChallenge(codeVerifier: string): string {
  return base64url(crypto.createHash("sha256").update(codeVerifier).digest());
}

function generateState(): string {
  return base64url(crypto.randomBytes(16));
}

// ─── Loopback callback server (Google/installed-app flow) ─────────────────

const LOOPBACK_TIMEOUT_MS = 5 * 60_000; // hard 5-minute cap, then close

interface LoopbackServerHandle {
  redirectUri: string;
  /** Resolves with the authorization code once the correct-state callback lands. */
  result: Promise<{ code: string }>;
}

/**
 * Bind an ephemeral, loopback-only (127.0.0.1) HTTP server. It accepts exactly
 * one valid callback (matching `expectedState`), rejects/ignores anything
 * else, and always closes itself — on success, on provider error, on a hard
 * timeout, or if the handling request throws.
 */
function startLoopbackServer(expectedState: string): Promise<LoopbackServerHandle> {
  return new Promise((resolveServer, rejectServer) => {
    const server = http.createServer();
    let settleResult!: (v: { code: string }) => void;
    let rejectResult!: (e: Error) => void;
    const result = new Promise<{ code: string }>((res, rej) => {
      settleResult = res;
      rejectResult = rej;
    });

    let handled = false;
    const timer = setTimeout(() => {
      if (handled) return;
      handled = true;
      rejectResult(new OAuthError("Timed out waiting for the OAuth callback", "timeout"));
      server.close();
    }, LOOPBACK_TIMEOUT_MS);

    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const state = url.searchParams.get("state");

      // Wrong/missing state: refuse this request but keep listening — a
      // stray or forged hit must not be able to end the flow.
      if (state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Invalid request: state mismatch.");
        return;
      }

      if (handled) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Already handled — you can close this window.");
        return;
      }
      handled = true;
      clearTimeout(timer);

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

      if (error || !code) {
        res.end(
          `<html><body>Authorization failed: ${error ?? "no code returned"}. You can close this window.</body></html>`,
        );
        rejectResult(
          new OAuthProviderError(error ?? "missing_code", url.searchParams.get("error_description") ?? undefined),
        );
      } else {
        res.end("<html><body>Authorization complete — you can close this window and return to the app.</body></html>");
        settleResult({ code });
      }
      server.close();
    });

    server.on("error", (err) => {
      clearTimeout(timer);
      rejectServer(err);
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        clearTimeout(timer);
        rejectServer(new OAuthError("Failed to determine loopback port", "loopback_error"));
        return;
      }
      resolveServer({ redirectUri: `http://127.0.0.1:${address.port}/callback`, result });
    });
  });
}

export interface LoopbackAuthorizationOptions {
  authorizeUrl: string;
  clientId: string;
  scopes?: string[];
  extraParameters?: Record<string, string | number | boolean | undefined>;
  openExternal: (url: string) => Promise<void | boolean>;
}

export interface LoopbackAuthorizationResult {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  state: string;
}

/** Build the PKCE authorize URL, run the loopback server, open the browser, and await the code. */
export async function runPKCELoopbackAuthorization(
  options: LoopbackAuthorizationOptions,
): Promise<LoopbackAuthorizationResult> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const { redirectUri, result } = await startLoopbackServer(state);

  const authUrl = new URL(options.authorizeUrl);
  authUrl.searchParams.set("client_id", options.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  if (options.scopes?.length) authUrl.searchParams.set("scope", options.scopes.join(" "));
  for (const [key, value] of Object.entries(options.extraParameters ?? {})) {
    if (value !== undefined) authUrl.searchParams.set(key, String(value));
  }

  await options.openExternal(authUrl.toString());

  const { code } = await result;
  return { code, redirectUri, codeVerifier, state };
}

// ─── GitHub device flow ─────────────────────────────────────────────────────

interface GithubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DeviceFlowConfig {
  clientId: string;
  scope: string;
  deviceCodeUrl: string;
  tokenUrl: string;
}

/** Presented to the user so they can enter the code at the verification URI. */
export interface DeviceCodePrompt {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

// ─── OAuthService ───────────────────────────────────────────────────────────

export interface OAuthServiceOptions {
  providerId: string;
  clientId: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  refreshTokenUrl?: string;
  scopes?: string[];
  extraAuthorizationParameters?: Record<string, string | number | boolean | undefined>;
  extraTokenParameters?: Record<string, string | number | boolean | undefined>;
  tokenHeaders?: Record<string, string>;
  fetch?: typeof fetch;
  openExternal?: (url: string) => Promise<void | boolean>;
  /** Device-flow only: surface the user_code + verification URI to the user. */
  onDeviceCode?: (prompt: DeviceCodePrompt) => void | Promise<void>;
}

export interface OAuthProviderWithDefaultClientOptions {
  providerId?: string;
  clientId: string;
  scope: string | string[];
  openExternal?: (url: string) => Promise<void | boolean>;
  fetch?: typeof fetch;
  onDeviceCode?: (prompt: DeviceCodePrompt) => void | Promise<void>;
}

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

export class OAuthService {
  private readonly options: OAuthServiceOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly openExternalImpl: (url: string) => Promise<void | boolean>;
  private readonly onDeviceCode?: (prompt: DeviceCodePrompt) => void | Promise<void>;
  private readonly deviceFlow: DeviceFlowConfig | null;

  constructor(options: OAuthServiceOptions, deviceFlow: DeviceFlowConfig | null = null) {
    this.options = options;
    this.fetchImpl = options.fetch ?? fetch;
    this.openExternalImpl = options.openExternal ?? ((url) => shell.openExternal(url));
    this.onDeviceCode = options.onDeviceCode;
    this.deviceFlow = deviceFlow;
  }

  async authorize(): Promise<OAuthTokens> {
    const tokens = this.deviceFlow ? await this.authorizeDeviceFlow(this.deviceFlow) : await this.authorizeLoopback();
    await tokenStore.set(this.options.providerId, tokens);
    return withIsExpired({ ...tokens, updatedAt: (tokens.updatedAt ?? new Date()).toISOString() });
  }

  private async authorizeLoopback(): Promise<OAuthTokensInput> {
    const { code, redirectUri, codeVerifier } = await runPKCELoopbackAuthorization({
      authorizeUrl: this.options.authorizeUrl,
      clientId: this.options.clientId,
      scopes: this.options.scopes,
      extraParameters: this.options.extraAuthorizationParameters,
      openExternal: this.openExternalImpl,
    });
    return this.exchangeAuthorizationCode(code, redirectUri, codeVerifier);
  }

  private async exchangeAuthorizationCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<OAuthTokensInput> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: this.options.clientId,
      code_verifier: codeVerifier,
    });
    if (this.options.clientSecret) body.set("client_secret", this.options.clientSecret);
    for (const [key, value] of Object.entries(this.options.extraTokenParameters ?? {})) {
      if (value !== undefined) body.set(key, String(value));
    }

    const response = await this.fetchImpl(this.options.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        ...this.options.tokenHeaders,
      },
      body,
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || !json.access_token) {
      throw new OAuthProviderError(
        typeof json.error === "string" ? json.error : String(response.status),
        typeof json.error_description === "string" ? json.error_description : undefined,
      );
    }
    return tokensFromTokenResponse(json);
  }

  async getAccessToken(): Promise<string> {
    const tokens = await this.getTokens();
    if (!tokens) throw new OAuthError("Not authorized — call authorize() first", "not_authorized");
    if (!tokens.isExpired()) return tokens.accessToken;
    return this.resolveAccessToken(tokens);
  }

  private async resolveAccessToken(tokens: OAuthTokens): Promise<string> {
    if (this.deviceFlow || !tokens.refreshToken) {
      throw new OAuthError("Access token expired and cannot be refreshed — reauthorize", "token_expired");
    }
    const refreshed = await this.refreshAccessToken(tokens.refreshToken);
    await tokenStore.set(this.options.providerId, refreshed);
    return refreshed.accessToken;
  }

  private async refreshAccessToken(refreshToken: string): Promise<OAuthTokensInput> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.options.clientId,
    });
    if (this.options.clientSecret) body.set("client_secret", this.options.clientSecret);

    const response = await this.fetchImpl(this.options.refreshTokenUrl ?? this.options.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || !json.access_token) {
      throw new OAuthProviderError(
        typeof json.error === "string" ? json.error : String(response.status),
        typeof json.error_description === "string" ? json.error_description : undefined,
      );
    }
    const refreshed = tokensFromTokenResponse(json);
    // Google (and most providers) omit refresh_token on refresh responses — keep the original.
    return { ...refreshed, refreshToken: refreshed.refreshToken ?? refreshToken };
  }

  async getTokens(): Promise<OAuthTokens | null> {
    return tokenStore.get(this.options.providerId);
  }

  async setTokens(tokens: OAuthTokensInput): Promise<void> {
    await tokenStore.set(this.options.providerId, tokens);
  }

  async removeTokens(): Promise<void> {
    await tokenStore.remove(this.options.providerId);
  }

  static async withAccessToken<T>(
    service: OAuthService,
    handler: (accessToken: string) => T | Promise<T>,
  ): Promise<T> {
    return handler(await service.getAccessToken());
  }

  /**
   * GitHub OAuth device flow. Unlike Glaze's SDK, there is no bundled default
   * client here — the caller (main/services/github-oauth.ts) supplies the
   * user-configured `clientId`. No client secret, no redirect/loopback.
   */
  static github(options: OAuthProviderWithDefaultClientOptions): OAuthService {
    const scope = Array.isArray(options.scope) ? options.scope.join(" ") : options.scope;
    const providerId = options.providerId ?? "github";
    return new OAuthService(
      {
        providerId,
        clientId: options.clientId,
        authorizeUrl: GITHUB_DEVICE_CODE_URL,
        tokenUrl: GITHUB_TOKEN_URL,
        fetch: options.fetch,
        openExternal: options.openExternal,
        onDeviceCode: options.onDeviceCode,
      },
      { clientId: options.clientId, scope, deviceCodeUrl: GITHUB_DEVICE_CODE_URL, tokenUrl: GITHUB_TOKEN_URL },
    );
  }

  private async authorizeDeviceFlow(flow: DeviceFlowConfig): Promise<OAuthTokensInput> {
    const deviceCode = await this.requestDeviceCode(flow);
    logger.info(
      "oauth",
      `[device-flow] open ${deviceCode.verification_uri} and enter code ${deviceCode.user_code}`,
    );
    // GitHub does not return verification_uri_complete, so the user lands on a
    // bare page asking for a code. Surface the code (dialog + clipboard) BEFORE
    // opening the browser, otherwise the flow is uncompletable.
    await this.onDeviceCode?.({
      userCode: deviceCode.user_code,
      verificationUri: deviceCode.verification_uri,
      expiresIn: deviceCode.expires_in,
    });
    await this.openExternalImpl(deviceCode.verification_uri_complete ?? deviceCode.verification_uri);
    return this.pollDeviceToken(flow, deviceCode);
  }

  private async requestDeviceCode(flow: DeviceFlowConfig): Promise<GithubDeviceCodeResponse> {
    const response = await this.fetchImpl(flow.deviceCodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: flow.clientId, scope: flow.scope }),
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || !json.device_code) {
      throw new OAuthProviderError(
        typeof json.error === "string" ? json.error : String(response.status),
        typeof json.error_description === "string" ? json.error_description : undefined,
      );
    }
    return json as unknown as GithubDeviceCodeResponse;
  }

  /** Poll the token endpoint, honoring the provider's `interval` and `slow_down` backoff. */
  private async pollDeviceToken(
    flow: DeviceFlowConfig,
    deviceCode: GithubDeviceCodeResponse,
  ): Promise<OAuthTokensInput> {
    let intervalMs = (deviceCode.interval || 5) * 1000;
    const deadline = Date.now() + (deviceCode.expires_in || 900) * 1000;

    while (Date.now() < deadline) {
      await sleep(intervalMs);

      const response = await this.fetchImpl(flow.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          client_id: flow.clientId,
          device_code: deviceCode.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });
      const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (typeof json.access_token === "string") {
        return tokensFromTokenResponse(json);
      }

      const errorCode = typeof json.error === "string" ? json.error : undefined;
      switch (errorCode) {
        case "authorization_pending":
          continue;
        case "slow_down":
          intervalMs += 5_000;
          continue;
        case "expired_token":
          throw new OAuthError("Device code expired before authorization completed", "expired_token");
        case "access_denied":
          throw new OAuthProviderError("access_denied", "The user denied the authorization request");
        default:
          throw new OAuthProviderError(
            errorCode ?? String(response.status),
            typeof json.error_description === "string" ? json.error_description : undefined,
          );
      }
    }
    throw new OAuthError("Device flow timed out waiting for user authorization", "timeout");
  }
}
