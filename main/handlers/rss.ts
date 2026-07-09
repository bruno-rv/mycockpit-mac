/**
 * RSS Handlers
 *
 * Implements the rss:fetch IPC contract using rss-parser.
 * Caps at 20 items per feed.
 */

import { ipcMain, logger } from "@glaze/core/backend";
import RssParser from "rss-parser";

const parser = new RssParser({
  timeout: 10000,
  headers: {
    "User-Agent": "MyCockpit/1.0 RSS Reader",
  },
});

export function registerRssHandlers(): void {
  ipcMain.handle("rss:fetch", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("url" in params) ||
      typeof (params as { url: unknown }).url !== "string"
    ) {
      throw new Error("rss:fetch requires { url: string }");
    }

    const { url } = params as { url: string };
    logger.info("rss", `[rss:fetch] fetching url=${url}`);

    try {
      const feed = await parser.parseURL(url);

      const items = (feed.items ?? []).slice(0, 20).map((item) => ({
        title: item.title ?? "(no title)",
        link: item.link ?? "",
        pubDate: item.pubDate,
        isoDate: item.isoDate,
        contentSnippet: item.contentSnippet,
      }));

      logger.info("rss", `[rss:fetch] ok url=${url} itemCount=${items.length}`);
      return {
        title: feed.title ?? url,
        items,
      };
    } catch (err) {
      logger.error("rss", `[rss:fetch] error url=${url}`, err);
      throw new Error(
        `Failed to fetch RSS feed "${url}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  logger.info("rss", "RSS handlers registered");
}
