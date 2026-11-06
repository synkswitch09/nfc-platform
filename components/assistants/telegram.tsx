"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SocialConnectionView } from "./social-connections";
export function TelegramConnection({
  workspaceId,
  connection,
}: {
  workspaceId: string;
  connection?: SocialConnectionView;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(
          `/api/assistants/workspaces/${workspaceId}/telegram`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Connection updated.");
      router.refresh();
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not update Telegram.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ai-card">
      <div className="ai-section-heading">
        <div>
          <h3>Telegram</h3>
          <p className="ai-small">
            Customers start a conversation with your bot. Review replies and
            take over in your inbox.
          </p>
        </div>
        <span className="ai-badge">
          {connection?.enabled
            ? "Active"
            : connection
              ? "Paused"
              : "Not connected"}
        </span>
      </div>
      {notice && (
        <p className="ai-status" role="status">
          {notice}
        </p>
      )}
      {connection && (
        <>
          <p>{connection.displayName}</p>
          <div className="ai-actions">
            <button
              className="ai-button"
              disabled={busy}
              onClick={() =>
                act({
                  action: "toggle",
                  connectionId: connection.id,
                  enabled: !connection.enabled,
                })
              }
            >
              {connection.enabled ? "Pause replies" : "Activate replies"}
            </button>
            <button
              className="ai-button ai-secondary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Disconnect this bot and remove its connection history?",
                  )
                )
                  void act({
                    action: "disconnect",
                    connectionId: connection.id,
                  });
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      )}
      <details>
        <summary>{connection ? "Reconnect bot" : "Connect a bot"}</summary>
        <p>
          Create a bot with Telegram’s verified @BotFather, then paste its
          token. This uses one channel slot.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            if (
              await act({
                action: "connect",
                token: f.get("token"),
                replaceWebhook: f.get("replace") === "on",
              })
            )
              form.reset();
          }}
        >
          <label className="ai-field">
            Bot token
            <input
              type="password"
              name="token"
              required
              maxLength={150}
              autoComplete="off"
            />
          </label>
          <label className="ai-check">
            <input type="checkbox" name="replace" />
            Replace an existing bot webhook if connected elsewhere
          </label>
          <button className="ai-button" disabled={busy}>
            Connect Telegram
          </button>
        </form>
      </details>
    </section>
  );
}
