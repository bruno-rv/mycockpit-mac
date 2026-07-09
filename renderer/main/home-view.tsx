import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Toolbar,
  ToolbarContent,
  ToolbarTitle,
  ToolbarActions,
  ScrollArea,
  Button,
  Text,
  EmptyState,
  Separator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  Input,
  Dialog,
} from "@glaze/core/components";
import {
  RefreshCwIcon,
  SettingsIcon,
  GithubIcon,
  MailIcon,
  CalendarIcon,
  StarIcon,
  CircleIcon,
  SendIcon,
  SquareIcon,
  YoutubeIcon,
  RssIcon,
  GlobeIcon,
  SparklesIcon,
  Loader2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
  PlusIcon,
  SearchIcon,
  PlayIcon,
  RotateCcwIcon,
  AtSignIcon,
  LinkedinIcon,
} from "lucide-react";
import GridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppConfig {
  aiProvider: string;
  rssFeeds: { title: string; url: string }[];
  websites: { title: string; url: string }[];
  youtube: { videoId?: string; title?: string };
  hasAnthropicKey: boolean;
  hasOpenAIKey: boolean;
  hasGoogleCreds: boolean;
}

interface GithubRepo {
  fullName: string;
  owner: string;
  name: string;
  description: string;
  stars: number;
  language: string;
  url: string;
  todayStars?: number;
}

interface GithubStatus {
  connected: boolean;
  login?: string;
  avatarUrl?: string;
}

interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
}

interface RssFeed {
  title: string;
  items: RssItem[];
}

interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  allDay: boolean;
  htmlLink: string;
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  configured: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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
  needsApiEnable?: boolean;
  apiEnableUrl?: string;
}

// ─── IPC helpers ─────────────────────────────────────────────────────────────

function ipc<T>(channel: string, params?: unknown): Promise<T> {
  return window.glazeAPI.glaze.ipc.invoke<T>(channel, params);
}

function openWebsite(url: string, title?: string) {
  console.log("[HomeView:openWebsite]", { url, title });
  void ipc("window:openWebsite", { url, title });
}

// ─── Connection chip ─────────────────────────────────────────────────────────

function ConnectionChip({
  icon,
  label,
  connected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  connected: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-pill border border-separator transition-opacity ${onClick ? "cursor-pointer hover:opacity-70 active:opacity-50" : "cursor-default"}`}
    >
      <span className={connected ? "text-support-green" : "text-tertiary"}>{icon}</span>
      <Text variant="small" color={connected ? "primary" : "tertiary"}>
        {label}
      </Text>
      {connected ? (
        <CheckCircle2Icon className="size-3.5 text-support-green shrink-0" />
      ) : (
        <CircleIcon className="size-3.5 text-tertiary shrink-0" />
      )}
    </button>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-control animate-pulse rounded-card ${className ?? ""}`} />;
}

// ─── GitHub widget ────────────────────────────────────────────────────────────

function GitHubWidget(_props: { config: AppConfig }) {
  const [since, setSince] = useState<"daily" | "weekly" | "monthly">("daily");
  const [language, setLanguage] = useState<string>("");

  const githubStatusQuery = useQuery<GithubStatus>({
    queryKey: ["github:status"],
    queryFn: () => ipc("github:getStatus"),
    staleTime: 60_000,
  });

  const githubTrendingQuery = useQuery<{ repos: GithubRepo[] }>({
    queryKey: ["github:trending", since, language],
    queryFn: () => ipc("github:getTrending", { since, language: language || undefined }),
    enabled: !!githubStatusQuery.data?.connected,
    staleTime: 5 * 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: () => ipc("github:connect"),
    onSuccess: () => {
      console.log("[GitHubWidget:connect] Connected");
      void githubStatusQuery.refetch();
    },
  });

  const status = githubStatusQuery.data;

  return (
    <WidgetCard title="GitHub Trending" icon={<GithubIcon className="size-4 text-secondary" />}>
      {githubStatusQuery.isLoading ? (
        <div className="flex flex-col gap-2 p-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !status?.connected ? (
        <EmptyState
          placement="inline"
          title="Connect GitHub"
          description="Sign in to see trending repositories"
          actions={
            <Button variant="filled" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <GithubIcon className="size-4" />}
              Connect GitHub
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 py-2">
            {status.avatarUrl && (
              <Avatar size="small">
                <AvatarImage src={status.avatarUrl} alt={status.login ?? "GitHub"} />
                <AvatarFallback>{status.login?.[0]?.toUpperCase() ?? "G"}</AvatarFallback>
              </Avatar>
            )}
            <Text variant="small" color="secondary" truncate>
              {status.login}
            </Text>
            <div className="ml-auto flex items-center gap-2">
              <Select value={since} onValueChange={(v) => setSince(v as "daily" | "weekly" | "monthly")}>
                <SelectTrigger size="small" variant="filled">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This week</SelectItem>
                  <SelectItem value="monthly">This month</SelectItem>
                </SelectContent>
              </Select>
              <Input
                size="small"
                variant="filled"
                placeholder="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-24"
              />
            </div>
          </div>
          <Separator />
          {githubTrendingQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : githubTrendingQuery.isError ? (
            <EmptyState placement="inline" title="Failed to load" description="Could not fetch trending repos" />
          ) : githubTrendingQuery.data?.repos.length === 0 ? (
            <EmptyState placement="inline" title="No results" description="Try a different filter" />
          ) : (
            <div className="flex flex-col divide-y divide-separator">
              {githubTrendingQuery.data?.repos.map((repo) => (
                <button
                  key={repo.fullName}
                  className="flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-control-subtle transition-colors"
                  onClick={() => openWebsite(repo.url, repo.fullName)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Text variant="small" color="primary" truncate className="font-medium shrink-0">
                      {repo.fullName}
                    </Text>
                    {repo.language && (
                      <Badge color="secondary" size="small">
                        {repo.language}
                      </Badge>
                    )}
                    <div className="flex items-center gap-0.5 ml-auto shrink-0">
                      <StarIcon className="size-3.5 text-support-yellow" />
                      <Text variant="small" color="secondary" className="tabular-nums">
                        {repo.stars.toLocaleString()}
                      </Text>
                      {repo.todayStars !== undefined && (
                        <Text variant="small" color="tertiary" className="tabular-nums">
                          +{repo.todayStars}
                        </Text>
                      )}
                    </div>
                  </div>
                  {repo.description && (
                    <Text variant="small" color="tertiary" truncate>
                      {repo.description}
                    </Text>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}

// ─── RSS widget ───────────────────────────────────────────────────────────────

function RssWidget({ config }: { config: AppConfig }) {
  const [selectedFeedUrl, setSelectedFeedUrl] = useState<string>(config.rssFeeds[0]?.url ?? "");
  const [aiSummary, setAiSummary] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);

  const feedQuery = useQuery<RssFeed>({
    queryKey: ["rss:fetch", selectedFeedUrl],
    queryFn: () => ipc("rss:fetch", { url: selectedFeedUrl }),
    enabled: !!selectedFeedUrl,
    staleTime: 5 * 60_000,
  });

  async function handleSummarize() {
    const items = feedQuery.data?.items.slice(0, 10) ?? [];
    if (!items.length) return;
    setSummarizing(true);
    setAiSummary("");
    try {
      console.log("[RssWidget:summarize]", { count: items.length });
      const result = await ipc<{ summary: string }>("ai:summarizeNews", {
        items: items.map((item) => ({ title: item.title, source: feedQuery.data?.title })),
      });
      setAiSummary(result.summary);
    } catch {
      setAiSummary("Failed to summarize. Please check your API key in Settings.");
    } finally {
      setSummarizing(false);
    }
  }

  if (!config.rssFeeds.length) {
    return (
      <WidgetCard title="RSS News" icon={<RssIcon className="size-4 text-secondary" />}>
        <EmptyState placement="inline" title="No feeds" description="Add RSS feeds in Settings" />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="RSS News" icon={<RssIcon className="size-4 text-secondary" />}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Select value={selectedFeedUrl} onValueChange={setSelectedFeedUrl}>
          <SelectTrigger size="small" variant="filled" className="flex-1 min-w-0">
            <SelectValue placeholder="Select a feed" />
          </SelectTrigger>
          <SelectContent>
            {config.rssFeeds.map((feed) => (
              <SelectItem key={feed.url} value={feed.url}>
                {feed.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="small"
          variant="filled"
          onClick={handleSummarize}
          disabled={summarizing || !feedQuery.data?.items.length}
        >
          {summarizing ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
          Summarize
        </Button>
      </div>
      <Separator />
      {aiSummary && (
        <>
          <div className="px-3 py-2 bg-well rounded-card mx-2 my-2">
            <div className="flex items-center gap-1.5 mb-1">
              <SparklesIcon className="size-3.5 text-accent shrink-0" />
              <Text variant="small-strong" color="accent">
                AI Summary
              </Text>
            </div>
            <Text variant="small" color="secondary" as="p">
              {aiSummary}
            </Text>
          </div>
          <Separator />
        </>
      )}
      {feedQuery.isLoading ? (
        <div className="flex flex-col gap-2 p-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : feedQuery.isError ? (
        <EmptyState placement="inline" title="Failed to load" description="Could not fetch RSS feed" />
      ) : feedQuery.data?.items.length === 0 ? (
        <EmptyState placement="inline" title="No items" description="This feed has no articles" />
      ) : (
        <div className="flex flex-col divide-y divide-separator">
          {feedQuery.data?.items.slice(0, 20).map((item, idx) => (
            <button
              key={item.link ?? idx}
              className="flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-control-subtle transition-colors"
              onClick={() => item.link && openWebsite(item.link, item.title)}
            >
              <Text variant="small" color="primary" truncate className="font-medium">
                {item.title}
              </Text>
              {item.contentSnippet && (
                <Text variant="small" color="tertiary" truncate>
                  {item.contentSnippet}
                </Text>
              )}
              {item.isoDate && (
                <Text variant="small" color="quaternary">
                  {new Date(item.isoDate).toLocaleString()}
                </Text>
              )}
            </button>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── AI Chatbot widget ────────────────────────────────────────────────────────

function AiChatWidget({ config }: { config: AppConfig }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubRefs = useRef<Array<() => void>>([]);

  const hasKey =
    (config.aiProvider === "anthropic" && config.hasAnthropicKey) ||
    (config.aiProvider === "openai" && config.hasOpenAIKey);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const cleanupSubs = useCallback(() => {
    unsubRefs.current.forEach((fn) => fn());
    unsubRefs.current = [];
  }, []);

  useEffect(() => {
    return () => cleanupSubs();
  }, [cleanupSubs]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages([...allMessages, { role: "assistant", content: "" }]);
    setStreaming(true);

    const requestId = `chat-${Date.now()}`;
    setCurrentRequestId(requestId);

    console.log("[AiChatWidget:send]", { requestId, messageCount: allMessages.length });

    cleanupSubs();

    const unsubChunk = window.glazeAPI.glaze.ipc.onNotification("ai:chat:chunk", (params) => {
      const p = params as { requestId: string; delta: string };
      if (p.requestId !== requestId) return;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, content: last.content + p.delta };
        }
        return next;
      });
    });

    const unsubDone = window.glazeAPI.glaze.ipc.onNotification("ai:chat:done", (params) => {
      const p = params as { requestId: string };
      if (p.requestId !== requestId) return;
      console.log("[AiChatWidget:done]", { requestId });
      setStreaming(false);
      setCurrentRequestId(null);
      cleanupSubs();
    });

    const unsubError = window.glazeAPI.glaze.ipc.onNotification("ai:chat:error", (params) => {
      const p = params as { requestId: string; message: string };
      if (p.requestId !== requestId) return;
      console.log("[AiChatWidget:error]", { requestId, message: p.message });
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, content: `Error: ${p.message}` };
        }
        return next;
      });
      setStreaming(false);
      setCurrentRequestId(null);
      cleanupSubs();
    });

    unsubRefs.current = [unsubChunk, unsubDone, unsubError];

    try {
      await ipc("ai:chat:start", {
        requestId,
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (err) {
      console.log("[AiChatWidget:start:error]", { err });
      setStreaming(false);
      setCurrentRequestId(null);
      cleanupSubs();
    }
  }

  async function handleStop() {
    if (!currentRequestId) return;
    console.log("[AiChatWidget:stop]", { requestId: currentRequestId });
    await ipc("ai:chat:cancel", { requestId: currentRequestId });
    setStreaming(false);
    setCurrentRequestId(null);
    cleanupSubs();
  }

  return (
    <WidgetCard title="AI Assistant" icon={<SparklesIcon className="size-4 text-secondary" />}>
      {!hasKey ? (
        <EmptyState
          placement="inline"
          title="No API key"
          description={`Add a ${config.aiProvider === "anthropic" ? "Anthropic" : "OpenAI"} API key in Settings to use the chatbot`}
        />
      ) : (
        <div className="flex flex-col h-full min-h-64">
          <ScrollArea
            className="flex-1"
            autoScrollToBottom
            autoScrollDeps={[messages]}
            showScrollToBottomButton
          >
            <div className="flex flex-col gap-3 px-3 py-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <SparklesIcon className="size-8 text-tertiary" />
                  <Text variant="small" color="tertiary" align="center">
                    Start a conversation
                  </Text>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-card px-3 py-2 ${
                        msg.role === "user" ? "bg-control" : "bg-well border border-separator"
                      }`}
                    >
                      <Text variant="small" color="primary" as="p">
                        {msg.content || (streaming && idx === messages.length - 1 ? "…" : "")}
                      </Text>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          <Separator />
          <div className="flex items-center gap-2 px-3 py-2">
            <Input
              variant="filled"
              size="medium"
              placeholder="Message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={streaming}
              className="flex-1"
            />
            {streaming ? (
              <Button variant="filled" size="medium" iconOnly onClick={handleStop}>
                <SquareIcon className="size-4" />
              </Button>
            ) : (
              <Button variant="accent" size="medium" iconOnly onClick={() => void handleSend()} disabled={!input.trim()}>
                <SendIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Gmail widget ─────────────────────────────────────────────────────────────

function GmailWidget() {
  const googleStatusQuery = useQuery<GoogleStatus>({
    queryKey: ["google:status"],
    queryFn: () => ipc("google:getStatus"),
    staleTime: 60_000,
  });

  const gmailQuery = useQuery<{ messages: GmailMessage[] }>({
    queryKey: ["google:gmail"],
    queryFn: () => ipc("google:getGmail", { maxResults: 20 }),
    enabled: !!googleStatusQuery.data?.connected,
    staleTime: 2 * 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: () => ipc("google:connect"),
    onSuccess: () => {
      console.log("[GmailWidget:connect] Connected");
      void googleStatusQuery.refetch();
    },
  });

  const status = googleStatusQuery.data;

  return (
    <WidgetCard title="Gmail" icon={<MailIcon className="size-4 text-secondary" />}>
      {googleStatusQuery.isLoading ? (
        <div className="flex flex-col gap-2 p-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !status?.configured ? (
        <EmptyState
          placement="inline"
          title="Google not configured"
          description="Add your Google credentials in Settings to use Gmail"
        />
      ) : !status.connected ? (
        <EmptyState
          placement="inline"
          title="Not connected"
          description="Sign in to access your Gmail"
          actions={
            <Button variant="filled" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <MailIcon className="size-4" />}
              Connect Google
            </Button>
          }
        />
      ) : (
        <>
          {status.email && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Text variant="small" color="secondary" truncate>
                  {status.email}
                </Text>
              </div>
              <Separator />
            </>
          )}
          {gmailQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : gmailQuery.isError ? (
            <EmptyState placement="inline" title="Failed to load" description="Could not fetch messages" />
          ) : gmailQuery.data?.messages.length === 0 ? (
            <EmptyState placement="inline" title="Inbox zero" description="No messages" />
          ) : (
            <div className="flex flex-col divide-y divide-separator">
              {gmailQuery.data?.messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-0.5 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {msg.unread && <span className="size-2 rounded-full bg-accent shrink-0" />}
                    <Text variant="small" color={msg.unread ? "primary" : "secondary"} truncate className="font-medium">
                      {msg.from}
                    </Text>
                    <Text variant="small" color="tertiary" className="ml-auto shrink-0 tabular-nums">
                      {new Date(msg.date).toLocaleDateString()}
                    </Text>
                  </div>
                  <Text variant="small" color={msg.unread ? "primary" : "secondary"} truncate>
                    {msg.subject}
                  </Text>
                  {msg.snippet && (
                    <Text variant="small" color="tertiary" truncate>
                      {msg.snippet}
                    </Text>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}

// ─── Calendar widget ──────────────────────────────────────────────────────────

function CalendarWidget() {
  const googleStatusQuery = useQuery<GoogleStatus>({
    queryKey: ["google:status"],
    queryFn: () => ipc("google:getStatus"),
    staleTime: 60_000,
  });

  const calendarQuery = useQuery<{ events: CalendarEvent[] }>({
    queryKey: ["google:calendar"],
    queryFn: () => ipc("google:getCalendar", { maxResults: 10 }),
    enabled: !!googleStatusQuery.data?.connected,
    staleTime: 5 * 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: () => ipc("google:connect"),
    onSuccess: () => {
      console.log("[CalendarWidget:connect] Connected");
      void googleStatusQuery.refetch();
    },
  });

  const status = googleStatusQuery.data;

  function formatEventTime(event: CalendarEvent) {
    if (event.allDay) return "All day";
    try {
      return new Date(event.start).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return event.start;
    }
  }

  return (
    <WidgetCard title="Calendar" icon={<CalendarIcon className="size-4 text-secondary" />}>
      {googleStatusQuery.isLoading ? (
        <div className="flex flex-col gap-2 p-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !status?.configured ? (
        <EmptyState
          placement="inline"
          title="Google not configured"
          description="Add your Google credentials in Settings to use Calendar"
        />
      ) : !status.connected ? (
        <EmptyState
          placement="inline"
          title="Not connected"
          description="Sign in to access your Calendar"
          actions={
            <Button variant="filled" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <CalendarIcon className="size-4" />}
              Connect Google
            </Button>
          }
        />
      ) : calendarQuery.isLoading ? (
        <div className="flex flex-col gap-2 p-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : calendarQuery.isError ? (
        <EmptyState placement="inline" title="Failed to load" description="Could not fetch events" />
      ) : calendarQuery.data?.events.length === 0 ? (
        <EmptyState placement="inline" title="No upcoming events" description="Your calendar is clear" />
      ) : (
        <div className="flex flex-col divide-y divide-separator">
          {calendarQuery.data?.events.map((event) => (
            <button
              key={event.id}
              className="flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-control-subtle transition-colors"
              onClick={() => openWebsite(event.htmlLink, event.summary)}
            >
              <Text variant="small" color="primary" truncate className="font-medium">
                {event.summary}
              </Text>
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 text-tertiary shrink-0" />
                <Text variant="small" color="tertiary">
                  {formatEventTime(event)}
                </Text>
              </div>
              {event.location && (
                <Text variant="small" color="tertiary" truncate>
                  {event.location}
                </Text>
              )}
            </button>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Websites widget ──────────────────────────────────────────────────────────

function WebsitesWidget({ config }: { config: AppConfig }) {
  if (!config.websites.length) {
    return (
      <WidgetCard title="Websites" icon={<GlobeIcon className="size-4 text-secondary" />}>
        <EmptyState placement="inline" title="No websites" description="Add quick-launch websites in Settings" />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Websites" icon={<GlobeIcon className="size-4 text-secondary" />}>
      <div className="grid grid-cols-3 gap-2 p-3">
        {config.websites.map((site) => {
          const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(site.url)}`;
          const initial = site.title[0]?.toUpperCase() ?? "?";
          return (
            <button
              key={site.url}
              className="flex flex-col items-center gap-1.5 p-2 rounded-card hover:bg-control-subtle transition-colors"
              onClick={() => openWebsite(site.url, site.title)}
            >
              <div className="size-8 rounded-control overflow-hidden flex items-center justify-center bg-control">
                <img
                  src={faviconUrl}
                  alt=""
                  className="size-8"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <Text variant="strong" color="secondary" className="absolute">
                  {initial}
                </Text>
              </div>
              <Text variant="small" color="secondary" truncate className="max-w-full">
                {site.title}
              </Text>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}

// ─── YouTube widget ────────────────────────────────────────────────────────────

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function VideoRow({ video, onPlay }: { video: YtVideo; onPlay: (v: YtVideo) => void }) {
  return (
    <button
      className="flex items-start gap-2.5 px-3 py-2 text-left hover:bg-control-subtle transition-colors w-full"
      onClick={() => onPlay(video)}
    >
      <div className="relative w-24 shrink-0 rounded-control overflow-hidden bg-control aspect-video">
        {video.thumbnail && <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity">
          <PlayIcon className="size-5 text-white" />
        </span>
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <Text variant="small" color="primary" className="font-medium line-clamp-2">
          {video.title}
        </Text>
        <Text variant="small" color="tertiary" truncate>
          {video.channelTitle}
          {video.publishedAt ? ` · ${new Date(video.publishedAt).toLocaleDateString()}` : ""}
        </Text>
      </div>
    </button>
  );
}

function YouTubeWidget({ config }: { config: AppConfig }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"subscriptions" | "suggested" | "search">("subscriptions");
  const [searchInput, setSearchInput] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [playing, setPlaying] = useState<{ id: string; title?: string } | null>(
    config.youtube?.videoId ? { id: config.youtube.videoId, title: config.youtube.title } : null,
  );

  const googleStatusQuery = useQuery<GoogleStatus>({
    queryKey: ["google:status"],
    queryFn: () => ipc("google:getStatus"),
    staleTime: 60_000,
  });
  const connected = !!googleStatusQuery.data?.connected;

  const subsQuery = useQuery<YtResult>({
    queryKey: ["youtube:subscriptions"],
    queryFn: () => ipc("youtube:getSubscriptionsFeed", { maxResults: 30 }),
    enabled: connected && tab === "subscriptions",
    staleTime: 5 * 60_000,
  });

  const suggestedQuery = useQuery<YtResult>({
    queryKey: ["youtube:suggested"],
    queryFn: () => ipc("youtube:getSuggestedVideos", { maxResults: 25 }),
    enabled: connected && tab === "suggested",
    staleTime: 10 * 60_000,
  });

  const searchResultQuery = useQuery<YtResult>({
    queryKey: ["youtube:search", submittedQuery],
    queryFn: () => ipc("youtube:search", { query: submittedQuery, maxResults: 15 }),
    enabled: connected && tab === "search" && !!submittedQuery,
    staleTime: 5 * 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: () => ipc("google:connect"),
    onSuccess: () => {
      console.log("[YouTubeWidget:connect] Connected");
      void googleStatusQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["youtube:subscriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["youtube:suggested"] });
      void queryClient.invalidateQueries({ queryKey: ["youtube:search"] });
    },
    onError: (err) => {
      console.log("[YouTubeWidget:connect:error]", { err });
    },
  });

  function playVideo(v: YtVideo) {
    console.log("[YouTubeWidget:play]", { videoId: v.videoId });
    setPlaying({ id: v.videoId, title: v.title });
    void ipc("config:setYouTube", { videoId: v.videoId, title: v.title });
    void ipc("youtube:popoutVideo", { videoId: v.videoId, title: v.title });
  }

  function handlePaste() {
    const id = extractVideoId(urlInput);
    if (!id) return;
    setPlaying({ id });
    void ipc("config:setYouTube", { videoId: id });
    void ipc("youtube:popoutVideo", { videoId: id });
    setUrlInput("");
  }

  const activeQuery =
    tab === "subscriptions" ? subsQuery : tab === "suggested" ? suggestedQuery : searchResultQuery;
  const result = activeQuery.data;

  function renderList() {
    const gStatus = googleStatusQuery.data;
    if (!gStatus?.configured) {
      return (
        <EmptyState
          placement="inline"
          title="Google not configured"
          description="Add your Google Cloud client ID and secret in Settings, then sign in to use YouTube"
          actions={
            <Button variant="filled" onClick={() => void ipc("window:openSettings")}>
              <SettingsIcon className="size-4" />
              Open Settings
            </Button>
          }
        />
      );
    }
    if (!connected) {
      return (
        <EmptyState
          placement="inline"
          title="Sign in to YouTube"
          description="Connect your Google account to search and browse your subscriptions"
          actions={
            <div className="flex flex-col items-center gap-1.5">
              <Button variant="filled" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                {connectMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <YoutubeIcon className="size-4" />}
                Sign in
              </Button>
              {connectMutation.isError && (
                <Text variant="small" color="red" align="center">
                  Sign in failed. Check your Google credentials in Settings.
                </Text>
              )}
            </div>
          }
        />
      );
    }
    if (tab === "search" && !submittedQuery) {
      return <EmptyState placement="inline" title="Search YouTube" description="Type above and press Enter" />;
    }
    if (activeQuery.isLoading || activeQuery.isFetching) {
      return (
        <div className="flex flex-col gap-2 p-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      );
    }
    if (activeQuery.isError) {
      return <EmptyState placement="inline" title="Failed to load" description="Could not reach YouTube" />;
    }
    if (result?.needsApiEnable) {
      return (
        <EmptyState
          placement="inline"
          title="Enable the YouTube Data API"
          description="Your Google Cloud project has the YouTube Data API v3 turned off. Enable it, wait a minute, then refresh."
          actions={
            <Button
              variant="filled"
              onClick={() => void ipc("youtube:openApiConsole", { url: result.apiEnableUrl })}
            >
              <YoutubeIcon className="size-4" />
              Open Google Cloud Console
            </Button>
          }
        />
      );
    }
    if (result?.needsReauth) {
      return (
        <EmptyState
          placement="inline"
          title="Reconnect required"
          description="Sign in again to grant YouTube access"
          actions={
            <Button variant="filled" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <RotateCcwIcon className="size-4" />}
              Reconnect
            </Button>
          }
        />
      );
    }
    if (!result?.videos.length) {
      return (
        <EmptyState
          placement="inline"
          title={tab === "subscriptions" ? "No recent uploads" : tab === "suggested" ? "No trending videos" : "No results"}
          description={
            tab === "subscriptions"
              ? "Channels you follow have no recent videos"
              : tab === "suggested"
                ? "No trending videos available right now"
                : "Try a different search"
          }
        />
      );
    }
    return (
      <div className="flex flex-col divide-y divide-separator">
        {result.videos.map((v) => (
          <VideoRow key={v.videoId} video={v} onPlay={playVideo} />
        ))}
      </div>
    );
  }

  return (
    <WidgetCard title="YouTube" icon={<YoutubeIcon className="size-4 text-secondary" />}>
      <div className="flex flex-col h-full min-h-0">
        {/* Player */}
        <div className="p-3 pb-2 shrink-0">
          {playing ? (
            <button
              type="button"
              title="Open player"
              onClick={() => void ipc("youtube:popoutVideo", { videoId: playing.id, title: playing.title })}
              className="relative group rounded-card overflow-hidden bg-black aspect-video w-full block"
            >
              <img
                src={`https://img.youtube.com/vi/${playing.id}/mqdefault.jpg`}
                alt={playing.title ?? ""}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/45">
                <div className="size-12 rounded-full bg-black/55 flex items-center justify-center">
                  <PlayIcon className="size-5 text-white ml-0.5" />
                </div>
              </div>
              {playing.title && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-left">
                  <p className="text-white text-xs truncate">{playing.title}</p>
                </div>
              )}
            </button>
          ) : (
            <div className="rounded-card bg-well aspect-video flex items-center justify-center">
              <div className="flex flex-col items-center gap-1.5">
                <YoutubeIcon className="size-7 text-tertiary" />
                <Text variant="small" color="tertiary">
                  Pick a video to play
                </Text>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 pb-2 shrink-0">
          <Button
            size="small"
            variant={tab === "subscriptions" ? "accent" : "filled"}
            onClick={() => setTab("subscriptions")}
          >
            Subscriptions
          </Button>
          <Button
            size="small"
            variant={tab === "suggested" ? "accent" : "filled"}
            onClick={() => setTab("suggested")}
          >
            Trending
          </Button>
          <Button size="small" variant={tab === "search" ? "accent" : "filled"} onClick={() => setTab("search")}>
            Search
          </Button>
        </div>

        {/* Search input (search tab only) */}
        {tab === "search" && (
          <div className="flex items-center gap-2 px-3 pb-2 shrink-0">
            <Input
              variant="filled"
              size="small"
              placeholder="Search YouTube…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSubmittedQuery(searchInput.trim());
              }}
              className="flex-1"
            />
            <Button
              size="small"
              variant="filled"
              iconOnly
              onClick={() => setSubmittedQuery(searchInput.trim())}
              disabled={!searchInput.trim()}
            >
              <SearchIcon className="size-3.5" />
            </Button>
          </div>
        )}

        <Separator />

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto">{renderList()}</div>

        {/* Paste fallback */}
        <Separator />
        <div className="flex items-center gap-2 px-3 py-2 shrink-0">
          <Input
            variant="filled"
            size="small"
            placeholder="Paste a YouTube link…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePaste();
            }}
            className="flex-1"
          />
          <Button size="small" variant="filled" iconOnly onClick={handlePaste} disabled={!urlInput.trim()}>
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </WidgetCard>
  );
}

// ─── Widget card shell ────────────────────────────────────────────────────────

function WidgetCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full rounded-card border border-separator bg-well overflow-hidden">
      <div className="widget-drag-handle flex items-center gap-2 px-3 py-2 border-b border-separator shrink-0 cursor-grab active:cursor-grabbing select-none">
        {icon}
        <Text variant="small-strong" color="primary">
          {title}
        </Text>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

// ─── Contacts dialog ─────────────────────────────────────────────────────────

function ContactsDialog() {
  function openLink(url: string) {
    void window.glazeAPI.shell.openExternal(url);
  }

  return (
    <Dialog
      title="Contact & Feedback"
      description="Bug reports and suggestions are welcome."
      confirmLabel="Done"
      onConfirm={() => {}}
      trigger={
        <Button variant="glass" size="large" iconOnly title="Contact & Feedback">
          <AtSignIcon className="size-4.5" />
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => openLink("mailto:brunorv@hotmail.com")}
          className="flex items-center gap-3 p-3 rounded-card bg-control hover:opacity-70 active:opacity-50 transition-opacity text-left"
        >
          <MailIcon className="size-4 text-secondary shrink-0" />
          <div>
            <Text variant="small" color="secondary">Email</Text>
            <Text>brunorv@hotmail.com</Text>
          </div>
        </button>
        <button
          type="button"
          onClick={() => openLink("https://www.linkedin.com/in/brunorv/")}
          className="flex items-center gap-3 p-3 rounded-card bg-control hover:opacity-70 active:opacity-50 transition-opacity text-left"
        >
          <LinkedinIcon className="size-4 text-secondary shrink-0" />
          <div>
            <Text variant="small" color="secondary">LinkedIn</Text>
            <Text>linkedin.com/in/brunorv</Text>
          </div>
        </button>
      </div>
    </Dialog>
  );
}

// ─── Dashboard grid layout ──────────────────────────────────────────────────────

const LAYOUT_STORAGE_KEY = "mycockpit:dashboard-layout:v1";

// Grid is 12 columns. Each widget declares its grid position/size + minimums.
const DEFAULT_LAYOUT: Layout = [
  { i: "github", x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 },
  { i: "rss", x: 0, y: 5, w: 6, h: 6, minW: 3, minH: 3 },
  { i: "ai", x: 6, y: 5, w: 6, h: 6, minW: 3, minH: 4 },
  { i: "gmail", x: 0, y: 11, w: 6, h: 6, minW: 3, minH: 3 },
  { i: "calendar", x: 6, y: 11, w: 6, h: 6, minW: 3, minH: 3 },
  { i: "websites", x: 0, y: 17, w: 6, h: 4, minW: 3, minH: 3 },
  { i: "youtube", x: 6, y: 17, w: 6, h: 8, minW: 4, minH: 6 },
];

const WIDGET_IDS = DEFAULT_LAYOUT.map((item) => item.i);

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Layout;
    // Only trust a stored layout that covers every known widget.
    const ids = new Set(parsed.map((p) => p.i));
    if (WIDGET_IDS.every((id) => ids.has(id))) return parsed;
  } catch {
    // fall through to default
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota/serialization errors — layout is a convenience, not critical
  }
}

// ─── Main HomeView ─────────────────────────────────────────────────────────────

export function HomeView() {
  const queryClient = useQueryClient();
  const { width, containerRef, mounted } = useContainerWidth();
  const [layout, setLayout] = useState<Layout>(() => loadLayout());

  function handleLayoutChange(next: Layout) {
    setLayout(next);
    saveLayout(next);
  }

  function handleResetLayout() {
    console.log("[HomeView:resetLayout]");
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }

  const configQuery = useQuery<AppConfig>({
    queryKey: ["config"],
    queryFn: () => ipc("config:get"),
    staleTime: 30_000,
  });

  const githubStatusQuery = useQuery<GithubStatus>({
    queryKey: ["github:status"],
    queryFn: () => ipc("github:getStatus"),
    staleTime: 60_000,
  });

  const googleStatusQuery = useQuery<GoogleStatus>({
    queryKey: ["google:status"],
    queryFn: () => ipc("google:getStatus"),
    staleTime: 60_000,
  });

  const googleConnectMutation = useMutation({
    mutationFn: () => ipc("google:connect"),
    onSuccess: () => void googleStatusQuery.refetch(),
  });

  const googleDisconnectMutation = useMutation({
    mutationFn: () => ipc("google:disconnect"),
    onSuccess: () => void googleStatusQuery.refetch(),
  });

  function handleGoogleChipClick() {
    const status = googleStatusQuery.data;
    if (!status?.configured) {
      void ipc("window:openSettings");
    } else if (status.connected) {
      googleDisconnectMutation.mutate();
    } else {
      googleConnectMutation.mutate();
    }
  }

  // Listen for config:changed broadcast
  useEffect(() => {
    console.log("[HomeView:mount] Subscribing to config:changed");
    const unsub = window.glazeAPI.glaze.ipc.onNotification("config:changed", (params) => {
      console.log("[HomeView:config:changed]", { params });
      queryClient.setQueryData(["config"], params);
    });
    return () => unsub();
  }, [queryClient]);

  function handleRefreshAll() {
    console.log("[HomeView:refreshAll]");
    void queryClient.invalidateQueries();
  }

  function openSettings() {
    console.log("[HomeView:openSettings]");
    void ipc("window:openSettings");
  }

  const config = configQuery.data;

  return (
    <div className="h-full flex flex-col">
      <Toolbar>
        <ToolbarContent>
          <ToolbarTitle>My Cockpit</ToolbarTitle>
        </ToolbarContent>
        <ToolbarActions>
          <div className="flex items-center gap-1.5 mr-2">
            <ConnectionChip
              icon={<GithubIcon className="size-3.5" />}
              label="GitHub"
              connected={!!githubStatusQuery.data?.connected}
            />
            <ConnectionChip
              icon={<MailIcon className="size-3.5" />}
              label="Google"
              connected={!!googleStatusQuery.data?.connected}
              onClick={handleGoogleChipClick}
            />
          </div>
          <ContactsDialog />
          <Button variant="glass" size="large" iconOnly onClick={handleResetLayout} title="Reset layout">
            <RotateCcwIcon className="size-4.5" />
          </Button>
          <Button variant="glass" size="large" iconOnly onClick={handleRefreshAll}>
            <RefreshCwIcon className="size-4.5" />
          </Button>
          <Button variant="glass" size="large" iconOnly onClick={openSettings}>
            <SettingsIcon className="size-4.5" />
          </Button>
        </ToolbarActions>
      </Toolbar>

      {configQuery.isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2Icon className="size-8 animate-spin text-tertiary" />
          <Text variant="small" color="tertiary">
            Loading dashboard…
          </Text>
        </div>
      ) : configQuery.isError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <AlertCircleIcon className="size-8 text-support-red" />
          <Text variant="small" color="secondary">
            Failed to load configuration
          </Text>
        </div>
      ) : config ? (
        <ScrollArea className="flex-1">
          <div ref={containerRef} className="px-2 py-1 w-full">
            {mounted && width > 0 && (
              <GridLayout
                width={width}
                layout={layout}
                onLayoutChange={handleLayoutChange}
                gridConfig={{ cols: 12, rowHeight: 80, margin: [16, 16], containerPadding: [16, 16] }}
                dragConfig={{ handle: ".widget-drag-handle" }}
                resizeConfig={{ handles: ["se"] }}
              >
                <div key="github">
                  <GitHubWidget config={config} />
                </div>
                <div key="rss">
                  <RssWidget config={config} />
                </div>
                <div key="ai">
                  <AiChatWidget config={config} />
                </div>
                <div key="gmail">
                  <GmailWidget />
                </div>
                <div key="calendar">
                  <CalendarWidget />
                </div>
                <div key="websites">
                  <WebsitesWidget config={config} />
                </div>
                <div key="youtube">
                  <YouTubeWidget config={config} />
                </div>
              </GridLayout>
            )}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
}
