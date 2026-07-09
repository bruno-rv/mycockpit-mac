/**
 * Config Handlers
 *
 * Implements the config:* IPC contract.
 * After any mutation, broadcasts "config:changed" with the full payload.
 */

import { ipcMain, logger } from "@glaze/core/backend";
import { configService, type RssFeed, type Website } from "../services/config-service.js";
import { resetGoogleOAuth } from "../services/google-oauth.js";

async function broadcastConfigChanged(): Promise<void> {
  const payload = await configService.getFullPayload();
  ipcMain.broadcast("config:changed", payload);
}

export function registerConfigHandlers(): void {
  ipcMain.handle("config:get", async () => {
    logger.info("config", "[config:get] fetching full config payload");
    const payload = await configService.getFullPayload();
    logger.info("config", "[config:get] ok", {
      aiProvider: payload.aiProvider,
      rssFeedCount: payload.rssFeeds.length,
    });
    return payload;
  });

  ipcMain.handle("config:setAiProvider", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("provider" in params) ||
      (params as { provider: unknown }).provider !== "anthropic" &&
        (params as { provider: unknown }).provider !== "openai"
    ) {
      throw new Error('config:setAiProvider requires { provider: "anthropic" | "openai" }');
    }
    const { provider } = params as { provider: "anthropic" | "openai" };
    logger.info("config", `[config:setAiProvider] provider=${provider}`);
    await configService.setAiProvider(provider);
    await broadcastConfigChanged();
    return { ok: true };
  });

  ipcMain.handle("config:setApiKey", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("provider" in params) ||
      !("key" in params) ||
      typeof (params as { key: unknown }).key !== "string"
    ) {
      throw new Error(
        'config:setApiKey requires { provider: "anthropic" | "openai", key: string }',
      );
    }
    const { provider, key } = params as { provider: string; key: string };
    if (provider !== "anthropic" && provider !== "openai") {
      throw new Error(`Unknown provider "${provider}". Must be "anthropic" or "openai".`);
    }
    logger.info("config", `[config:setApiKey] provider=${provider}`);
    await configService.setApiKey(provider, key);
    await broadcastConfigChanged();
    return { ok: true };
  });

  ipcMain.handle("config:clearApiKey", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("provider" in params)
    ) {
      throw new Error(
        'config:clearApiKey requires { provider: "anthropic" | "openai" }',
      );
    }
    const { provider } = params as { provider: string };
    if (provider !== "anthropic" && provider !== "openai") {
      throw new Error(`Unknown provider "${provider}". Must be "anthropic" or "openai".`);
    }
    logger.info("config", `[config:clearApiKey] provider=${provider}`);
    await configService.clearApiKey(provider);
    await broadcastConfigChanged();
    return { ok: true };
  });

  ipcMain.handle("config:setRssFeeds", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("feeds" in params) ||
      !Array.isArray((params as { feeds: unknown }).feeds)
    ) {
      throw new Error("config:setRssFeeds requires { feeds: {title, url}[] }");
    }
    const { feeds } = params as { feeds: unknown[] };
    const validated: RssFeed[] = feeds.map((f, i) => {
      if (
        typeof f !== "object" ||
        f === null ||
        typeof (f as { title: unknown }).title !== "string" ||
        typeof (f as { url: unknown }).url !== "string"
      ) {
        throw new Error(`feeds[${i}] must have title and url strings`);
      }
      return { title: (f as { title: string }).title, url: (f as { url: string }).url };
    });
    logger.info("config", `[config:setRssFeeds] count=${validated.length}`);
    await configService.setRssFeeds(validated);
    await broadcastConfigChanged();
    return { ok: true };
  });

  ipcMain.handle("config:setWebsites", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("websites" in params) ||
      !Array.isArray((params as { websites: unknown }).websites)
    ) {
      throw new Error("config:setWebsites requires { websites: {title, url}[] }");
    }
    const { websites } = params as { websites: unknown[] };
    const validated: Website[] = websites.map((w, i) => {
      if (
        typeof w !== "object" ||
        w === null ||
        typeof (w as { title: unknown }).title !== "string" ||
        typeof (w as { url: unknown }).url !== "string"
      ) {
        throw new Error(`websites[${i}] must have title and url strings`);
      }
      return { title: (w as { title: string }).title, url: (w as { url: string }).url };
    });
    logger.info("config", `[config:setWebsites] count=${validated.length}`);
    await configService.setWebsites(validated);
    await broadcastConfigChanged();
    return { ok: true };
  });

  ipcMain.handle("config:setYouTube", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("videoId" in params) ||
      typeof (params as { videoId: unknown }).videoId !== "string"
    ) {
      throw new Error("config:setYouTube requires { videoId: string, title?: string }");
    }
    const { videoId, title } = params as { videoId: string; title?: string };
    logger.info("config", `[config:setYouTube] videoId=${videoId}`);
    await configService.setYouTube(videoId, title);
    await broadcastConfigChanged();
    return { ok: true };
  });

  ipcMain.handle("config:clearGoogleCredentials", async () => {
    logger.info("config", "[config:clearGoogleCredentials] removing credentials");
    await configService.clearGoogleCredentials();
    resetGoogleOAuth();
    await broadcastConfigChanged();
    return { ok: true };
  });

  ipcMain.handle("config:setGoogleCredentials", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("clientId" in params) ||
      !("clientSecret" in params) ||
      typeof (params as { clientId: unknown }).clientId !== "string" ||
      typeof (params as { clientSecret: unknown }).clientSecret !== "string"
    ) {
      throw new Error(
        "config:setGoogleCredentials requires { clientId: string, clientSecret: string }",
      );
    }
    const { clientId, clientSecret } = params as { clientId: string; clientSecret: string };
    logger.info("config", "[config:setGoogleCredentials] storing credentials");
    await configService.setGoogleCredentials(clientId, clientSecret);
    // Reset cached Google OAuth service so it picks up new creds
    resetGoogleOAuth();
    await broadcastConfigChanged();
    return { ok: true };
  });

  logger.info("config", "Config handlers registered");
}
