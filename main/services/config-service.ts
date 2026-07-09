/**
 * Config Service
 *
 * Stores non-secret app configuration as JSON in userData.
 * Stores API keys encrypted via safeStorage.
 */

import fs from "fs/promises";
import path from "path";

import { app, safeStorage, logger } from "@glaze/core/backend";

export interface RssFeed {
  title: string;
  url: string;
}

export interface Website {
  title: string;
  url: string;
}

export interface YouTubeConfig {
  videoId?: string;
  title?: string;
}

export interface AppConfig {
  aiProvider: "anthropic" | "openai";
  rssFeeds: RssFeed[];
  websites: Website[];
  youtube: YouTubeConfig;
}

export interface ConfigGetPayload extends AppConfig {
  hasAnthropicKey: boolean;
  hasOpenAIKey: boolean;
  hasGoogleCreds: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  aiProvider: "anthropic",
  rssFeeds: [
    { title: "Hacker News", url: "https://hnrss.org/frontpage" },
    { title: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  ],
  websites: [],
  youtube: {},
};

class ConfigService {
  private configCache: AppConfig | null = null;
  private configPath: string | null = null;
  private secretsPath: string | null = null;

  private async getUserDataPath(): Promise<string> {
    const p = app.getPath("userData");
    await fs.mkdir(p, { recursive: true });
    return p;
  }

  private async getConfigPath(): Promise<string> {
    if (!this.configPath) {
      this.configPath = path.join(await this.getUserDataPath(), "config.json");
    }
    return this.configPath;
  }

  private async getSecretsPath(): Promise<string> {
    if (!this.secretsPath) {
      this.secretsPath = path.join(await this.getUserDataPath(), "secrets.json");
    }
    return this.secretsPath;
  }

  async loadConfig(): Promise<AppConfig> {
    if (this.configCache !== null) return this.configCache;
    try {
      const configPath = await this.getConfigPath();
      const raw = await fs.readFile(configPath, "utf-8");
      this.configCache = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      this.configCache = { ...DEFAULT_CONFIG };
    }
    return this.configCache!;
  }

  private async saveConfig(config: AppConfig): Promise<void> {
    this.configCache = config;
    const configPath = await this.getConfigPath();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  // Secrets are stored as a JSON map of encrypted base64 strings
  private async readSecrets(): Promise<Record<string, string>> {
    try {
      const secretsPath = await this.getSecretsPath();
      const raw = await fs.readFile(secretsPath, "utf-8");
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private async writeSecrets(secrets: Record<string, string>): Promise<void> {
    const secretsPath = await this.getSecretsPath();
    await fs.writeFile(secretsPath, JSON.stringify(secrets, null, 2));
  }

  async getApiKey(provider: "anthropic" | "openai"): Promise<string | null> {
    try {
      const secrets = await this.readSecrets();
      const encoded = secrets[`apiKey_${provider}`];
      if (!encoded) return null;
      const buf = Buffer.from(encoded, "base64");
      return await safeStorage.decryptString(buf);
    } catch (err) {
      logger.error("config-service", `Failed to decrypt ${provider} key`, err);
      return null;
    }
  }

  async setApiKey(provider: "anthropic" | "openai", key: string): Promise<void> {
    const secrets = await this.readSecrets();
    const encrypted = await safeStorage.encryptString(key);
    secrets[`apiKey_${provider}`] = encrypted.toString("base64");
    await this.writeSecrets(secrets);
    logger.info("config-service", `[config:setApiKey] provider=${provider}`);
  }

  async clearApiKey(provider: "anthropic" | "openai"): Promise<void> {
    const secrets = await this.readSecrets();
    delete secrets[`apiKey_${provider}`];
    await this.writeSecrets(secrets);
    logger.info("config-service", `[config:clearApiKey] provider=${provider}`);
  }

  async hasApiKey(provider: "anthropic" | "openai"): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return key !== null && key.length > 0;
  }

  // Google credentials stored encrypted
  async getGoogleCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
    try {
      const secrets = await this.readSecrets();
      const encoded = secrets["google_creds"];
      if (!encoded) return null;
      const buf = Buffer.from(encoded, "base64");
      const decrypted = await safeStorage.decryptString(buf);
      return JSON.parse(decrypted) as { clientId: string; clientSecret: string };
    } catch (err) {
      logger.error("config-service", "Failed to decrypt google credentials", err);
      return null;
    }
  }

  async setGoogleCredentials(clientId: string, clientSecret: string): Promise<void> {
    const secrets = await this.readSecrets();
    const payload = JSON.stringify({ clientId, clientSecret });
    const encrypted = await safeStorage.encryptString(payload);
    secrets["google_creds"] = encrypted.toString("base64");
    await this.writeSecrets(secrets);
    logger.info("config-service", "[config:setGoogleCredentials] Google credentials stored");
  }

  async clearGoogleCredentials(): Promise<void> {
    const secrets = await this.readSecrets();
    delete secrets["google_creds"];
    await this.writeSecrets(secrets);
    logger.info("config-service", "[config:clearGoogleCredentials] Google credentials removed");
  }

  async hasGoogleCredentials(): Promise<boolean> {
    const creds = await this.getGoogleCredentials();
    return creds !== null;
  }

  async getFullPayload(): Promise<ConfigGetPayload> {
    const config = await this.loadConfig();
    const [hasAnthropicKey, hasOpenAIKey, hasGoogleCreds] = await Promise.all([
      this.hasApiKey("anthropic"),
      this.hasApiKey("openai"),
      this.hasGoogleCredentials(),
    ]);
    return {
      ...config,
      hasAnthropicKey,
      hasOpenAIKey,
      hasGoogleCreds,
    };
  }

  async setAiProvider(provider: "anthropic" | "openai"): Promise<void> {
    const config = await this.loadConfig();
    config.aiProvider = provider;
    await this.saveConfig(config);
    logger.info("config-service", `[config:setAiProvider] provider=${provider}`);
  }

  async setRssFeeds(feeds: RssFeed[]): Promise<void> {
    const config = await this.loadConfig();
    config.rssFeeds = feeds;
    await this.saveConfig(config);
    logger.info("config-service", `[config:setRssFeeds] count=${feeds.length}`);
  }

  async setWebsites(websites: Website[]): Promise<void> {
    const config = await this.loadConfig();
    config.websites = websites;
    await this.saveConfig(config);
    logger.info("config-service", `[config:setWebsites] count=${websites.length}`);
  }

  async setYouTube(videoId: string, title?: string): Promise<void> {
    const config = await this.loadConfig();
    config.youtube = { videoId, title };
    await this.saveConfig(config);
    logger.info("config-service", `[config:setYouTube] videoId=${videoId}`);
  }
}

export const configService = new ConfigService();
