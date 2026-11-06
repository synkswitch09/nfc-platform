"use client";
import { ArrowRight, ArrowUpRight, Check, Plus } from "lucide-react";
import type { AssistantWorkspace } from "@prisma/client";
import type { SocialConnectionView } from "./social-connections";
import {
  channelName,
  needsAttention,
  type ConversationView,
} from "./workspace-view";

export function AssistantOverview({
  workspace,
  connections,
  conversations,
  active,
  ready,
  used,
  limit,
  issues,
  busy,
  onNavigate,
}: {
  workspace: AssistantWorkspace;
  connections: SocialConnectionView[];
  conversations: ConversationView[];
  active: boolean;
  ready: boolean;
  used: number;
  limit: number;
  issues: number;
  busy: boolean;
  onNavigate: (tab: string) => void;
}) {
  const connected = connections.filter((c) => c.status === "CONNECTED");
  const automated = connected.filter(
    (c) =>
      c.enabled &&
      (c.autoMessages || c.autoComments) &&
      (!c.tokenExpiresAt || new Date(c.tokenExpiresAt) > new Date()),
  );
  const published = Boolean(workspace.knowledgeApprovedAt),
    website =
      workspace.channels.includes("WEB") && workspace.allowedOrigins.length > 0;
  const attention = conversations.filter(needsAttention),
    recent = [
      ...attention,
      ...conversations.filter((c) => !needsAttention(c)),
    ].slice(0, 5);
  const steps = [
    {
      title: "Teach your assistant",
      description: published
        ? "Your business information is published."
        : "Add your information, test an answer and publish.",
      done: published,
      target: "Information",
    },
    {
      title: "Connect a channel",
      description:
        connected.length || website
          ? "A channel is configured."
          : "Choose where customers can contact you.",
      done: Boolean(connected.length || website),
      target: "Connections",
    },
    {
      title: "Turn on replies",
      description: workspace.pausedAt
        ? "Replies are paused by the administrator."
        : !active
          ? "Start your trial or review your plan."
          : !ready
            ? "The AI connection needs administrator setup."
            : automated.length || website
              ? "Reply settings are configured. Send a real test message."
              : "Activate replies on a connected channel.",
      done: Boolean(
        active &&
          ready &&
          published &&
          !workspace.pausedAt &&
          (automated.length || website),
      ),
      target:
        workspace.pausedAt || !ready
          ? "Help"
          : !active
            ? "Billing"
            : "Connections",
    },
    {
      title: "Receive your first conversation",
      description: conversations.length
        ? "Your inbox has received a conversation."
        : "Send a customer message, then check your inbox.",
      done: Boolean(conversations.length),
      target: "Conversations",
    },
  ];
  const complete = steps.filter((s) => s.done).length,
    changed =
      published &&
      (workspace.businessKnowledge !== workspace.publishedKnowledge ||
        workspace.masterPrompt !== workspace.publishedPrompt);
  return (
    <div className="ai-desk">
      <div className="ai-desk-intro">
        <div>
          <p className="ai-eyebrow">THE DAILY DESK</p>
          <h3>Today’s work.</h3>
          <p>
            Conversations to review. Customers to follow up. Your next move.
          </p>
        </div>
        <button
          className="ai-button"
          disabled={busy}
          onClick={() =>
            onNavigate(
              attention.length
                ? "Conversations"
                : steps.find((s) => !s.done)?.target || "Conversations",
            )
          }
        >
          {attention.length
            ? `Review ${attention.length} conversation${attention.length === 1 ? "" : "s"}`
            : complete < 4
              ? "Continue setup"
              : "Open your inbox"}
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="ai-desk-numbers" aria-label="Workspace activity">
        <div>
          <span>NEED ATTENTION</span>
          <strong>{attention.length.toString().padStart(2, "0")}</strong>
          <small>In your loaded conversations</small>
        </div>
        <div>
          <span>RECENT CONVERSATIONS</span>
          <strong>{conversations.length.toString().padStart(2, "0")}</strong>
          <small>Latest 30 in your inbox</small>
        </div>
        <div>
          <span>CONFIGURED CHANNELS</span>
          <strong>
            {(connected.length + (website ? 1 : 0)).toString().padStart(2, "0")}
          </strong>
          <small>Accounts and website setup</small>
        </div>
        <div className="ai-desk-allowance">
          <span>RESPONSE ALLOWANCE</span>
          <strong>
            {used.toLocaleString()}
            <small> / {limit.toLocaleString()}</small>
          </strong>
          <meter
            aria-label="AI response allowance used"
            min={0}
            max={Math.max(limit, 1)}
            value={Math.min(used, Math.max(limit, 1))}
          />
          <small>Used in this service period</small>
        </div>
      </div>
      <div className="ai-desk-columns">
        <div className="ai-desk-primary">
          <section className="ai-ledger">
            <header>
              <div>
                <span className="ai-section-index">01 / INBOX</span>
                <h4>Conversations on your desk</h4>
              </div>
              <button
                className="ai-text-button"
                disabled={busy}
                onClick={() => onNavigate("Conversations")}
              >
                View inbox <ArrowUpRight size={15} />
              </button>
            </header>
            {recent.length ? (
              <div className="ai-activity-list">
                {recent.map((c) => (
                  <button
                    className="ai-activity-row"
                    key={c.id}
                    disabled={busy}
                    onClick={() => onNavigate("Conversations")}
                  >
                    <span
                      className={`ai-activity-mark ${needsAttention(c) ? "attention" : ""}`}
                    >
                      {channelName(c.channel).slice(0, 1)}
                    </span>
                    <span>
                      <strong>
                        {c.messages[0]?.text || "New conversation"}
                      </strong>
                      <small>
                        {channelName(c.channel)} ·{" "}
                        {new Date(c.updatedAt).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                    </span>
                    <span
                      className={`ai-badge ${needsAttention(c) ? "ai-warning-badge" : "ai-neutral-badge"}`}
                    >
                      {needsAttention(c) ? "Review" : "In inbox"}
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="ai-desk-empty">
                <span className="ai-empty-number">00</span>
                <div>
                  <h5>Your first conversation starts here.</h5>
                  <p>
                    Connect a channel and send a message from a customer
                    account. It will appear in your inbox after you refresh.
                  </p>
                  <button
                    className="ai-text-button"
                    disabled={busy}
                    onClick={() => onNavigate("Connections")}
                  >
                    Set up a channel <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
            <footer>
              Showing recent loaded conversations. A connection alone does not
              confirm delivery.
            </footer>
          </section>
          <section className="ai-ledger ai-setup-ledger">
            <header>
              <div>
                <span className="ai-section-index">02 / SETUP</span>
                <h4>
                  {complete === 4
                    ? "Your foundations are in place"
                    : "Before you go live"}
                </h4>
              </div>
              <span className="ai-fraction">
                {complete}
                <span> / 4</span>
              </span>
            </header>
            <ol>
              {steps.map((step, i) => (
                <li key={step.title}>
                  <button
                    disabled={busy}
                    onClick={() => onNavigate(step.target)}
                  >
                    <span
                      className={`ai-setup-number ${step.done ? "done" : ""}`}
                    >
                      {step.done ? (
                        <Check size={14} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>
                      <strong>{step.title}</strong>
                      <small>{step.description}</small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="ai-desk-secondary">
          <section className="ai-ledger">
            <header>
              <div>
                <span className="ai-section-index">
                  CONNECTED TO YOUR BUSINESS
                </span>
                <h4>Channel desk</h4>
              </div>
            </header>
            {["INSTAGRAM", "FACEBOOK", "WHATSAPP", "TELEGRAM", "WEB"].map(
              (provider, i) => {
                const c = connections.find((x) => x.provider === provider),
                  configured =
                    provider === "WEB" ? website : c?.status === "CONNECTED",
                  enabled =
                    provider === "WEB"
                      ? website
                      : c?.enabled && (c.autoMessages || c.autoComments);
                return (
                  <button
                    className="ai-connection-row"
                    key={provider}
                    disabled={busy}
                    onClick={() => onNavigate("Connections")}
                  >
                    <span
                      className={`ai-channel-letter channel-${provider.toLowerCase()}`}
                    >
                      {["ig", "fb", "wa", "tg", "w"][i]}
                    </span>
                    <span>
                      <strong>{channelName(provider)}</strong>
                      <small>
                        {c?.status === "REAUTH_REQUIRED"
                          ? "Reconnect needed"
                          : configured
                            ? enabled
                              ? "Reply settings on"
                              : "Connected · paused"
                            : "Not connected"}
                      </small>
                    </span>
                    <span
                      className={`ai-connection-dot ${configured ? "connected" : ""}`}
                    />
                  </button>
                );
              },
            )}
            <footer>
              <button
                className="ai-text-button"
                disabled={busy}
                onClick={() => onNavigate("Connections")}
              >
                <Plus size={14} />
                Manage connections
              </button>
            </footer>
          </section>
          <section className="ai-studio-note">
            <span className="ai-section-index">CONTENT STUDIO</span>
            <span className="ai-note-cross" aria-hidden="true">
              ✳
            </span>
            <h4>
              Something worth
              <br />
              putting out there.
            </h4>
            <p>
              Turn your business knowledge into a post, a reel script or a new
              idea to test.
            </p>
            <button
              className="ai-text-button"
              disabled={busy}
              onClick={() => onNavigate("Content")}
            >
              Open the studio <ArrowUpRight size={16} />
            </button>
          </section>
          <section className="ai-desk-memo">
            <span className="ai-section-index">BUSINESS NOTES</span>
            <h4>
              {changed
                ? "Your changes are still a draft."
                : "Keep your answers current."}
            </h4>
            <p>
              {changed
                ? "Your saved information differs from the published version. Test it and publish when ready."
                : published
                  ? `Last published ${new Date(workspace.knowledgeApprovedAt!).toLocaleDateString("en-AU")}. Review prices, products and policies when they change.`
                  : "Add a website or your FAQs so the assistant has reliable information to use."}
            </p>
            <button
              className="ai-text-button"
              disabled={busy}
              onClick={() => onNavigate("Information")}
            >
              Review information <ArrowRight size={14} />
            </button>
          </section>
        </aside>
      </div>
      {issues > 0 && (
        <div className="ai-status ai-warning-status">
          <strong>
            {issues} recent reply issue{issues === 1 ? "" : "s"} to review.
          </strong>{" "}
          Check provider delivery before resending an unconfirmed reply.{" "}
          <button
            className="ai-text-button"
            disabled={busy}
            onClick={() => onNavigate("Connections")}
          >
            Review issues <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
