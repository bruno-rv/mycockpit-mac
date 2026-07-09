/**
 * AI Handlers
 *
 * Implements the ai:* IPC contract.
 * Streaming: broadcasts ai:chat:chunk / ai:chat:done / ai:chat:error.
 * Non-streaming: ai:summarizeNews.
 */

import { ipcMain, logger } from "@glaze/core/backend";
import {
  streamChat,
  summarizeNews,
  registerInFlight,
  cancelInFlight,
  cleanupInFlight,
  type ChatMessage,
} from "../services/ai-service.js";

export function registerAiHandlers(): void {
  ipcMain.handle("ai:chat:start", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("requestId" in params) ||
      !("messages" in params) ||
      typeof (params as { requestId: unknown }).requestId !== "string" ||
      !Array.isArray((params as { messages: unknown }).messages)
    ) {
      throw new Error(
        "ai:chat:start requires { requestId: string, messages: {role, content}[] }",
      );
    }

    const { requestId, messages } = params as {
      requestId: string;
      messages: unknown[];
    };

    // Validate messages array
    const validatedMessages: ChatMessage[] = messages.map((m, i) => {
      if (
        typeof m !== "object" ||
        m === null ||
        typeof (m as { role: unknown }).role !== "string" ||
        typeof (m as { content: unknown }).content !== "string"
      ) {
        throw new Error(`messages[${i}] must have role and content strings`);
      }
      const role = (m as { role: string }).role;
      if (role !== "user" && role !== "assistant" && role !== "system") {
        throw new Error(`messages[${i}].role must be "user", "assistant", or "system"`);
      }
      return {
        role: role as "user" | "assistant" | "system",
        content: (m as { content: string }).content,
      };
    });

    logger.info("ai", `[ai:chat:start] requestId=${requestId} messageCount=${validatedMessages.length}`);

    const controller = new AbortController();
    registerInFlight(requestId, controller);

    // Fire-and-forget; the caller gets {ok:true} immediately and receives chunks via broadcast
    streamChat(validatedMessages, controller.signal, (delta) => {
      ipcMain.broadcast("ai:chat:chunk", { requestId, delta });
    })
      .then(() => {
        cleanupInFlight(requestId);
        ipcMain.broadcast("ai:chat:done", { requestId });
        logger.info("ai", `[ai:chat:done] requestId=${requestId}`);
      })
      .catch((err) => {
        cleanupInFlight(requestId);
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof Error && err.name === "AbortError") {
          // Cancelled — don't broadcast error
          logger.info("ai", `[ai:chat] requestId=${requestId} cancelled`);
          return;
        }
        logger.error("ai", `[ai:chat:error] requestId=${requestId}`, err);
        ipcMain.broadcast("ai:chat:error", { requestId, message });
      });

    return { ok: true };
  });

  ipcMain.handle("ai:chat:cancel", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("requestId" in params) ||
      typeof (params as { requestId: unknown }).requestId !== "string"
    ) {
      throw new Error("ai:chat:cancel requires { requestId: string }");
    }
    const { requestId } = params as { requestId: string };
    logger.info("ai", `[ai:chat:cancel] requestId=${requestId}`);
    const cancelled = cancelInFlight(requestId);
    return { ok: cancelled };
  });

  ipcMain.handle("ai:summarizeNews", async (_event, params: unknown) => {
    if (
      typeof params !== "object" ||
      params === null ||
      !("items" in params) ||
      !Array.isArray((params as { items: unknown }).items)
    ) {
      throw new Error("ai:summarizeNews requires { items: {title, source?}[] }");
    }

    const { items } = params as { items: unknown[] };
    const validated = items.map((item, i) => {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as { title: unknown }).title !== "string"
      ) {
        throw new Error(`items[${i}] must have a title string`);
      }
      return {
        title: (item as { title: string }).title,
        source: typeof (item as { source: unknown }).source === "string"
          ? (item as { source: string }).source
          : undefined,
      };
    });

    logger.info("ai", `[ai:summarizeNews] itemCount=${validated.length}`);

    try {
      const summary = await summarizeNews(validated);
      logger.info("ai", "[ai:summarizeNews] ok");
      return { summary };
    } catch (err) {
      logger.error("ai", "[ai:summarizeNews] error", err);
      throw err;
    }
  });

  logger.info("ai", "AI handlers registered");
}
