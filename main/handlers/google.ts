/**
 * Google Handlers
 *
 * Implements the google:* IPC contract.
 * Uses OAuthService with clientId/clientSecret from config-service.
 * Supports Gmail (unread messages) and Calendar (upcoming events).
 */

import { ipcMain, logger } from "@glaze/core/backend";
import { configService } from "../services/config-service.js";
import { getGoogleOAuth } from "../services/google-oauth.js";

// Gmail API types
interface GmailMessageListResponse {
  messages?: { id: string; threadId: string }[];
}

interface GmailMessageHeaderValue {
  name: string;
  value: string;
}

interface GmailMessageResponse {
  id: string;
  payload?: {
    headers?: GmailMessageHeaderValue[];
  };
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
}

// Calendar API types
interface CalendarEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface CalendarEventsResponse {
  items?: {
    id: string;
    summary?: string;
    start?: CalendarEventDateTime;
    end?: CalendarEventDateTime;
    location?: string;
    htmlLink?: string;
  }[];
}

function getHeader(headers: GmailMessageHeaderValue[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function registerGoogleHandlers(): void {
  ipcMain.handle("google:getStatus", async () => {
    logger.info("google", "[google:getStatus] checking status");
    const configured = await configService.hasGoogleCredentials();
    if (!configured) {
      logger.info("google", "[google:getStatus] not configured");
      return { connected: false, configured: false };
    }

    try {
      const googleOAuth = await getGoogleOAuth();
      const tokens = await googleOAuth.getTokens();
      if (!tokens) {
        return { connected: false, configured: true };
      }
      // Fetch user email via userinfo
      const accessToken = await googleOAuth.getAccessToken();
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        logger.warn("google", `[google:getStatus] userinfo fetch failed: ${response.status}`);
        return { connected: false, configured: true };
      }
      const info = (await response.json()) as { email?: string };
      logger.info("google", `[google:getStatus] connected email=${info.email ?? "unknown"}`);
      return { connected: true, email: info.email, configured: true };
    } catch (err) {
      logger.error("google", "[google:getStatus] error", err);
      return { connected: false, configured };
    }
  });

  ipcMain.handle("google:connect", async () => {
    logger.info("google", "[google:connect] starting OAuth flow");
    const googleOAuth = await getGoogleOAuth();
    await googleOAuth.authorize();
    const accessToken = await googleOAuth.getAccessToken();
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Google userinfo fetch failed after connect: ${response.status} — ${errText}`,
      );
    }
    const info = (await response.json()) as { email?: string };
    logger.info("google", `[google:connect] connected email=${info.email ?? "unknown"}`);
    return { connected: true, email: info.email ?? "" };
  });

  ipcMain.handle("google:disconnect", async () => {
    logger.info("google", "[google:disconnect] removing tokens");
    try {
      const googleOAuth = await getGoogleOAuth();
      await googleOAuth.removeTokens();
    } catch {
      // If OAuth not configured, tokens weren't stored anyway
    }
    return { connected: false };
  });

  ipcMain.handle("google:getGmail", async (_event, params: unknown) => {
    const maxResults =
      typeof params === "object" &&
      params !== null &&
      "maxResults" in params &&
      typeof (params as { maxResults: unknown }).maxResults === "number"
        ? (params as { maxResults: number }).maxResults
        : 20;

    logger.info("google", `[google:getGmail] maxResults=${maxResults}`);

    const googleOAuth = await getGoogleOAuth();
    const accessToken = await googleOAuth.getAccessToken();

    // Fetch unread messages list
    const listUrl =
      `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?q=is:unread&maxResults=${maxResults}`;

    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
      const errText = await listResponse.text().catch(() => "");
      throw new Error(
        `Gmail list error: ${listResponse.status} ${listResponse.statusText} — ${errText}`,
      );
    }

    const listData = (await listResponse.json()) as GmailMessageListResponse;
    const messageRefs = listData.messages ?? [];

    logger.info("google", `[google:getGmail] fetching ${messageRefs.length} message metadata`);

    // Fetch metadata for each message (parallel, capped at 20)
    const messages = await Promise.all(
      messageRefs.slice(0, 20).map(async ({ id }) => {
        const msgUrl =
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
          `?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
        const msgResponse = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!msgResponse.ok) {
          logger.warn("google", `[google:getGmail] message ${id} fetch failed: ${msgResponse.status}`);
          return null;
        }
        const msg = (await msgResponse.json()) as GmailMessageResponse;
        const headers = msg.payload?.headers ?? [];
        return {
          id: msg.id,
          from: getHeader(headers, "From"),
          subject: getHeader(headers, "Subject"),
          snippet: msg.snippet ?? "",
          date: getHeader(headers, "Date"),
          unread: msg.labelIds?.includes("UNREAD") ?? true,
        };
      }),
    );

    const validMessages = messages.filter(
      (m): m is NonNullable<typeof m> => m !== null,
    );

    logger.info("google", `[google:getGmail] ok count=${validMessages.length}`);
    return { messages: validMessages };
  });

  ipcMain.handle("google:getCalendar", async (_event, params: unknown) => {
    const maxResults =
      typeof params === "object" &&
      params !== null &&
      "maxResults" in params &&
      typeof (params as { maxResults: unknown }).maxResults === "number"
        ? (params as { maxResults: number }).maxResults
        : 10;

    logger.info("google", `[google:getCalendar] maxResults=${maxResults}`);

    const googleOAuth = await getGoogleOAuth();
    const accessToken = await googleOAuth.getAccessToken();

    const timeMin = new Date().toISOString();
    const calUrl =
      `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
      `?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}` +
      `&singleEvents=true&orderBy=startTime`;

    const response = await fetch(calUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Calendar API error: ${response.status} ${response.statusText} — ${errText}`,
      );
    }

    const data = (await response.json()) as CalendarEventsResponse;
    const items = data.items ?? [];

    const events = items.map((item) => {
      const allDay = !item.start?.dateTime;
      return {
        id: item.id,
        summary: item.summary ?? "(no title)",
        start: item.start?.dateTime ?? item.start?.date ?? "",
        end: item.end?.dateTime ?? item.end?.date ?? "",
        location: item.location,
        allDay,
        htmlLink: item.htmlLink ?? "",
      };
    });

    logger.info("google", `[google:getCalendar] ok count=${events.length}`);
    return { events };
  });

  logger.info("google", "Google handlers registered");
}
