"use client";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Sparkles,
} from "lucide-react";
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
  const connected = connections.filter((c) => c.status === "CONNECTED"),
    automated = connected.filter(
      (c) =>
        c.enabled &&
        (c.autoMessages || c.autoComments) &&
        (!c.tokenExpiresAt || new Date(c.tokenExpiresAt) > new Date()),
    ),
    published = Boolean(workspace.knowledgeApprovedAt),
    website =
      workspace.channels.includes("WEB") && workspace.allowedOrigins.length > 0,
    attention = conversations.filter(needsAttention).length;
  const steps = [
    {
      title: "Teach your assistant",
      description: published
        ? "Business information published."
        : "Add your details, test an answer and publish.",
      done: published,
      target: "Information",
    },
    {
      title: "Connect a channel",
      description:
        connected.length || website
          ? "A channel is configured."
          : "Choose where your customers can reach you.",
      done: Boolean(connected.length || website),
      target: "Connections",
    },
    {
      title: "Turn on replies",
      description: workspace.pausedAt
        ? "Replies are paused by the platform administrator."
        : !active
          ? "Start your trial or review your subscription."
          : !ready
            ? "The AI connection needs platform setup."
            : automated.length || website
              ? "Reply settings are configured. Send a real message to test."
              : "Save reply preferences and activate a channel.",
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
        ? "A customer conversation has reached your inbox."
        : "Send a new customer message, then check your inbox.",
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
    <>
      <section className="ai-welcome">
        <div>
          <span className="ai-eyebrow">Your business, in good hands</span>
          <h3>
            Less busywork.
            <br />
            More helpful conversations.
          </h3>
          <p>
            Give your assistant the right information, choose your channels and
            keep every customer conversation close.
          </p>
          <button
            className="ai-button"
            disabled={busy}
            onClick={() =>
              onNavigate(
                attention
                  ? "Conversations"
                  : steps.find((s) => !s.done)?.target || "Conversations",
              )
            }
          >
            {attention
              ? `Review ${attention} conversation${attention === 1 ? "" : "s"}`
              : complete < 4
                ? "Continue setup"
                : "Open your inbox"}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="ai-welcome-orbit" aria-hidden="true">
          <span className="ai-orbit-icon">
            <Sparkles size={42} />
          </span>
          <span className="ai-orbit-label">One assistant. Your voice.</span>
        </div>
      </section>
      <div className="ai-metrics">
        <article>
          <span>Configured channels</span>
          <strong>{connected.length + (website ? 1 : 0)}</strong>
          <small>Authorised accounts and website setup</small>
        </article>
        <article>
          <span>Recent conversations</span>
          <strong>{conversations.length}</strong>
          <small>Latest 30 loaded in your inbox</small>
        </article>
        <article>
          <span>Need attention</span>
          <strong>{attention}</strong>
          <small>Human takeover or a reply to review</small>
        </article>
        <article>
          <span>Included usage</span>
          <strong>
            {used.toLocaleString()}
            <small> / {limit.toLocaleString()}</small>
          </strong>
          <small>AI responses in this service period</small>
          <meter
            min={0}
            max={Math.max(limit, 1)}
            value={Math.min(used, Math.max(limit, 1))}
            aria-label="AI response allowance used"
          />
        </article>
      </div>
      <section className="ai-card ai-setup-card">
        <div className="ai-section-heading">
          <div>
            <p className="ai-eyebrow">A clear next step</p>
            <h3>
              {complete === 4
                ? "Your workspace is set up"
                : "Get ready to welcome customers"}
            </h3>
          </div>
          <span className="ai-badge ai-neutral-badge">
            {complete} of 4 complete
          </span>
        </div>
        <div className="ai-setup-steps">
          {steps.map((step, index) => (
            <button
              disabled={busy}
              key={step.title}
              onClick={() => onNavigate(step.target)}
            >
              <span
                className={`ai-step-indicator ${step.done ? "complete" : ""}`}
              >
                {step.done ? <Check size={17} aria-hidden="true" /> : index + 1}
              </span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
      <div className="ai-split">
        <section className="ai-card">
          <div className="ai-section-heading">
            <h3>Channel overview</h3>
            <button
              className="ai-text-button"
              disabled={busy}
              onClick={() => onNavigate("Connections")}
            >
              Manage channels <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <p className="ai-small">
            {automated.length} social channel
            {automated.length === 1 ? " has" : "s have"} automation switched on.
            Published knowledge and active service access are also required.
          </p>
          {["INSTAGRAM", "FACEBOOK", "WHATSAPP", "TELEGRAM"].map((provider) => {
            const c = connections.find((item) => item.provider === provider);
            return (
              <div className="ai-channel-summary" key={provider}>
                <span>{channelName(provider)}</span>
                <span
                  className={`ai-badge ${c?.status === "REAUTH_REQUIRED" ? "ai-warning-badge" : "ai-neutral-badge"}`}
                >
                  {c?.status === "REAUTH_REQUIRED"
                    ? "Reconnect needed"
                    : c?.status === "CONNECTED"
                      ? c.enabled && (c.autoMessages || c.autoComments)
                        ? "Automation on"
                        : "Connected · Paused"
                      : "Not connected"}
                </span>
              </div>
            );
          })}
          <p className="ai-small">
            A saved connection does not confirm message delivery. Send a real
            message and check the inbox.
          </p>
        </section>
        <section className="ai-card ai-lilac">
          <BookOpen size={22} aria-hidden="true" />
          <h3>Keep your answers up to date.</h3>
          <p className="ai-small">
            {changed
              ? "Your saved draft differs from the published version. Test it, then publish your changes."
              : published
                ? `Your information was published on ${new Date(workspace.knowledgeApprovedAt!).toLocaleDateString("en-AU")}. Review it when products or policies change.`
                : "Start with your website or a few useful FAQs. Your assistant uses only the information you publish."}
          </p>
          <button
            className="ai-button ai-secondary"
            disabled={busy}
            onClick={() => onNavigate("Information")}
          >
            Review your assistant <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
      </div>
      <section className="ai-card">
        <div className="ai-section-heading">
          <div>
            <h3>Grow with a clear next step.</h3>
            <p className="ai-small">
              Review an enquiry, prepare a campaign or plan your next post.
            </p>
          </div>
        </div>
        <div className="ai-actions">
          <button
            className="ai-button ai-secondary"
            disabled={busy}
            onClick={() => onNavigate("Clients")}
          >
            Clients & leads
          </button>
          <button
            className="ai-button ai-secondary"
            disabled={busy}
            onClick={() => onNavigate("Campaigns")}
          >
            Prepare a campaign
          </button>
          <button
            className="ai-button ai-secondary"
            disabled={busy}
            onClick={() => onNavigate("Content")}
          >
            Plan content
          </button>
          <button
            className="ai-button ai-secondary"
            disabled={busy}
            onClick={() => onNavigate("Tasks")}
          >
            Review tasks
          </button>
        </div>
      </section>
      {issues > 0 && (
        <div className="ai-status ai-warning-status">
          <strong>
            {issues} recent reply issue{issues === 1 ? "" : "s"} to review
          </strong>
          <p>
            Open Channels for details. Check delivery in Meta before resending
            an unconfirmed reply.
          </p>
          <button
            className="ai-text-button"
            disabled={busy}
            onClick={() => onNavigate("Connections")}
          >
            Review channel issues <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
