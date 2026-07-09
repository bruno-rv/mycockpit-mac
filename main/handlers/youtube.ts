/**
 * YouTube Handlers
 *
 * Implements the youtube:* IPC contract using the YouTube Data API v3.
 * Authentication reuses the Google OAuthService (youtube.readonly scope).
 *
 * - youtube:search                → keyword video search
 * - youtube:getSubscriptionsFeed  → latest uploads from the user's subscriptions
 *
 * When the signed-in token lacks the youtube.readonly scope (e.g. the user
 * connected Google before this feature existed), handlers return
 * { needsReauth: true } so the UI can prompt a reconnect.
 */

import { BrowserWindow, ipcMain, logger, shell } from "@glaze/core/backend";
import { getGoogleOAuth } from "../services/google-oauth.js";

const API_BASE = "https://www.googleapis.com/youtube/v3";

interface YtVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
}

interface YtResult {
  videos: YtVideo[];
  needsConnect?: boolean;
  needsReauth?: boolean;
  /** The YouTube Data API v3 is not enabled in the user's Google Cloud project. */
  needsApiEnable?: boolean;
  /** Direct activation URL for the YouTube Data API in the user's project. */
  apiEnableUrl?: string;
}

// Default activation page if Google's error payload omits a project-specific URL.
const YOUTUBE_API_CONSOLE_URL =
  "https://console.developers.google.com/apis/api/youtube.googleapis.com/overview";

// ─── API response shapes (partial) ─────────────────────────────────────────────

interface SearchThumbnail {
  url: string;
}
interface SearchSnippet {
  title?: string;
  channelTitle?: string;
  publishedAt?: string;
  thumbnails?: { medium?: SearchThumbnail; default?: SearchThumbnail };
  resourceId?: { videoId?: string };
}
interface SearchListResponse {
  items?: { id?: { videoId?: string }; snippet?: SearchSnippet }[];
}
interface SubscriptionsListResponse {
  items?: { snippet?: { title?: string; resourceId?: { channelId?: string } } }[];
}
interface ChannelsListResponse {
  items?: { id?: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
}
interface PlaylistItemsResponse {
  items?: { snippet?: SearchSnippet }[];
}
interface VideosListResponse {
  items?: { id?: string; snippet?: SearchSnippet }[];
}

function thumbOf(s?: SearchSnippet): string {
  return s?.thumbnails?.medium?.url ?? s?.thumbnails?.default?.url ?? "";
}

/**
 * Resolve a YouTube access token, or a structured reason it isn't available.
 */
async function getYouTubeToken(): Promise<
  { token: string } | { result: YtResult }
> {
  const oauth = await getGoogleOAuth(); // throws only if creds not configured
  const tokens = await oauth.getTokens();
  if (!tokens) {
    return { result: { videos: [], needsConnect: true } };
  }
  const token = await oauth.getAccessToken();
  return { token };
}

/**
 * Fetch JSON from the YouTube API. Returns a structured reason on a 403 so
 * callers can surface the right prompt:
 *  - { scopeError: true }                 → insufficient OAuth scope (reconnect)
 *  - { apiDisabled: true, activationUrl } → YouTube Data API not enabled in the
 *                                           user's Google Cloud project
 */
async function ytFetch<T>(
  url: string,
  token: string,
): Promise<
  | { data: T }
  | { scopeError: true }
  | { apiDisabled: true; activationUrl: string }
> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 403) {
      // The API is enabled but the token lacks the youtube.readonly scope.
      if (/insufficient|scope/i.test(errText)) {
        logger.warn("youtube", "[ytFetch] insufficient scope — reauth needed");
        return { scopeError: true };
      }
      // The YouTube Data API itself is not enabled in the user's Cloud project.
      if (/SERVICE_DISABLED|accessNotConfigured|has not been used in project|is disabled/i.test(errText)) {
        const activationUrl = extractActivationUrl(errText);
        logger.warn("youtube", `[ytFetch] YouTube Data API disabled — enable at ${activationUrl}`);
        return { apiDisabled: true, activationUrl };
      }
    }
    throw new Error(
      `YouTube API error: ${response.status} ${response.statusText} — ${errText}`,
    );
  }
  return { data: (await response.json()) as T };
}

/** Pull the project-specific activation URL out of Google's error JSON, if present. */
function extractActivationUrl(errText: string): string {
  const match = errText.match(/"activationUrl":\s*"([^"]+)"/);
  return match?.[1] ?? YOUTUBE_API_CONSOLE_URL;
}

function readNumberParam(params: unknown, key: string, fallback: number): number {
  if (
    typeof params === "object" &&
    params !== null &&
    key in params &&
    typeof (params as Record<string, unknown>)[key] === "number"
  ) {
    return (params as Record<string, number>)[key];
  }
  return fallback;
}

export function registerYouTubeHandlers(): void {
  // ── Search ───────────────────────────────────────────────────────────────
  ipcMain.handle("youtube:search", async (_event, params: unknown): Promise<YtResult> => {
    const query =
      typeof params === "object" && params !== null && "query" in params
        ? String((params as { query: unknown }).query ?? "").trim()
        : "";
    const maxResults = readNumberParam(params, "maxResults", 15);
    logger.info("youtube", `[youtube:search] q="${query}" max=${maxResults}`);

    if (!query) return { videos: [] };

    const auth = await getYouTubeToken();
    if ("result" in auth) return auth.result;

    const url =
      `${API_BASE}/search?part=snippet&type=video&safeSearch=none` +
      `&maxResults=${maxResults}&q=${encodeURIComponent(query)}`;
    const res = await ytFetch<SearchListResponse>(url, auth.token);
    if ("scopeError" in res) return { videos: [], needsReauth: true };
    if ("apiDisabled" in res)
      return { videos: [], needsApiEnable: true, apiEnableUrl: res.activationUrl };

    const videos: YtVideo[] = (res.data.items ?? [])
      .map((item) => ({
        videoId: item.id?.videoId ?? "",
        title: item.snippet?.title ?? "(untitled)",
        channelTitle: item.snippet?.channelTitle ?? "",
        thumbnail: thumbOf(item.snippet),
        publishedAt: item.snippet?.publishedAt ?? "",
      }))
      .filter((v) => v.videoId);

    logger.info("youtube", `[youtube:search] ok count=${videos.length}`);
    return { videos };
  });

  // ── Subscriptions feed ─────────────────────────────────────────────────────
  ipcMain.handle(
    "youtube:getSubscriptionsFeed",
    async (_event, params: unknown): Promise<YtResult> => {
      const maxResults = readNumberParam(params, "maxResults", 30);
      logger.info("youtube", `[youtube:getSubscriptionsFeed] max=${maxResults}`);

      const auth = await getYouTubeToken();
      if ("result" in auth) return auth.result;
      const token = auth.token;

      // 1. List subscriptions (one request, up to 50 channels).
      const subsRes = await ytFetch<SubscriptionsListResponse>(
        `${API_BASE}/subscriptions?part=snippet&mine=true&maxResults=50&order=unread`,
        token,
      );
      if ("scopeError" in subsRes) return { videos: [], needsReauth: true };
      if ("apiDisabled" in subsRes)
        return { videos: [], needsApiEnable: true, apiEnableUrl: subsRes.activationUrl };

      const channelIds = (subsRes.data.items ?? [])
        .map((s) => s.snippet?.resourceId?.channelId)
        .filter((id): id is string => !!id);

      if (channelIds.length === 0) return { videos: [] };

      // 2. Batch-resolve each channel's uploads playlist (one request, up to 50 ids).
      const channelsRes = await ytFetch<ChannelsListResponse>(
        `${API_BASE}/channels?part=contentDetails&maxResults=50&id=${channelIds.join(",")}`,
        token,
      );
      if ("scopeError" in channelsRes) return { videos: [], needsReauth: true };
      if ("apiDisabled" in channelsRes)
        return { videos: [], needsApiEnable: true, apiEnableUrl: channelsRes.activationUrl };

      const uploadPlaylists = (channelsRes.data.items ?? [])
        .map((c) => c.contentDetails?.relatedPlaylists?.uploads)
        .filter((p): p is string => !!p)
        // Cap how many channels we poll to keep request count + quota reasonable.
        .slice(0, 25);

      // 3. Fetch the 2 latest uploads from each channel in parallel.
      const perChannel = await Promise.all(
        uploadPlaylists.map(async (playlistId) => {
          const res = await ytFetch<PlaylistItemsResponse>(
            `${API_BASE}/playlistItems?part=snippet&maxResults=2&playlistId=${playlistId}`,
            token,
          );
          if ("scopeError" in res || "apiDisabled" in res) return [] as YtVideo[];
          return (res.data.items ?? [])
            .map((item) => ({
              videoId: item.snippet?.resourceId?.videoId ?? "",
              title: item.snippet?.title ?? "(untitled)",
              channelTitle: item.snippet?.channelTitle ?? "",
              thumbnail: thumbOf(item.snippet),
              publishedAt: item.snippet?.publishedAt ?? "",
            }))
            .filter((v) => v.videoId && v.title !== "Private video");
        }),
      );

      // 4. Merge, sort newest-first, cap.
      const videos = perChannel
        .flat()
        .sort((a, b) => (b.publishedAt > a.publishedAt ? 1 : -1))
        .slice(0, maxResults);

      logger.info("youtube", `[youtube:getSubscriptionsFeed] ok count=${videos.length}`);
      return { videos };
    },
  );

  // ── Suggested (Most Popular / Trending) ────────────────────────────────────
  ipcMain.handle("youtube:getSuggestedVideos", async (_event, params: unknown): Promise<YtResult> => {
    const maxResults = readNumberParam(params, "maxResults", 25);
    logger.info("youtube", `[youtube:getSuggestedVideos] max=${maxResults}`);

    const auth = await getYouTubeToken();
    if ("result" in auth) return auth.result;

    const url = `${API_BASE}/videos?part=snippet&chart=mostPopular&maxResults=${maxResults}`;
    const res = await ytFetch<VideosListResponse>(url, auth.token);
    if ("scopeError" in res) return { videos: [], needsReauth: true };
    if ("apiDisabled" in res) return { videos: [], needsApiEnable: true, apiEnableUrl: res.activationUrl };

    const videos: YtVideo[] = (res.data.items ?? [])
      .map((item) => ({
        videoId: item.id ?? "",
        title: item.snippet?.title ?? "(untitled)",
        channelTitle: item.snippet?.channelTitle ?? "",
        thumbnail: thumbOf(item.snippet),
        publishedAt: item.snippet?.publishedAt ?? "",
      }))
      .filter((v) => v.videoId);

    logger.info("youtube", `[youtube:getSuggestedVideos] ok count=${videos.length}`);
    return { videos };
  });

  // ── Pop-out player ──────────────────────────────────────────────────────────
  const popoutWindows = new Map<string, BrowserWindow>();

  ipcMain.handle("youtube:popoutVideo", async (_event, params: unknown) => {
    const videoId =
      typeof params === "object" && params !== null && "videoId" in params
        ? String((params as { videoId: unknown }).videoId ?? "").trim()
        : "";
    const title =
      typeof params === "object" && params !== null && "title" in params
        ? String((params as { title?: unknown }).title ?? "")
        : "YouTube";

    if (!videoId) throw new Error("youtube:popoutVideo requires { videoId: string }");
    logger.info("youtube", `[youtube:popoutVideo] videoId=${videoId}`);

    const existing = popoutWindows.get(videoId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return { ok: true };
    }

    const win = new BrowserWindow({
      windowKey: `youtube-popout-${videoId}`,
      width: 1280,
      height: 720,
      minWidth: 640,
      minHeight: 360,
      title: title || "YouTube",
      frame: true,
      titleBarStyle: "default",
      show: false,
    });

    win.once("ready-to-show", () => win.show());

    // YouTube's watch page registers a `beforeunload` handler, which the runtime
    // honors — that silently cancels the native close button. Force-destroy on
    // the first close request so the red traffic light always closes the window.
    let forceClosing = false;
    win.on("close", (event) => {
      if (forceClosing) return;
      event.preventDefault();
      forceClosing = true;
      win.destroy();
    });
    win.on("closed", () => popoutWindows.delete(videoId));
    popoutWindows.set(videoId, win);

    // Load the full watch page — it plays every video (including news/TV clips
    // that disable embedding), with native player controls and fullscreen.
    await win.loadURL(`https://www.youtube.com/watch?v=${videoId}`);
    logger.info("youtube", `[youtube:popoutVideo] opened window for videoId=${videoId}`);
    return { ok: true };
  });

  // ── Open the Google Cloud Console to enable the YouTube Data API ────────────
  // Opens in the user's default browser so they land in the Google session
  // where they're already signed in (the in-app window has a separate session).
  ipcMain.handle("youtube:openApiConsole", async (_event, params: unknown) => {
    const url =
      typeof params === "object" && params !== null && "url" in params
        ? String((params as { url: unknown }).url ?? "")
        : "";
    const target =
      url.startsWith("https://console.") || url.startsWith("https://console.developers.")
        ? url
        : YOUTUBE_API_CONSOLE_URL;
    logger.info("youtube", `[youtube:openApiConsole] ${target}`);
    await shell.openExternal(target);
  });

  logger.info("youtube", "YouTube handlers registered");
}
