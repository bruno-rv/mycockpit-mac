import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Label,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  Toolbar,
  ToolbarContent,
  ToolbarTitle,
  ToolbarActions,
  Field,
  FieldGroup,
  FieldSet,
  Button,
  Input,
  Separator,
  Text,
  Badge,
  Dialog,
  toast,
} from "@glaze/core/components";
import type { NativeThemeInfo } from "@glaze/core/ipc";
import {
  GithubIcon,
  MailIcon,
  KeyIcon,
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
  EyeIcon,
  EyeOffIcon,
  LinkIcon,
  HelpCircleIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppConfig {
  aiProvider: string;
  rssFeeds: { title: string; url: string }[];
  websites: { title: string; url: string }[];
  youtube: { videoId?: string; title?: string };
  hasAnthropicKey: boolean;
  hasOpenAIKey: boolean;
  hasGoogleCreds: boolean;
}

interface GithubStatus {
  connected: boolean;
  login?: string;
  avatarUrl?: string;
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  configured: boolean;
}

// ─── IPC helper ───────────────────────────────────────────────────────────────

function ipc<T>(channel: string, params?: unknown): Promise<T> {
  return window.glazeAPI.glaze.ipc.invoke<T>(channel, params);
}

// ─── Masked key input ─────────────────────────────────────────────────────────

function MaskedInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-1 flex-1">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
      <Button
        variant="transparent"
        size="medium"
        iconOnly
        onClick={() => setVisible((v) => !v)}
        type="button"
      >
        {visible ? <EyeOffIcon className="size-4 text-tertiary" /> : <EyeIcon className="size-4 text-tertiary" />}
      </Button>
    </div>
  );
}

// ─── Appearance Section ───────────────────────────────────────────────────────

function AppearanceSection() {
  const [themeInfo, setThemeInfo] = useState<NativeThemeInfo | null>(null);

  useEffect(() => {
    void window.glazeAPI.nativeTheme.getInfo().then(setThemeInfo).catch(() => {});
  }, []);

  const handleThemeChange = async (value: string) => {
    const source = value as "system" | "light" | "dark";
    try {
      await window.glazeAPI.nativeTheme.setThemeSource(source);
      const info = await window.glazeAPI.nativeTheme.getInfo();
      setThemeInfo(info);
    } catch {
      toast.error("Failed to set theme");
    }
  };

  return (
    <FieldSet title="Appearance">
      <FieldGroup>
        <Field label="Theme" description="Choose light, dark, or follow system">
          <RadioGroup
            value={themeInfo?.themeSource ?? "system"}
            onValueChange={handleThemeChange}
            orientation="horizontal"
          >
            <Label>
              <RadioGroupItem value="system" />
              Auto
            </Label>
            <Label>
              <RadioGroupItem value="light" />
              Light
            </Label>
            <Label>
              <RadioGroupItem value="dark" />
              Dark
            </Label>
          </RadioGroup>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── AI Section ───────────────────────────────────────────────────────────────

function AiSection({ config }: { config: AppConfig }) {
  const queryClient = useQueryClient();
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [savingAnthropicKey, setSavingAnthropicKey] = useState(false);
  const [savingOpenaiKey, setSavingOpenaiKey] = useState(false);

  const handleProviderChange = async (provider: string) => {
    console.log("[SettingsView:AI:providerChange]", { provider });
    try {
      await ipc("config:setAiProvider", { provider });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, aiProvider: provider } : old));
      toast.success("AI provider updated");
    } catch {
      toast.error("Failed to update AI provider");
    }
  };

  const handleSaveAnthropicKey = async () => {
    if (!anthropicKey.trim()) return;
    setSavingAnthropicKey(true);
    console.log("[SettingsView:AI:saveAnthropicKey]");
    try {
      await ipc("config:setApiKey", { provider: "anthropic", key: anthropicKey.trim() });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, hasAnthropicKey: true } : old));
      setAnthropicKey("");
      toast.success("Anthropic API key saved");
    } catch {
      toast.error("Failed to save API key");
    } finally {
      setSavingAnthropicKey(false);
    }
  };

  const handleClearAnthropicKey = async () => {
    console.log("[SettingsView:AI:clearAnthropicKey]");
    try {
      await ipc("config:clearApiKey", { provider: "anthropic" });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, hasAnthropicKey: false } : old));
      toast.success("Anthropic API key removed");
    } catch {
      toast.error("Failed to remove API key");
    }
  };

  const handleSaveOpenaiKey = async () => {
    if (!openaiKey.trim()) return;
    setSavingOpenaiKey(true);
    console.log("[SettingsView:AI:saveOpenaiKey]");
    try {
      await ipc("config:setApiKey", { provider: "openai", key: openaiKey.trim() });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, hasOpenAIKey: true } : old));
      setOpenaiKey("");
      toast.success("OpenAI API key saved");
    } catch {
      toast.error("Failed to save API key");
    } finally {
      setSavingOpenaiKey(false);
    }
  };

  const handleClearOpenaiKey = async () => {
    console.log("[SettingsView:AI:clearOpenaiKey]");
    try {
      await ipc("config:clearApiKey", { provider: "openai" });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, hasOpenAIKey: false } : old));
      toast.success("OpenAI API key removed");
    } catch {
      toast.error("Failed to remove API key");
    }
  };

  return (
    <FieldSet title="AI">
      <FieldGroup>
        <Field label="Provider" description="Select the AI provider for the chatbot">
          <RadioGroup
            value={config.aiProvider}
            onValueChange={handleProviderChange}
            orientation="horizontal"
          >
            <Label>
              <RadioGroupItem value="anthropic" />
              Anthropic
            </Label>
            <Label>
              <RadioGroupItem value="openai" />
              OpenAI
            </Label>
          </RadioGroup>
        </Field>

        <Separator />

        <Field
          label="Anthropic API Key"
          description={config.hasAnthropicKey ? "A key is currently saved" : "Paste your Anthropic API key"}
        >
          <div className="flex items-center gap-2 flex-1">
            {config.hasAnthropicKey ? (
              <>
                <Badge color="green">Saved</Badge>
                <Button size="small" variant="transparent" onClick={() => void handleClearAnthropicKey()}>
                  <TrashIcon className="size-3.5 text-support-red" />
                  Remove
                </Button>
              </>
            ) : (
              <>
                <MaskedInput
                  value={anthropicKey}
                  onChange={setAnthropicKey}
                  placeholder="sk-ant-…"
                />
                <Button
                  size="small"
                  variant="filled"
                  onClick={() => void handleSaveAnthropicKey()}
                  disabled={savingAnthropicKey || !anthropicKey.trim()}
                >
                  {savingAnthropicKey ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <KeyIcon className="size-3.5" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </Field>

        <Separator />

        <Field
          label="OpenAI API Key"
          description={config.hasOpenAIKey ? "A key is currently saved" : "Paste your OpenAI API key"}
        >
          <div className="flex items-center gap-2 flex-1">
            {config.hasOpenAIKey ? (
              <>
                <Badge color="green">Saved</Badge>
                <Button size="small" variant="transparent" onClick={() => void handleClearOpenaiKey()}>
                  <TrashIcon className="size-3.5 text-support-red" />
                  Remove
                </Button>
              </>
            ) : (
              <>
                <MaskedInput
                  value={openaiKey}
                  onChange={setOpenaiKey}
                  placeholder="sk-…"
                />
                <Button
                  size="small"
                  variant="filled"
                  onClick={() => void handleSaveOpenaiKey()}
                  disabled={savingOpenaiKey || !openaiKey.trim()}
                >
                  {savingOpenaiKey ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <KeyIcon className="size-3.5" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── RSS Feeds Section ────────────────────────────────────────────────────────

function RssFeedsSection({ config }: { config: AppConfig }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    const feeds = [...config.rssFeeds, { title: newTitle.trim(), url: newUrl.trim() }];
    setSaving(true);
    console.log("[SettingsView:RSS:add]", { title: newTitle, url: newUrl });
    try {
      await ipc("config:setRssFeeds", { feeds });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, rssFeeds: feeds } : old));
      setNewTitle("");
      setNewUrl("");
      toast.success("Feed added");
    } catch {
      toast.error("Failed to add feed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (index: number) => {
    const feeds = config.rssFeeds.filter((_, i) => i !== index);
    console.log("[SettingsView:RSS:remove]", { index });
    try {
      await ipc("config:setRssFeeds", { feeds });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, rssFeeds: feeds } : old));
      toast.success("Feed removed");
    } catch {
      toast.error("Failed to remove feed");
    }
  };

  return (
    <FieldSet title="RSS Feeds">
      <FieldGroup>
        {config.rssFeeds.map((feed, index) => (
          <Field key={`${feed.url}-${index}`} label={feed.title} description={feed.url}>
            <Button size="small" variant="transparent" onClick={() => void handleRemove(index)}>
              <TrashIcon className="size-3.5 text-support-red" />
              Remove
            </Button>
          </Field>
        ))}

        {config.rssFeeds.length > 0 && <Separator />}

        <Field label="Add Feed" description="Enter a title and RSS feed URL">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              size="small"
              variant="filled"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-28"
            />
            <Input
              size="small"
              variant="filled"
              placeholder="https://…/feed.xml"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
              }}
              className="flex-1 min-w-0"
            />
            <Button
              size="small"
              variant="filled"
              onClick={() => void handleAdd()}
              disabled={saving || !newTitle.trim() || !newUrl.trim()}
            >
              {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
              Add
            </Button>
          </div>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── Websites Section ─────────────────────────────────────────────────────────

function WebsitesSection({ config }: { config: AppConfig }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    const websites = [...config.websites, { title: newTitle.trim(), url: newUrl.trim() }];
    setSaving(true);
    console.log("[SettingsView:Websites:add]", { title: newTitle, url: newUrl });
    try {
      await ipc("config:setWebsites", { websites });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, websites } : old));
      setNewTitle("");
      setNewUrl("");
      toast.success("Website added");
    } catch {
      toast.error("Failed to add website");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (index: number) => {
    const websites = config.websites.filter((_, i) => i !== index);
    console.log("[SettingsView:Websites:remove]", { index });
    try {
      await ipc("config:setWebsites", { websites });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, websites } : old));
      toast.success("Website removed");
    } catch {
      toast.error("Failed to remove website");
    }
  };

  return (
    <FieldSet title="Quick-Launch Websites">
      <FieldGroup>
        {config.websites.map((site, index) => (
          <Field key={`${site.url}-${index}`} label={site.title} description={site.url}>
            <Button size="small" variant="transparent" onClick={() => void handleRemove(index)}>
              <TrashIcon className="size-3.5 text-support-red" />
              Remove
            </Button>
          </Field>
        ))}

        {config.websites.length > 0 && <Separator />}

        <Field label="Add Website" description="Enter a title and URL">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              size="small"
              variant="filled"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-28"
            />
            <Input
              size="small"
              variant="filled"
              placeholder="https://…"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
              }}
              className="flex-1 min-w-0"
            />
            <Button
              size="small"
              variant="filled"
              onClick={() => void handleAdd()}
              disabled={saving || !newTitle.trim() || !newUrl.trim()}
            >
              {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
              Add
            </Button>
          </div>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── Google Section ───────────────────────────────────────────────────────────

const REDIRECT_URI = "https://www.glaze.app/api/oauth/callback";

function SetupStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex items-center justify-center size-5 shrink-0 rounded-full bg-control text-secondary tabular-nums text-xs font-medium">
        {n}
      </span>
      <Text variant="small" color="secondary" as="p" className="flex-1 pt-0.5">
        {children}
      </Text>
    </li>
  );
}

function GoogleSetupDialog() {
  return (
    <Dialog
      size="large"
      title="Set up Google OAuth"
      description="A one-time setup in the Google Cloud Console to enable Gmail, Calendar, and YouTube."
      confirmLabel="Got it"
      onConfirm={() => {}}
      trigger={
        <Button size="small" variant="filled">
          <HelpCircleIcon className="size-3.5" />
          How to set up
        </Button>
      }
    >
      <ol className="flex flex-col gap-3">
        <SetupStep n={1}>
          Open the{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Google Cloud Console
          </Text>{" "}
          (console.cloud.google.com) and create or select a project.
        </SetupStep>
        <SetupStep n={2}>
          Go to{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            APIs &amp; Services → Library
          </Text>{" "}
          and enable the{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Gmail API
          </Text>
          ,{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Google Calendar API
          </Text>
          , and{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            YouTube Data API v3
          </Text>
          .
        </SetupStep>
        <SetupStep n={3}>
          Under{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            OAuth consent screen
          </Text>
          , choose{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            External
          </Text>
          , fill in the app name and your email, and add your Google account under{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Test users
          </Text>
          .
        </SetupStep>
        <SetupStep n={4}>
          Go to{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Credentials → Create credentials → OAuth client ID
          </Text>{" "}
          and pick application type{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Web application
          </Text>
          .
        </SetupStep>
        <SetupStep n={5}>
          Under{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Authorized redirect URIs
          </Text>
          , add this exact URI:
          <span className="mt-1.5 block rounded-control bg-control px-2 py-1 font-mono text-xs text-primary break-all">
            {REDIRECT_URI}
          </span>
        </SetupStep>
        <SetupStep n={6}>
          Click{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Create
          </Text>
          , then copy the{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Client ID
          </Text>{" "}
          and{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Client secret
          </Text>{" "}
          into the fields below and save.
        </SetupStep>
        <SetupStep n={7}>
          Click{" "}
          <Text as="span" variant="small" color="primary" className="font-medium">
            Connect
          </Text>{" "}
          and approve access to Gmail, Calendar, and YouTube.
        </SetupStep>
      </ol>
    </Dialog>
  );
}

function GoogleSection({ config }: { config: AppConfig }) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [clearingCreds, setClearingCreds] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const googleStatusQuery = useQuery<GoogleStatus>({
    queryKey: ["google:status"],
    queryFn: () => ipc("google:getStatus"),
    staleTime: 30_000,
  });

  const status = googleStatusQuery.data;

  const handleSaveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSavingCreds(true);
    console.log("[SettingsView:Google:saveCreds]");
    try {
      await ipc("config:setGoogleCredentials", {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, hasGoogleCreds: true } : old));
      setClientId("");
      setClientSecret("");
      await googleStatusQuery.refetch();
      toast.success("Google credentials saved");
    } catch {
      toast.error("Failed to save credentials");
    } finally {
      setSavingCreds(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    console.log("[SettingsView:Google:connect]");
    try {
      await ipc("google:connect");
      await googleStatusQuery.refetch();
      toast.success("Connected to Google");
    } catch (err) {
      toast.error(`Failed to connect: ${err}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    console.log("[SettingsView:Google:disconnect]");
    try {
      await ipc("google:disconnect");
      await googleStatusQuery.refetch();
      toast.success("Disconnected from Google");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleClearCreds = async () => {
    setClearingCreds(true);
    console.log("[SettingsView:Google:clearCreds]");
    try {
      // Disconnect first if connected so the token is cleaned up
      if (status?.connected) await ipc("google:disconnect").catch(() => {});
      await ipc("config:clearGoogleCredentials");
      queryClient.setQueryData<AppConfig>(["config"], (old) => (old ? { ...old, hasGoogleCreds: false } : old));
      await googleStatusQuery.refetch();
      toast.success("Google credentials removed");
    } catch {
      toast.error("Failed to remove credentials");
    } finally {
      setClearingCreds(false);
    }
  };

  return (
    <FieldSet title="Google">
      <FieldGroup>
        {/* Setup guide */}
        <Field label="Setup" description="New to Google Cloud? Follow the step-by-step guide">
          <GoogleSetupDialog />
        </Field>

        <Separator />

        {/* Connection status */}
        <Field label="Status" description={status?.email ?? "Not signed in"}>
          <div className="flex items-center gap-2">
            {status?.connected ? (
              <>
                <CheckCircle2Icon className="size-4 text-support-green shrink-0" />
                <Text variant="small" color="primary">
                  Connected
                </Text>
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <XCircleIcon className="size-3.5 text-secondary" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : status?.configured ? (
              <Button
                size="small"
                variant="filled"
                onClick={() => void handleConnect()}
                disabled={connecting}
              >
                {connecting ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <MailIcon className="size-3.5" />
                )}
                Connect
              </Button>
            ) : (
              <Text variant="small" color="tertiary">
                Configure credentials below first
              </Text>
            )}
          </div>
        </Field>

        <Separator />

        {/* Credentials */}
        <Field label="Client ID" description="Google OAuth 2.0 client ID">
          {config.hasGoogleCreds ? (
            <div className="flex items-center gap-2">
              <Badge color="green">Configured</Badge>
              <Button
                size="small"
                variant="transparent"
                onClick={() => void handleClearCreds()}
                disabled={clearingCreds}
              >
                {clearingCreds ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <TrashIcon className="size-3.5 text-support-red" />
                )}
                Reconfigure
              </Button>
            </div>
          ) : (
            <Input
              size="small"
              variant="filled"
              placeholder="…apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="flex-1"
            />
          )}
        </Field>

        {!config.hasGoogleCreds && (
          <>
            <Separator />
            <Field label="Client Secret" description="Google OAuth 2.0 client secret">
              <MaskedInput value={clientSecret} onChange={setClientSecret} placeholder="GOCSPX-…" />
            </Field>
            <Separator />
            <Field>
              <Button
                size="small"
                variant="filled"
                onClick={() => void handleSaveCreds()}
                disabled={savingCreds || !clientId.trim() || !clientSecret.trim()}
              >
                {savingCreds ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <KeyIcon className="size-3.5" />
                )}
                Save Credentials
              </Button>
            </Field>
          </>
        )}

        <Separator />

        {/* Redirect URI helper */}
        <Field
          label="Redirect URI"
          description="Register this URI in your Google Cloud Console OAuth app, and enable the Gmail, Calendar, and YouTube Data APIs. Already connected? Reconnect to grant YouTube access."
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              size="small"
              variant="filled"
              value="https://www.glaze.app/api/oauth/callback"
              readOnly
              className="flex-1 min-w-0 font-mono"
            />
            <Button
              size="small"
              variant="transparent"
              iconOnly
              onClick={() => {
                void navigator.clipboard?.writeText("https://www.glaze.app/api/oauth/callback");
                toast.success("Copied to clipboard");
              }}
            >
              <LinkIcon className="size-3.5 text-tertiary" />
            </Button>
          </div>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── GitHub Section ───────────────────────────────────────────────────────────

function GitHubSection() {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const githubStatusQuery = useQuery<GithubStatus>({
    queryKey: ["github:status"],
    queryFn: () => ipc("github:getStatus"),
    staleTime: 30_000,
  });

  const status = githubStatusQuery.data;

  const handleConnect = async () => {
    setConnecting(true);
    console.log("[SettingsView:GitHub:connect]");
    try {
      await ipc("github:connect");
      await githubStatusQuery.refetch();
      toast.success("Connected to GitHub");
    } catch (err) {
      toast.error(`Failed to connect: ${err}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    console.log("[SettingsView:GitHub:disconnect]");
    try {
      await ipc("github:disconnect");
      await githubStatusQuery.refetch();
      toast.success("Disconnected from GitHub");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <FieldSet title="GitHub">
      <FieldGroup>
        <Field
          label="Status"
          description={status?.login ? `Signed in as @${status.login}` : "Not connected"}
        >
          <div className="flex items-center gap-2">
            {status?.connected ? (
              <>
                <CheckCircle2Icon className="size-4 text-support-green shrink-0" />
                <Text variant="small" color="primary">
                  Connected
                </Text>
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <XCircleIcon className="size-3.5 text-secondary" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                size="small"
                variant="filled"
                onClick={() => void handleConnect()}
                disabled={connecting}
              >
                {connecting ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <GithubIcon className="size-3.5" />
                )}
                Connect GitHub
              </Button>
            )}
          </div>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

export function SettingsView() {
  const queryClient = useQueryClient();

  // Close settings window on Escape, unless an interactive element is focused or a popover is open
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;

      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }

      if (document.querySelector("[data-radix-popper-content-wrapper]")) {
        return;
      }

      event.preventDefault();
      void window.glazeAPI.glaze.ipc.invoke("window:closeSettings");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Subscribe to config:changed so settings stays in sync with main window
  useEffect(() => {
    const unsub = window.glazeAPI.glaze.ipc.onNotification("config:changed", (params) => {
      console.log("[SettingsView:config:changed]", { params });
      queryClient.setQueryData(["config"], params);
    });
    return () => unsub();
  }, [queryClient]);

  const configQuery = useQuery<AppConfig>({
    queryKey: ["config"],
    queryFn: () => window.glazeAPI.glaze.ipc.invoke("config:get"),
    staleTime: 30_000,
  });

  const config = configQuery.data;

  return (
    <ScrollArea
      toolbar={
        <Toolbar>
          <ToolbarContent>
            <ToolbarTitle>Settings</ToolbarTitle>
          </ToolbarContent>
          <ToolbarActions>
            <Button
              variant="accent"
              size="medium"
              onClick={() => void window.glazeAPI.glaze.ipc.invoke("window:closeSettings")}
            >
              Done
            </Button>
          </ToolbarActions>
        </Toolbar>
      }
    >
      <div className="px-4 flex flex-col gap-8 mb-8">
        <AppearanceSection />

        {config ? (
          <>
            <AiSection config={config} />
            <RssFeedsSection config={config} />
            <WebsitesSection config={config} />
            <GoogleSection config={config} />
            <GitHubSection />
          </>
        ) : configQuery.isLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2Icon className="size-4 animate-spin text-tertiary" />
            <Text variant="small" color="tertiary">
              Loading settings…
            </Text>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}
