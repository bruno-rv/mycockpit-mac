/**
 * AI Service
 *
 * Handles streaming and non-streaming calls to Anthropic and OpenAI.
 * Reads provider and API key from config-service at call time.
 */

import { logger } from "@glaze/core/backend";
import { configService } from "./config-service.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AbortEntry {
  controller: AbortController;
}

// In-flight request registry keyed by requestId
const inFlightRequests = new Map<string, AbortEntry>();

export function registerInFlight(requestId: string, controller: AbortController): void {
  inFlightRequests.set(requestId, { controller });
}

export function cancelInFlight(requestId: string): boolean {
  const entry = inFlightRequests.get(requestId);
  if (entry) {
    entry.controller.abort();
    inFlightRequests.delete(requestId);
    logger.info("ai-service", `[ai:chat:cancel] requestId=${requestId}`);
    return true;
  }
  return false;
}

export function cleanupInFlight(requestId: string): void {
  inFlightRequests.delete(requestId);
}

/**
 * Stream an Anthropic chat response.
 * Calls onChunk for each text delta, calls onDone when complete.
 */
async function streamAnthropic(
  messages: ChatMessage[],
  apiKey: string,
  signal: AbortSignal,
  onChunk: (delta: string) => void,
): Promise<void> {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    stream: true,
    messages: messages.filter((m) => m.role !== "system").map((m) => ({
      role: m.role,
      content: m.content,
    })),
    ...(messages.find((m) => m.role === "system")
      ? { system: messages.find((m) => m.role === "system")!.content }
      : {}),
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText} — ${errText}`);
  }

  if (!response.body) {
    throw new Error("Anthropic API returned empty body for streaming request");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          type: string;
          delta?: { type: string; text?: string };
        };
        if (
          parsed.type === "content_block_delta" &&
          parsed.delta?.type === "text_delta" &&
          parsed.delta.text
        ) {
          onChunk(parsed.delta.text);
        }
      } catch {
        // Ignore parse errors for partial chunks
      }
    }
  }
}

/**
 * Stream an OpenAI chat response.
 */
async function streamOpenAI(
  messages: ChatMessage[],
  apiKey: string,
  signal: AbortSignal,
  onChunk: (delta: string) => void,
): Promise<void> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} — ${errText}`);
  }

  if (!response.body) {
    throw new Error("OpenAI API returned empty body for streaming request");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          onChunk(delta);
        }
      } catch {
        // Ignore parse errors for partial chunks
      }
    }
  }
}

/**
 * Start streaming a chat completion. Returns a promise that resolves after stream completes.
 * The caller registers in-flight state and broadcasts chunks via ipcMain.
 */
export async function streamChat(
  messages: ChatMessage[],
  signal: AbortSignal,
  onChunk: (delta: string) => void,
): Promise<void> {
  const config = await configService.loadConfig();
  const provider = config.aiProvider;
  const apiKey = await configService.getApiKey(provider);

  if (!apiKey) {
    throw new Error(
      `No API key configured for provider "${provider}". Add your key in Settings.`,
    );
  }

  logger.info("ai-service", `[ai:chat:start] provider=${provider}`);

  if (provider === "anthropic") {
    await streamAnthropic(messages, apiKey, signal, onChunk);
  } else {
    await streamOpenAI(messages, apiKey, signal, onChunk);
  }
}

/**
 * Non-streaming summarize: returns 3-5 bullet digest.
 */
export async function summarizeNews(
  items: { title: string; source?: string }[],
): Promise<string> {
  const config = await configService.loadConfig();
  const provider = config.aiProvider;
  const apiKey = await configService.getApiKey(provider);

  if (!apiKey) {
    throw new Error(
      `No API key configured for provider "${provider}". Add your key in Settings.`,
    );
  }

  const prompt =
    "Summarize the following news headlines into 3-5 concise bullet points. " +
    "Focus on the most important and interesting stories.\n\n" +
    items.map((item, i) => `${i + 1}. ${item.title}${item.source ? ` (${item.source})` : ""}`).join("\n");

  logger.info("ai-service", `[ai:summarizeNews] provider=${provider} itemCount=${items.length}`);

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText} — ${errText}`,
      );
    }
    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };
    return data.content.find((c) => c.type === "text")?.text ?? "";
  } else {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} — ${errText}`,
      );
    }
    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message.content ?? "";
  }
}
