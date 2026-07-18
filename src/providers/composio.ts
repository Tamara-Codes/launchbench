import "server-only";
import { Composio } from "@composio/core";
import { getEnv, hasKey } from "@/env";
import { safeErrorMessage } from "@/lib/redact";

export const GMAIL_TOOLS = {
  SEND: "GMAIL_SEND_EMAIL",
  DRAFT: "GMAIL_CREATE_EMAIL_DRAFT",
  FETCH: "GMAIL_FETCH_EMAILS",
} as const;

export interface InitiateResult {
  redirectUrl: string;
  connectionId: string;
}

export interface ConnectionStatus {
  status: "active" | "initiated" | "expired" | "failed" | "disconnected";
  accountEmail: string;
  connectedAccountId: string;
}

export interface SendResult {
  messageId: string;
  threadId: string;
}

export interface DraftResult {
  draftId: string;
  threadId: string;
}

export interface ReplyMessage {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  internalDate: string;
}

function normalizeStatus(raw: string): ConnectionStatus["status"] {
  const s = (raw || "").toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "INITIATED" || s === "INITIALIZING") return "initiated";
  if (s === "EXPIRED") return "expired";
  if (s === "FAILED" || s === "INACTIVE") return "failed";
  return "disconnected";
}

/** Reads only the Gmail address claim from an OAuth identity token; the token is never stored. */
function emailFromIdToken(value: unknown): string {
  if (typeof value !== "string") return "";
  const payload = value.split(".")[1];
  if (!payload) return "";
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown };
    return typeof parsed.email === "string" ? parsed.email.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Gmail provider adapter over Composio. All Gmail actions run through the
 * hosted Composio connection for a single local user; we persist only the
 * Composio connection identifiers, never raw OAuth tokens.
 */
export class ComposioGmailProvider {
  private client: Composio | null = null;

  isConfigured(): boolean {
    return hasKey("COMPOSIO_API_KEY") && hasKey("COMPOSIO_AUTH_CONFIG_ID");
  }

  hasApiKey(): boolean {
    return hasKey("COMPOSIO_API_KEY");
  }

  authConfigId(): string {
    return getEnv().COMPOSIO_AUTH_CONFIG_ID;
  }

  private getClient(): Composio {
    if (!this.hasApiKey()) throw new Error("COMPOSIO_API_KEY is not configured.");
    if (!this.client) {
      this.client = new Composio({ apiKey: getEnv().COMPOSIO_API_KEY });
    }
    return this.client;
  }

  /** Begin the hosted OAuth flow and return the URL to open in the browser. */
  async initiate(userId: string, callbackUrl: string): Promise<InitiateResult> {
    if (!this.isConfigured())
      throw new Error("Composio API key or auth config id is not configured.");
    const client = this.getClient();
    try {
      const req: any = await client.connectedAccounts.initiate(
        userId,
        this.authConfigId(),
        { callbackUrl },
      );
      return {
        redirectUrl: String(req.redirectUrl ?? req.redirect_url ?? ""),
        connectionId: String(req.id ?? req.connectionId ?? ""),
      };
    } catch (err) {
      throw new Error(`Composio initiate failed: ${safeErrorMessage(err)}`);
    }
  }

  async getStatus(connectedAccountId: string): Promise<ConnectionStatus> {
    const client = this.getClient();
    try {
      const acct: any = await client.connectedAccounts.get(connectedAccountId);
      const status = normalizeStatus(acct?.status ?? "");
      let accountEmail = String(
        acct?.data?.email ?? acct?.meta?.email ?? acct?.email ??
        emailFromIdToken(acct?.data?.id_token ?? acct?.state?.val?.id_token),
      );
      if (!accountEmail && status === "active") {
        accountEmail = await this.getConnectedEmail(connectedAccountId);
      }
      return {
        status,
        accountEmail,
        connectedAccountId: String(acct?.id ?? connectedAccountId),
      };
    } catch (err) {
      throw new Error(`Composio status check failed: ${safeErrorMessage(err)}`);
    }
  }

  async disconnect(connectedAccountId: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.connectedAccounts.delete(connectedAccountId);
    } catch (err) {
      throw new Error(`Composio disconnect failed: ${safeErrorMessage(err)}`);
    }
  }

  /** Reads Gmail's authenticated profile through Composio; no token is exposed or stored. */
  private async getConnectedEmail(connectedAccountId: string): Promise<string> {
    const result: any = await this.getClient().tools.proxyExecute({
      endpoint: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      method: "GET",
      connectedAccountId,
    });
    return String(result?.data?.emailAddress ?? "").trim();
  }

  private async exec(slug: string, userId: string, args: Record<string, unknown>) {
    const client = this.getClient();
    const res: any = await client.tools.execute(slug, { userId, arguments: args });
    if (res && res.successful === false) {
      throw new Error(`Gmail action ${slug} failed: ${safeErrorMessage(res.error)}`);
    }
    return res?.data ?? res ?? {};
  }

  async createDraft(
    userId: string,
    to: string,
    subject: string,
    body: string,
    threadId?: string,
  ): Promise<DraftResult> {
    const args: Record<string, unknown> = {
      recipient_email: to,
      subject,
      body,
      is_html: false,
    };
    if (threadId) args.thread_id = threadId;
    const data = await this.exec(GMAIL_TOOLS.DRAFT, userId, args);
    return {
      draftId: String(data.draft_id ?? data.id ?? data.response_data?.id ?? ""),
      threadId: String(data.thread_id ?? data.threadId ?? threadId ?? ""),
    };
  }

  async sendEmail(
    userId: string,
    to: string,
    subject: string,
    body: string,
    threadId?: string,
  ): Promise<SendResult> {
    const args: Record<string, unknown> = {
      recipient_email: to,
      subject,
      body,
      is_html: false,
    };
    if (threadId) args.thread_id = threadId;
    const data = await this.exec(GMAIL_TOOLS.SEND, userId, args);
    return {
      messageId: String(data.id ?? data.message_id ?? data.response_data?.id ?? ""),
      threadId: String(
        data.thread_id ?? data.threadId ?? data.response_data?.threadId ?? threadId ?? "",
      ),
    };
  }

  async fetchReplies(
    userId: string,
    query: string,
    maxResults = 25,
  ): Promise<ReplyMessage[]> {
    const data = await this.exec(GMAIL_TOOLS.FETCH, userId, {
      query,
      max_results: maxResults,
      include_payload: false,
      verbose: false,
    });
    const messages: any[] =
      data.messages ?? data.messageList ?? data.data?.messages ?? [];
    return (Array.isArray(messages) ? messages : []).map((m) => ({
      messageId: String(m.messageId ?? m.id ?? ""),
      threadId: String(m.threadId ?? m.thread_id ?? ""),
      from: String(m.sender ?? m.from ?? ""),
      subject: String(m.subject ?? ""),
      snippet: String(m.snippet ?? m.messageText ?? ""),
      internalDate: String(m.internalDate ?? m.messageTimestamp ?? ""),
    }));
  }
}

export const composioGmail = new ComposioGmailProvider();
