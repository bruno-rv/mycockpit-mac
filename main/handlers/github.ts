/**
 * GitHub Handlers
 *
 * Implements the github:* IPC contract.
 * Uses the GitHub OAuth preset for authentication.
 * Trending repos use the Search API with a date window.
 */

import { ipcMain, logger } from "@glaze/core/backend";
import { configService } from "../services/config-service.js";
import { getGithubOAuth } from "../services/github-oauth.js";

type GitHubSince = "daily" | "weekly" | "monthly";

function sinceToDate(since: GitHubSince): string {
  const now = new Date();
  if (since === "daily") {
    now.setDate(now.getDate() - 1);
  } else if (since === "weekly") {
    now.setDate(now.getDate() - 7);
  } else {
    now.setDate(now.getDate() - 30);
  }
  return now.toISOString().slice(0, 10);
}

interface GitHubUserResponse {
  login: string;
  avatar_url: string;
}

interface GitHubSearchItem {
  full_name: string;
  owner: { login: string };
  name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  html_url: string;
}

interface GitHubSearchResponse {
  items: GitHubSearchItem[];
}

export function registerGitHubHandlers(): void {
  ipcMain.handle("github:getStatus", async () => {
    logger.info("github", "[github:getStatus] checking connection status");
    const configured = await configService.hasGitHubClientId();
    if (!configured) {
      logger.info("github", "[github:getStatus] not configured");
      return { connected: false, configured: false };
    }
    try {
      const githubOAuth = await getGithubOAuth();
      const tokens = await githubOAuth.getTokens();
      if (!tokens) {
        logger.info("github", "[github:getStatus] not connected");
        return { connected: false, configured: true };
      }
      const accessToken = await githubOAuth.getAccessToken();
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!response.ok) {
        logger.warn("github", `[github:getStatus] user fetch failed: ${response.status}`);
        return { connected: false, configured: true };
      }
      const user = (await response.json()) as GitHubUserResponse;
      logger.info("github", `[github:getStatus] connected as ${user.login}`);
      return { connected: true, configured: true, login: user.login, avatarUrl: user.avatar_url };
    } catch (err) {
      logger.error("github", "[github:getStatus] error", err);
      return { connected: false, configured };
    }
  });

  ipcMain.handle("github:connect", async () => {
    logger.info("github", "[github:connect] starting OAuth flow");
    const githubOAuth = await getGithubOAuth();
    await githubOAuth.authorize();
    const accessToken = await githubOAuth.getAccessToken();
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `GitHub user fetch failed after connect: ${response.status} — ${errText}`,
      );
    }
    const user = (await response.json()) as GitHubUserResponse;
    logger.info("github", `[github:connect] connected as ${user.login}`);
    return { connected: true, login: user.login };
  });

  ipcMain.handle("github:disconnect", async () => {
    logger.info("github", "[github:disconnect] removing tokens");
    try {
      const githubOAuth = await getGithubOAuth();
      await githubOAuth.removeTokens();
    } catch {
      // Not configured — no tokens could have been stored anyway
    }
    return { connected: false };
  });

  ipcMain.handle("github:getTrending", async (_event, params: unknown) => {
    if (typeof params !== "object" || params === null || !("since" in params)) {
      throw new Error(
        'github:getTrending requires { since: "daily" | "weekly" | "monthly", language?: string }',
      );
    }
    const { since, language } = params as { since: string; language?: string };
    if (since !== "daily" && since !== "weekly" && since !== "monthly") {
      throw new Error('github:getTrending: since must be "daily", "weekly", or "monthly"');
    }

    const dateThreshold = sinceToDate(since as GitHubSince);
    const langFilter = language ? `+language:${encodeURIComponent(language)}` : "";
    const queryUrl =
      `https://api.github.com/search/repositories?q=created:>${dateThreshold}${langFilter}` +
      `&sort=stars&order=desc&per_page=20`;

    logger.info("github", `[github:getTrending] since=${since} language=${language ?? "any"} dateThreshold=${dateThreshold}`);

    // Use auth token if connected for higher rate limit
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    try {
      const githubOAuth = await getGithubOAuth();
      const tokens = await githubOAuth.getTokens();
      if (tokens) {
        const accessToken = await githubOAuth.getAccessToken();
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
    } catch {
      // Not configured/connected — unauthenticated fallback (lower rate limit, still works)
    }

    const response = await fetch(queryUrl, { headers });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `GitHub search API error: ${response.status} ${response.statusText} — ${errText}`,
      );
    }

    const data = (await response.json()) as GitHubSearchResponse;

    const repos = data.items.map((item) => ({
      fullName: item.full_name,
      owner: item.owner.login,
      name: item.name,
      description: item.description ?? "",
      stars: item.stargazers_count,
      language: item.language ?? null,
      url: item.html_url,
    }));

    logger.info("github", `[github:getTrending] returned ${repos.length} repos`);
    return { repos };
  });

  logger.info("github", "GitHub handlers registered");
}
