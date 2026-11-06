"use client";
import { useCallback, useEffect, useState } from "react";
type Resource = {
  id: string;
  title: string;
  status: string;
  version: number;
  data: Record<string, unknown>;
  externalId?: string | null;
};
type Catalog = {
  ready: boolean;
  voices: { id: string; name: string }[];
  owned: Resource[];
  calls: Resource[];
  agents: Resource[];
  languages: string[];
  settings: Record<string, unknown> | null;
  callingEnabled: boolean;
  providerIssue: string;
};
export function AssistantVoice({
  workspaceId,
  admin,
}: {
  workspaceId: string;
  admin: boolean;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [campaigns, setCampaigns] = useState<Resource[]>([]),
    [contacts, setContacts] = useState<Resource[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const endpoint = `/api/assistants/workspaces/${workspaceId}/voice`;
  const refresh = useCallback(async () => {
    const responses = await Promise.all([
      fetch(endpoint, { cache: "no-store" }),
      fetch(`/api/assistants/workspaces/${workspaceId}/growth?kind=CAMPAIGN`, {
        cache: "no-store",
      }),
      fetch(`/api/assistants/workspaces/${workspaceId}/growth?kind=CONTACT`, {
        cache: "no-store",
      }),
    ]);
    const [voice, campaign, contact] = await Promise.all(
      responses.map((r) => r.json()),
    );
    if (!responses[0].ok) throw new Error(voice.error);
    setCatalog(voice);
    if (responses[1].ok)
      setCampaigns(
        campaign.resources.filter(
          (r: Resource) =>
            r.status === "APPROVED" && r.data.channel === "VOICE",
        ),
      );
    if (responses[2].ok) setContacts(contact.resources);
  }, [endpoint, workspaceId]);
  useEffect(() => {
    void refresh().catch((e) => setNotice(e.message));
  }, [refresh]);
  async function act(body: Record<string, unknown> | FormData) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(endpoint, {
          method: "POST",
          ...(body instanceof FormData
            ? { body }
            : {
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      setNotice(result.message || "Saved. Review the updated status below.");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  const settings = catalog?.settings || {};
  return (
    <section aria-label="Voice and calls">
      <div className="ai-section-heading">
        <div>
          <p className="ai-eyebrow">Your business, heard clearly</p>
          <h3>Voice & calls</h3>
          <p className="ai-small">
            Claude handles conversation. ElevenLabs handles speech. Your
            connected telephone line places the call.
          </p>
        </div>
        <button
          className="ai-button ai-secondary"
          disabled={busy}
          onClick={() => refresh().catch((e) => setNotice(e.message))}
        >
          Refresh
        </button>
      </div>
      {notice && (
        <p role="status" className="ai-status">
          {notice}
        </p>
      )}
      {!catalog?.ready && (
        <p className="ai-status ai-warning-status">
          Voice setup is pending. No calls can start until your administrator
          connects the providers.
        </p>
      )}
      {catalog?.providerIssue && (
        <p className="ai-status">{catalog.providerIssue}</p>
      )}
      <div className="ai-growth-grid">
        <div>
          <section className="ai-card">
            <h3>Choose a voice</h3>
            <p className="ai-small">
              Select any of these voices in your campaign. Speech supports{" "}
              {catalog?.languages.length || 32} languages. Test accent and
              pronunciation first; chat supports additional languages.
            </p>
            <div className="ai-growth-fields">
              {catalog?.voices.map((v) => (
                <div className="ai-voice-option" key={v.id}>
                  <strong>{v.name}</strong>
                  <small>{v.id}</small>
                </div>
              ))}
            </div>
            {catalog?.ready && !catalog.voices.length && (
              <p>No available voices. Check provider access.</p>
            )}
          </section>
          <section className="ai-card">
            <h3>Create an authorized voice</h3>
            <p className="ai-small">
              Use your own voice or a speaker who explicitly authorized
              synthetic calls for this business. Samples go to ElevenLabs.
              Tapkin stores authorization evidence and sample hashes, not sample
              recordings. Provider charges may apply.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(new FormData(e.currentTarget));
              }}
            >
              <label className="ai-field">
                Voice name
                <input name="name" required minLength={2} maxLength={80} />
              </label>
              <label className="ai-field">
                1–3 recordings, up to 10 MB total
                <input
                  name="samples"
                  type="file"
                  multiple
                  required
                  accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,audio/webm"
                />
              </label>
              <label className="ai-field">
                Speaker authorization and evidence reference
                <textarea
                  name="evidence"
                  required
                  minLength={20}
                  maxLength={2000}
                  placeholder="Speaker, authorization date, permitted business and uses, and reference to the recorded authorization."
                />
              </label>
              <label className="ai-check">
                <input name="authorization" type="checkbox" required />I have
                explicit permission to create this synthetic voice and send
                these recordings to ElevenLabs.
              </label>
              <button className="ai-button" disabled={busy || !catalog?.ready}>
                {busy ? "Working…" : "Create voice for review"}
              </button>
            </form>
            {catalog?.owned.map((v) => (
              <details key={v.id}>
                <summary>
                  {v.title} · {v.status.replaceAll("_", " ")}
                </summary>
                <p>{String(v.data.authorizationEvidence || "")}</p>
                {v.externalId && v.status !== "DELETED" && (
                  <button
                    className="ai-button ai-secondary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Revoke this voice and delete it at the provider?",
                        )
                      )
                        void act({
                          action: "deleteVoice",
                          voiceRecordId: v.id,
                        });
                    }}
                  >
                    Revoke voice
                  </button>
                )}
                {admin && v.status === "REVIEW_REQUIRED" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act({
                        action: "approveVoice",
                        voiceRecordId: v.id,
                        reviewEvidence: new FormData(e.currentTarget).get(
                          "review",
                        ),
                      });
                    }}
                  >
                    <label className="ai-field">
                      Authorization review evidence
                      <input name="review" required minLength={10} />
                    </label>
                    <button className="ai-button" disabled={busy}>
                      Approve verified voice
                    </button>
                  </form>
                )}
              </details>
            ))}
          </section>
        </div>
        <div>
          <section className="ai-card">
            <h3>Prepare a campaign</h3>
            <p className="ai-small">
              Approve your voice campaign first. Preparing creates a private
              provider agent; it does not call anyone.
            </p>
            {campaigns.map((c) => (
              <div className="ai-voice-option" key={c.id}>
                <strong>
                  {c.title} · v{c.version}
                </strong>
                <button
                  className="ai-button ai-secondary"
                  disabled={busy || !catalog?.ready}
                  onClick={() =>
                    act({
                      action: "prepare",
                      campaignId: c.id,
                      version: c.version,
                    })
                  }
                >
                  Prepare voice agent
                </button>
              </div>
            ))}
            {!campaigns.length && (
              <p>Create and approve a voice campaign under Campaigns.</p>
            )}
            <details>
              <summary>Start an opted-in callback</summary>
              <p>
                Each call is capped at three minutes and reserves three minutes
                of allowance. Only documented AU/CO contacts in approved local
                hours. No automatic redials; repeated calls to a number are
                disabled in this release.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    campaign = campaigns.find(
                      (c) => c.id === f.get("campaignId"),
                    );
                  if (campaign)
                    void act({
                      action: "call",
                      campaignId: campaign.id,
                      version: campaign.version,
                      contactId: f.get("contactId"),
                      audioConsentEvidence: f.get("audioConsentEvidence"),
                      confirmPaidCall: true,
                    });
                }}
              >
                <label className="ai-field">
                  Approved campaign
                  <select name="campaignId" required>
                    <option value="">Choose campaign</option>
                    {campaigns.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ai-field">
                  Included campaign contact
                  <select name="contactId" required>
                    <option value="">Choose contact</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} · {String(c.data.phone || "No phone")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ai-field">
                  Prior permission for AI audio processing and seven-day
                  transcript retention
                  <textarea
                    name="audioConsentEvidence"
                    required
                    minLength={20}
                    maxLength={2000}
                  />
                </label>
                <label className="ai-check">
                  <input type="checkbox" required />I reviewed this recipient,
                  offer, permission and applicable restrictions. Start one
                  billable call now.
                </label>
                <button
                  className="ai-button"
                  disabled={busy || !catalog?.callingEnabled}
                >
                  Start one call
                </button>
              </form>
            </details>
          </section>
          <section className="ai-card">
            <h3>Call history</h3>
            <p className="ai-small">
              Latest 50 calls. Review every outcome. A completed call is not a
              sale. Transcripts are retained for seven days, then removed by the
              maintenance job.
            </p>
            {catalog?.calls.map((c) => (
              <details key={c.id}>
                <summary>
                  {c.title} · {c.status.replaceAll("_", " ")}
                </summary>
                <p>
                  {Number(c.data.durationSeconds || 0)} seconds ·{" "}
                  {Number(c.data.reservedMinutes || 0)} reserved minutes
                </p>
                {Array.isArray(c.data.transcript) ? (
                  (c.data.transcript as { role: string; text: string }[]).map(
                    (t, i) => (
                      <p key={i}>
                        <strong>{t.role}:</strong> {t.text}
                      </p>
                    ),
                  )
                ) : (
                  <p>
                    Transcript expired, unavailable or awaiting delivery.
                    Reconcile uncertain attempts in the provider dashboard.
                  </p>
                )}
              </details>
            ))}
            {!catalog?.calls.length && <p>No calls yet.</p>}
          </section>
          {admin && (
            <section className="ai-card">
              <details>
                <summary>Administrator activation</summary>
                <p>
                  Import a Twilio line into ElevenLabs first. Review consent,
                  DNCR/RNE applicability, caller identification, privacy,
                  product restrictions and all applicable local holidays. Use
                  provider-side spend limits as well.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void act({
                      action: "settings",
                      phoneNumberId: f.get("phoneNumberId"),
                      enabled: f.get("enabled") === "on",
                      monthlyMinuteLimit: Number(f.get("monthlyMinuteLimit")),
                      legalReviewUntil: f.get("legalReviewUntil"),
                      holidayCalendarUntil: f.get("holidayCalendarUntil"),
                      holidays: String(f.get("holidays") || "")
                        .split(/\s+/)
                        .filter(Boolean),
                      reviewEvidence: f.get("reviewEvidence"),
                    });
                  }}
                >
                  <label className="ai-field">
                    ElevenLabs phone number ID
                    <input
                      name="phoneNumberId"
                      required
                      defaultValue={String(settings.phoneNumberId || "")}
                    />
                  </label>
                  <label className="ai-field">
                    Monthly reserved-minute allowance
                    <input
                      type="number"
                      name="monthlyMinuteLimit"
                      required
                      min={0}
                      max={10000}
                      defaultValue={Number(settings.monthlyMinuteLimit || 0)}
                    />
                  </label>
                  <label className="ai-field">
                    Compliance review valid until (ISO UTC)
                    <input
                      name="legalReviewUntil"
                      required
                      defaultValue={String(settings.legalReviewUntil || "")}
                      placeholder="2026-12-01T00:00:00.000Z"
                    />
                  </label>
                  <label className="ai-field">
                    Holiday calendar covered through
                    <input
                      type="date"
                      name="holidayCalendarUntil"
                      required
                      defaultValue={String(settings.holidayCalendarUntil || "")}
                    />
                  </label>
                  <label className="ai-field">
                    All applicable holiday dates, one per line
                    <textarea
                      name="holidays"
                      defaultValue={(
                        (settings.holidays as string[]) || []
                      ).join("\n")}
                    />
                  </label>
                  <label className="ai-field">
                    Review evidence
                    <textarea
                      name="reviewEvidence"
                      required
                      minLength={10}
                      maxLength={2000}
                      defaultValue={String(settings.reviewEvidence || "")}
                    />
                  </label>
                  <label className="ai-check">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={Boolean(settings.enabled)}
                    />
                    Enable guarded outbound calls
                  </label>
                  <button
                    className="ai-button"
                    disabled={busy || !catalog?.ready}
                  >
                    Save activation
                  </button>
                </form>
              </details>
              <details>
                <summary>Provider agents and inbound setup</summary>
                {catalog?.agents.map((a) => (
                  <p key={a.id}>
                    {a.title} · {a.status} ·{" "}
                    {String(a.data.agentId || "Reconciliation needed")}
                  </p>
                ))}
                <p>
                  Inbound routing is configured in ElevenLabs/Twilio. This
                  screen's allowance covers outbound calls only. Do not enable
                  public inbound routing until provider spend limits, privacy
                  disclosure and production testing are complete.
                </p>
              </details>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
