"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Sparkles, Check, RefreshCw } from "lucide-react";
type Kind = "CONTACT" | "CAMPAIGN" | "CONTENT" | "TASK";
type Resource = {
  id: string;
  kind: string;
  title: string;
  status: string;
  version: number;
  data: Record<string, unknown>;
};
const labels = {
  CONTACT: "Clients",
  CAMPAIGN: "Campaigns",
  CONTENT: "Content studio",
  TASK: "Tasks",
};
function dirty(value: boolean) {
  window.dispatchEvent(new CustomEvent("assistant-dirty", { detail: value }));
}
function dateValue(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function AssistantGrowth({
  workspaceId,
  kind,
  language,
  country,
  timeZone,
}: {
  workspaceId: string;
  kind: Kind;
  language: string;
  country: string;
  timeZone: string;
}) {
  const [records, setRecords] = useState<Resource[]>([]),
    [contacts, setContacts] = useState<Resource[]>([]),
    [selected, setSelected] = useState<Resource | null>(null),
    [editing, setEditing] = useState(false),
    [changed, setChanged] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [failed, setFailed] = useState(false),
    [query, setQuery] = useState(""),
    [answer, setAnswer] = useState(""),
    [sources, setSources] = useState<{ url: string; title: string }[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [jobs, setJobs] = useState<Resource[]>([]),
    [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const base = `/api/assistants/workspaces/${workspaceId}`,
    endpoint = `${base}/growth`;
  const refresh = useCallback(async () => {
    const response = await fetch(`${endpoint}?kind=${kind}`, {
        cache: "no-store",
      }),
      result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setRecords(result.resources);
    setCursor(result.nextCursor);
    if (kind === "CAMPAIGN" || kind === "TASK") {
      const c = await fetch(`${endpoint}?kind=CONTACT`, { cache: "no-store" }),
        data = await c.json();
      if (c.ok) setContacts(data.resources);
    }
    if (kind === "CONTENT") {
      const r = await fetch(`${base}/content`, { cache: "no-store" }),
        data = await r.json();
      if (r.ok) setJobs(data.jobs);
    }
    if (kind === "CAMPAIGN") {
      const r = await fetch(`${base}/voice`, { cache: "no-store" }),
        data = await r.json();
      if (r.ok) setVoices(data.voices);
    }
  }, [endpoint, base, kind]);
  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((e) => {
        setFailed(true);
        setNotice(e.message);
      })
      .finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (changed) e.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [changed]);
  const clean = () => {
    setChanged(false);
    dirty(false);
  };
  async function act(
    action: string,
    data: Record<string, unknown>,
    target = endpoint,
  ) {
    setBusy(true);
    setNotice("");
    setFailed(false);
    try {
      const response = await fetch(target, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...data }),
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      if (result.text) {
        setAnswer(result.text);
        setSources(result.sources || []);
      } else {
        clean();
        await refresh();
        setSelected(result.resource || null);
        setEditing(false);
        setNotice(
          action === "approve"
            ? "Version approved. Sending and publishing require a separate action."
            : "Saved. Review the updated status.",
        );
      }
      return true;
    } catch (e) {
      setFailed(true);
      setNotice(
        e instanceof Error ? e.message : "Could not complete this action.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function choose(record: Resource | null, edit = false) {
    if (changed && !window.confirm("Discard unsaved changes?")) return;
    clean();
    setSelected(record);
    setEditing(edit);
    setAnswer("");
    setSources([]);
  }
  const initial = selected?.data || {},
    value = (name: string, fallback: unknown = "") => initial[name] ?? fallback,
    consent = (initial.consent || {}) as Record<string, unknown>;
  function input(
    name: string,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      fallback?: unknown;
      max?: number;
    } = {},
  ) {
    return (
      <label className="ai-field" key={name}>
        {label}
        <input
          name={name}
          type={options.type || "text"}
          required={options.required}
          maxLength={options.max || 2000}
          defaultValue={
            options.type === "datetime-local"
              ? dateValue(value(name))
              : String(value(name, options.fallback || ""))
          }
        />
      </label>
    );
  }
  function area(name: string, label: string, max = 12000) {
    return (
      <label className="ai-field" key={name}>
        {label}
        <textarea
          name={name}
          rows={name === "instructions" ? 5 : 3}
          maxLength={max}
          defaultValue={String(value(name))}
        />
      </label>
    );
  }
  function select(
    name: string,
    label: string,
    options: [string, string][],
    fallback: string,
  ) {
    return (
      <label className="ai-field">
        {label}
        <select name={name} defaultValue={String(value(name, fallback))}>
          {options.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const list = records.filter((r) =>
    `${r.title} ${r.status} ${r.data.stage || ""}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <section className="ai-growth" aria-label={labels[kind]}>
      <div className="ai-section-heading">
        <div>
          <p className="ai-eyebrow">
            {kind === "CONTACT"
              ? "A next step for every lead"
              : kind === "CAMPAIGN"
                ? "Prepare · rehearse · approve"
                : kind === "CONTENT"
                  ? "Ideas into a publishing plan"
                  : "Keep promises to customers"}
          </p>
          <h3>{labels[kind]}</h3>
          <p className="ai-small">
            {kind === "CONTACT"
              ? "Keep needs, permission, progress and follow-ups in one place."
              : kind === "CAMPAIGN"
                ? "Teach your assistant what to offer, how to respond and when to involve a person."
                : kind === "CONTENT"
                  ? "Use Claude for research, captions and scripts. Supply your approved images and videos."
                  : "Track the next action. Tasks are internal reminders; they do not contact anyone automatically."}
          </p>
        </div>
        <button
          className="ai-button"
          disabled={busy}
          onClick={() => choose(null, true)}
        >
          <Plus size={16} />
          New{" "}
          {kind === "CONTACT" ? "client" : kind === "TASK" ? "task" : "draft"}
        </button>
      </div>
      {notice && (
        <p
          className={`ai-status ${failed ? "ai-error-status" : ""}`}
          role={failed ? "alert" : "status"}
        >
          {notice}
        </p>
      )}
      {kind === "CONTACT" && (
        <div className="ai-growth-metrics">
          {[
            ["NEW", "New"],
            ["QUALIFIED", "Interested"],
            ["FOLLOW_UP", "Follow-up"],
            ["WON", "Confirmed sales"],
          ].map(([stage, label]) => (
            <div className="ai-card" key={stage}>
              <strong>
                {records.filter((r) => r.data.stage === stage).length}
              </strong>
              <span>{label} in loaded clients</span>
            </div>
          ))}
        </div>
      )}
      <div className="ai-growth-grid">
        <aside className="ai-card">
          <label className="ai-field">
            Search loaded {labels[kind].toLowerCase()}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="ai-text-button"
            disabled={busy || loading}
            onClick={() =>
              refresh().catch((e) => {
                setFailed(true);
                setNotice(e.message);
              })
            }
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          {loading && <p role="status">Loading…</p>}
          <div className="ai-growth-list">
            {list.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                aria-pressed={selected?.id === r.id}
                onClick={() => choose(r)}
              >
                <strong>{r.title}</strong>
                <span>
                  {kind === "CONTACT"
                    ? String(r.data.stage).replaceAll("_", " ")
                    : kind === "TASK"
                      ? r.data.done
                        ? "Completed"
                        : r.data.dueAt &&
                            Date.parse(String(r.data.dueAt)) < Date.now()
                          ? "Overdue"
                          : "To do"
                      : r.status.replaceAll("_", " ")}
                </span>
                {Boolean(
                  r.data.scheduledAt || r.data.dueAt || r.data.nextActionAt,
                ) && (
                  <small>
                    {new Date(
                      String(
                        r.data.scheduledAt ||
                          r.data.dueAt ||
                          r.data.nextActionAt,
                      ),
                    ).toLocaleString()}
                  </small>
                )}
              </button>
            ))}
          </div>
          {!loading && !list.length && (
            <div className="ai-growth-empty">
              <h4>Start with one clear goal.</h4>
              <p>
                {query
                  ? "No matching records."
                  : "Create your first record. You can save a draft and return later."}
              </p>
            </div>
          )}
          {cursor && (
            <button
              className="ai-button ai-secondary"
              onClick={async () => {
                try {
                  const r = await fetch(
                      `${endpoint}?kind=${kind}&cursor=${cursor}`,
                    ),
                    d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setRecords((old) => [...old, ...d.resources]);
                  setCursor(d.nextCursor);
                } catch (e) {
                  setNotice(String(e));
                }
              }}
            >
              Load more
            </button>
          )}
        </aside>
        <section className="ai-card">
          {editing ? (
            <form
              key={selected?.id || "new"}
              onChange={() => {
                setChanged(true);
                dirty(true);
              }}
              onSubmit={async (e) => {
                e.preventDefault();
                setFailed(false);
                try {
                  const f = new FormData(e.currentTarget),
                    get = (key: string) => String(f.get(key) || ""),
                    when = (key: string) =>
                      get(key) ? new Date(get(key)).toISOString() : null;
                  let data: Record<string, unknown>;
                  if (kind === "CONTACT")
                    data = {
                      name: get("title"),
                      email: get("email"),
                      phone: get("phone"),
                      stage: get("stage"),
                      notes: get("notes"),
                      nextAction: get("nextAction"),
                      nextActionAt: when("nextActionAt"),
                      outcomeEvidence: get("outcomeEvidence"),
                      country: get("country"),
                      language: get("language"),
                      timeZone: get("timeZone"),
                      conversationId: initial.conversationId || null,
                      optedOut: f.get("optedOut") === "on",
                      consent: {
                        channel: get("consentChannel"),
                        evidence: get("consentEvidence"),
                        at: when("consentAt"),
                        expiresAt: when("consentExpires"),
                      },
                    };
                  else if (kind === "CAMPAIGN")
                    data = {
                      objective: get("objective"),
                      audience: get("audience"),
                      offer: get("offer"),
                      instructions: get("instructions"),
                      greeting: get("greeting"),
                      questions: get("questions"),
                      objections: get("objections"),
                      boundaries: get("boundaries"),
                      preferredLanguage: get("preferredLanguage"),
                      preferredCountry: get("preferredCountry"),
                      timeZone: get("timeZone"),
                      channel: get("channel"),
                      contactIds: f.getAll("contactIds"),
                      maxCalls: Number(get("maxCalls")),
                      voiceId: get("voiceId"),
                      bookingUrl: get("bookingUrl"),
                    };
                  else if (kind === "CONTENT")
                    data = {
                      format: get("format"),
                      channel: get("channel"),
                      brief: get("brief"),
                      caption: get("caption"),
                      script: get("script"),
                      mediaUrls: get("mediaUrls")
                        .split(/\n/)
                        .map((v) => v.trim())
                        .filter(Boolean),
                      video: f.get("video") === "on",
                      scheduledAt: when("scheduledAt"),
                      timeZone: get("timeZone"),
                      sources: initial.sources || [],
                    };
                  else
                    data = {
                      description: get("description"),
                      dueAt: when("dueAt"),
                      done: f.get("done") === "on",
                      contactId: get("contactId") || null,
                    };
                  await act("save", {
                    ...(selected
                      ? { id: selected.id, version: selected.version }
                      : {}),
                    kind,
                    title: get("title"),
                    data,
                  });
                } catch (e) {
                  setFailed(true);
                  setNotice(
                    e instanceof Error ? e.message : "Check the form dates.",
                  );
                }
              }}
            >
              <label className="ai-field">
                {kind === "CONTACT" ? "Client name" : "Name"}
                <input
                  name="title"
                  required
                  maxLength={120}
                  defaultValue={selected?.title || ""}
                />
              </label>
              {kind === "CONTACT" && (
                <>
                  <div className="ai-growth-fields">
                    {input("email", "Email", { type: "email" })}
                    {input("phone", "Phone, including country code", {
                      type: "tel",
                    })}
                  </div>
                  {select(
                    "stage",
                    "Sales progress",
                    [
                      ["NEW", "New enquiry"],
                      ["QUALIFIED", "Interested"],
                      ["FOLLOW_UP", "Follow-up"],
                      ["WON", "Sale confirmed"],
                      ["LOST", "Closed without sale"],
                    ],
                    "NEW",
                  )}
                  {area("notes", "What does this customer need?")}
                  {input("nextAction", "Next step")}
                  {input(
                    "nextActionAt",
                    "Follow up at (your browser’s local time)",
                    { type: "datetime-local" },
                  )}
                  {input(
                    "outcomeEvidence",
                    "Order reference or sale confirmation",
                  )}
                  <details>
                    <summary>Permission and contact preferences</summary>
                    <p className="ai-small">
                      A phone number or message alone is not permission for
                      marketing.
                    </p>
                    <label className="ai-field">
                      Permission for
                      <select
                        name="consentChannel"
                        defaultValue={String(consent.channel || "NONE")}
                      >
                        {["NONE", "CHAT", "VOICE", "BOTH"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ai-field">
                      Evidence of actual permission
                      <textarea
                        name="consentEvidence"
                        maxLength={2000}
                        defaultValue={String(consent.evidence || "")}
                      />
                    </label>
                    <label className="ai-field">
                      Granted at (your local time)
                      <input
                        type="datetime-local"
                        name="consentAt"
                        defaultValue={dateValue(consent.at)}
                      />
                    </label>
                    <label className="ai-field">
                      Expires at (your local time)
                      <input
                        type="datetime-local"
                        name="consentExpires"
                        defaultValue={dateValue(consent.expiresAt)}
                      />
                    </label>
                    <label className="ai-check">
                      <input
                        type="checkbox"
                        name="optedOut"
                        defaultChecked={Boolean(initial.optedOut)}
                      />
                      Do not contact
                    </label>
                  </details>
                </>
              )}
              {kind === "CAMPAIGN" && (
                <>
                  {input("objective", "What should this campaign achieve?", {
                    required: true,
                  })}
                  {input("audience", "Who is this for?")}
                  {area("offer", "Your offer and approved prices")}
                  {area(
                    "instructions",
                    "How should the assistant act? Paste your campaign training here.",
                  )}
                  {area("greeting", "Opening message", 1000)}
                  {area("questions", "Questions to ask")}
                  {area("objections", "How to answer objections")}
                  {area("boundaries", "Limits and when to involve a person")}
                  {select(
                    "channel",
                    "Channel",
                    [
                      ["CHAT", "Chat"],
                      ["VOICE", "Phone calls"],
                    ],
                    "CHAT",
                  )}
                  <fieldset>
                    <legend>Campaign clients</legend>
                    <p className="ai-small">
                      First 100 clients shown. Clients must have documented
                      permission; chat clients need a private inbox
                      conversation.
                    </p>
                    {contacts.map((c) => (
                      <label className="ai-check" key={c.id}>
                        <input
                          type="checkbox"
                          name="contactIds"
                          value={c.id}
                          defaultChecked={(
                            (initial.contactIds as string[]) || []
                          ).includes(c.id)}
                        />
                        {c.title}
                      </label>
                    ))}
                  </fieldset>
                  <details>
                    <summary>Voice and booking settings</summary>
                    <label className="ai-field">
                      Voice
                      <select
                        name="voiceId"
                        defaultValue={String(value("voiceId"))}
                      >
                        <option value="">Choose after connecting voice</option>
                        {voices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ai-field">
                      Maximum calls (0 keeps calls disabled)
                      <input
                        type="number"
                        name="maxCalls"
                        min={0}
                        max={1000}
                        defaultValue={Number(value("maxCalls", 0))}
                      />
                    </label>
                    {input(
                      "bookingUrl",
                      "Booking page (customer completes booking there)",
                      { type: "url" },
                    )}
                  </details>
                </>
              )}
              {kind === "CONTENT" && (
                <>
                  <div className="ai-growth-fields">
                    {select(
                      "format",
                      "Format",
                      [
                        ["POST", "Post"],
                        ["CAROUSEL", "Carousel"],
                        ["REEL", "Reel"],
                        ["STORY", "Story"],
                      ],
                      "POST",
                    )}
                    {select(
                      "channel",
                      "Channel",
                      [
                        ["INSTAGRAM", "Instagram"],
                        ["FACEBOOK", "Facebook"],
                      ],
                      "INSTAGRAM",
                    )}
                  </div>
                  {area("brief", "Niche, audience, country and content goal")}
                  {area("caption", "Caption and call to action")}
                  {area("script", "Video script / shot list")}
                  <label className="ai-field">
                    Public media URLs, one per line
                    <textarea
                      name="mediaUrls"
                      defaultValue={(
                        (initial.mediaUrls as string[]) || []
                      ).join("\n")}
                      placeholder="https://your-business.com/media/photo.jpg"
                    />
                  </label>
                  <label className="ai-check">
                    <input
                      type="checkbox"
                      name="video"
                      defaultChecked={Boolean(initial.video)}
                    />
                    This is a video (Reels or Instagram video Stories)
                  </label>
                  {input(
                    "scheduledAt",
                    "Planned publication (your browser’s local time)",
                    { type: "datetime-local" },
                  )}
                  <p className="ai-small">
                    Approve first, then choose Publish or Schedule. Facebook
                    Stories remain available for planning and manual export.
                  </p>
                </>
              )}
              {kind === "TASK" && (
                <>
                  {area("description", "What needs to happen?")}
                  {input("dueAt", "Due at (your browser’s local time)", {
                    type: "datetime-local",
                  })}
                  {select(
                    "contactId",
                    "Related client",
                    [
                      ["", "No client"],
                      ...contacts.map(
                        (c) => [c.id, c.title] as [string, string],
                      ),
                    ],
                    "",
                  )}
                  <label className="ai-check">
                    <input
                      type="checkbox"
                      name="done"
                      defaultChecked={Boolean(initial.done)}
                    />
                    Completed
                  </label>
                </>
              )}
              {kind !== "TASK" && (
                <div className="ai-growth-fields">
                  {kind !== "CONTENT" && (
                    <>
                      {input(
                        kind === "CAMPAIGN" ? "preferredLanguage" : "language",
                        "Preferred language",
                        { fallback: language, required: true, max: 35 },
                      )}
                      {input(
                        kind === "CAMPAIGN" ? "preferredCountry" : "country",
                        "Country code",
                        { fallback: country, required: true, max: 2 },
                      )}
                    </>
                  )}
                  {input(
                    "timeZone",
                    kind === "CONTACT"
                      ? "Customer’s time zone"
                      : "Business time zone",
                    { fallback: timeZone, required: true },
                  )}
                </div>
              )}
              <div className="ai-save-bar">
                <button className="ai-button" disabled={busy}>
                  {busy ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  className="ai-button ai-secondary"
                  disabled={busy}
                  onClick={() => choose(selected)}
                >
                  Cancel
                </button>
                <span className="ai-small">
                  {changed ? "Unsaved changes" : "Draft"}
                </span>
              </div>
            </form>
          ) : selected ? (
            <>
              <span className="ai-badge">
                {selected.status.replaceAll("_", " ")} · v{selected.version}
              </span>
              <h3>{selected.title}</h3>
              <dl className="ai-growth-details">
                {Object.entries(selected.data)
                  .filter(
                    ([k, v]) =>
                      v &&
                      ![
                        "contactIds",
                        "sources",
                        "consent",
                        "conversationId",
                      ].includes(k),
                  )
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
                      <dd>
                        {Array.isArray(v)
                          ? v.join("\n")
                          : typeof v === "object"
                            ? JSON.stringify(v)
                            : String(v)}
                      </dd>
                    </div>
                  ))}
              </dl>
              {kind === "CONTACT" && (
                <p className="ai-small">
                  Contact permission: {String(consent.channel || "NONE")} ·{" "}
                  {initial.optedOut ? "Do not contact" : "No opt-out recorded"}
                </p>
              )}
              <div className="ai-actions">
                <button
                  className="ai-button ai-secondary"
                  disabled={
                    busy || !["DRAFT", "PAUSED"].includes(selected.status)
                  }
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
                {["CAMPAIGN", "CONTENT"].includes(kind) && (
                  <>
                    <button
                      className="ai-button ai-secondary"
                      disabled={
                        busy ||
                        ![
                          "DRAFT",
                          "APPROVED",
                          "PAUSED",
                          "SCHEDULED",
                          "QUEUED",
                          "PROCESSING",
                        ].includes(selected.status)
                      }
                      onClick={() =>
                        act("pause", {
                          resourceId: selected.id,
                          version: selected.version,
                        })
                      }
                    >
                      Pause / edit
                    </button>
                    <button
                      className="ai-button"
                      disabled={
                        busy || !["DRAFT", "PAUSED"].includes(selected.status)
                      }
                      onClick={() =>
                        act("approve", {
                          resourceId: selected.id,
                          version: selected.version,
                        })
                      }
                    >
                      <Check size={15} />
                      Approve version
                    </button>
                    <button
                      className="ai-button ai-secondary"
                      disabled={busy}
                      onClick={() =>
                        act("generate", { resourceId: selected.id })
                      }
                    >
                      <Sparkles size={15} />
                      {kind === "CONTENT"
                        ? "Draft with Claude"
                        : "Review with Claude"}
                    </button>
                  </>
                )}
              </div>
              {kind === "CONTENT" && (
                <>
                  <div className="ai-actions">
                    <button
                      className="ai-button ai-secondary"
                      disabled={busy}
                      onClick={() =>
                        act("research", { resourceId: selected.id })
                      }
                    >
                      Research niche with Claude
                    </button>
                    {["publish", "schedule"].map((action) => (
                      <button
                        className="ai-button"
                        key={action}
                        disabled={busy || selected.status !== "APPROVED"}
                        onClick={() => {
                          if (
                            window.confirm(
                              action === "publish"
                                ? "Publish this approved version to the connected business account?"
                                : "Schedule this approved version for automatic publication?",
                            )
                          )
                            void act(
                              action,
                              {
                                resourceId: selected.id,
                                version: selected.version,
                                confirm: true,
                              },
                              `${base}/content`,
                            );
                        }}
                      >
                        {action === "publish"
                          ? "Publish approved content"
                          : "Schedule publication"}
                      </button>
                    ))}
                    <button
                      className="ai-button ai-secondary"
                      onClick={() => {
                        const content = `${selected.title}\n\n${String(initial.caption || "")}\n\n${String(initial.script || "")}\n\n${((initial.mediaUrls as string[]) || []).join("\n")}`;
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(
                          new Blob([content], { type: "text/plain" }),
                        );
                        link.download = "content-plan.txt";
                        link.click();
                        URL.revokeObjectURL(link.href);
                      }}
                    >
                      Export for manual publishing
                    </button>
                  </div>
                  {jobs
                    .filter((j) => j.data.contentId === selected.id)
                    .map((j) => (
                      <div className="ai-status" key={j.id}>
                        {j.status} · {String(j.data.step)}{" "}
                        {j.status === "READY" && (
                          <button
                            className="ai-text-button"
                            disabled={busy}
                            onClick={() =>
                              act(
                                "continue",
                                { jobId: j.id },
                                `${base}/content`,
                              )
                            }
                          >
                            Check / continue
                          </button>
                        )}
                        {j.status === "UNCERTAIN" && (
                          <p>
                            Review the platform account before creating another
                            publication.
                          </p>
                        )}
                      </div>
                    ))}
                </>
              )}
              {kind === "CAMPAIGN" && (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act("simulate", {
                        resourceId: selected.id,
                        message: String(
                          new FormData(e.currentTarget).get("message"),
                        ),
                      });
                    }}
                  >
                    <label className="ai-field">
                      Rehearse a customer’s message in any language
                      <textarea name="message" required maxLength={3000} />
                    </label>
                    <button className="ai-button" disabled={busy}>
                      Test privately
                    </button>
                  </form>
                  {selected.data.channel === "CHAT" &&
                    selected.status === "APPROVED" && (
                      <details>
                        <summary>Assign or send to an opted-in client</summary>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget),
                              action =
                                (e.nativeEvent as SubmitEvent)
                                  .submitter instanceof HTMLButtonElement
                                  ? (
                                      (e.nativeEvent as SubmitEvent)
                                        .submitter as HTMLButtonElement
                                    ).value
                                  : "bind";
                            void act(action, {
                              campaignId: selected.id,
                              version: selected.version,
                              contactId: f.get("contactId"),
                              ...(action === "send"
                                ? {
                                    message: f.get("outbound"),
                                    confirm: f.get("confirm") === "on",
                                  }
                                : {}),
                            });
                          }}
                        >
                          <label className="ai-field">
                            Client
                            <select name="contactId" required>
                              {contacts
                                .filter((c) =>
                                  (
                                    (selected.data.contactIds as string[]) || []
                                  ).includes(c.id),
                                )
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.title}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <p className="ai-small">
                            Assignment changes future AI replies in that
                            client's private thread. Sending also checks
                            permission, local business hours and provider
                            messaging windows. Each campaign sends at most one
                            starting message per client.
                          </p>
                          <label className="ai-field">
                            Reviewed starting message
                            <textarea
                              name="outbound"
                              maxLength={990}
                              defaultValue={String(
                                selected.data.greeting || "",
                              )}
                            />
                          </label>
                          <label className="ai-check">
                            <input name="confirm" type="checkbox" />I verified
                            permission, applicable marketing rules and this
                            message.
                          </label>
                          <div className="ai-actions">
                            <button
                              className="ai-button ai-secondary"
                              name="action"
                              value="bind"
                              disabled={busy}
                            >
                              Assign future replies
                            </button>
                            <button
                              className="ai-button"
                              name="action"
                              value="send"
                              disabled={busy}
                            >
                              Send reviewed message
                            </button>
                          </div>
                        </form>
                      </details>
                    )}
                </>
              )}
              {answer && (
                <div className="ai-preview-answer" role="status">
                  <strong>Private draft — review before use</strong>
                  <p>{answer}</p>
                  {sources.map((s, i) => (
                    <p key={`${s.url}-${i}`}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.title}
                      </a>
                    </p>
                  ))}
                  <p className="ai-small">
                    Copy the reviewed result into your draft. Generating does
                    not approve, send or publish it.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="ai-growth-empty">
              <Sparkles size={32} />
              <h3>Simple steps. Clear progress.</h3>
              <p>Select a record or create your first one.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
