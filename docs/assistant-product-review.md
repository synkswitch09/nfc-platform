# Assistant workspace and product direction

Reviewed 5 November 2026. Reference: **mychatbot.app**, using its public interface walkthrough and documentation, not a signed-in competitor account. Public claims are not independently tested capabilities.

## Implemented workspace

The workspace follows **answer, manage, grow**. Overview, Inbox, Your assistant, Channels, Plan & usage and Help & support provide a clear next action; administration remains restricted to administrators.

- Overview: four-step setup, genuine configured-channel counts, response allowance, recent-conversation count and attention queue. OAuth authorisation never implies verified message delivery.
- Inbox: two panes, message search, channel/attention filters, timestamps, delivery feedback and human takeover. Failed sends retain draft text. Retries of unchanged text reuse the same request identifier. Existing server permissions and delivery guards remain authoritative.
- Knowledge: separate information and website forms preserve the other area's saved settings. Hidden sections remain mounted so navigation retains in-progress fields. Save draft, Save & publish and private saved-draft testing have explicit meanings.
- Channels: account, automation options and pause state are separate. Progressive connection management, visible provider errors, test instructions, optional comments and inline disconnect confirmation reduce clutter. Website installation code can be copied.
- Responsive desktop/mobile layout using the existing API, authentication, database and plan controls. No new migrations, provider secrets, campaigns or infrastructure are introduced.

Inbox search/counts cover the latest **30 conversations**, with the latest **30 messages** each. Refresh is explicit; this release does not claim real-time updates, full-history search, customer profiles, assignment or social analytics.

## What to adapt from MyChatBot

| Publicly documented pattern | Adaptation | Priority |
| --- | --- | --- |
| Guided setup and channel health | Checklist and next action; separate connection, automation and delivery | UI now; persisted delivery health next |
| Chats, client records and human handoff | Searchable inbox and review queue; later tags and assignments | Inbox now; lightweight CRM next |
| Shared knowledge and catalogue | Reuse approved business facts; later scoped catalogue tools | High |
| Posting and analytics | Content drafts, review, calendar and measured results | After messaging stability |
| Telegram bot channel | One customer-owned bot per business in the same inbox | Recommended next channel |
| Team roles, integrations and automations | Add for demonstrated business workflows | Later |

Sources: [public walkthrough](https://mychatbot.app/), [channels and health](https://docs.mychatbot.app/channels), [posting and analytics](https://mychatbot.app/mcp/publishing). The posting page leaves some formats, metrics and tool schemas unspecified: landing-page claims alone do not establish parity.

## Content Studio feasibility

### Brand brief and drafts

Use approved business facts, target audience, location, tone, products, objectives, footage and examples. Produce editable concepts, hooks, shot lists/storyboards, captions, CTAs and optional hashtags for posts, carousels, reels and stories. Claude can draft and evaluate text; completed image/video generation needs a separate provider, asset pipeline and metered budget.

Differentiate by turning recurring inbox questions into content suggestions: a shipping FAQ becomes a delivery explainer, or a product-use question becomes a carousel brief. Use aggregated topics and approved facts, not names, private messages or order details.

Niche research must retain sources and collection dates. Distinguish owner-provided examples, accessible public web research and authorised account insights. Instagram connection does not grant unrestricted access to competitor feeds, global trends, all reels or music libraries. Do not label a theme as currently trending without evidence.

Workflow: **Brief → Ideas → Draft → Review → Approved → Scheduled → Published / Failed**. Keep content records per business, separate from customer-service conversations and instructions.

### Calendar and publication

The official Instagram API supports professional-account content publishing, with account- and format-specific eligibility for images, carousels, reels and stories. Check requirements before exposing each format. Under the existing Facebook Login path, publishing needs permissions such as `instagram_content_publish`; messaging permission alone is insufficient. Facebook publication targets managed Pages through a separate Pages publishing capability and its required permissions, including `pages_manage_posts` where applicable. Personal-profile posting is outside this proposal.

A publishing worker needs per-post attempts, UTC scheduling plus a business IANA timezone, cancellation before send, media processing checks and an uncertain-delivery state. Reconcile ambiguous provider results before retrying to avoid duplicate posts. Meta must be able to retrieve the media. Request publication capability separately from messaging, and present exact account, media, caption and time before approval.

Source: [Instagram publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing), retrieved 5 November 2026. Exact endpoint specifications, scopes and limits must be checked at implementation. The Facebook publishing path is a dependency to validate, not a working integration introduced by this PR.

### Insights and posting times

Import available media/account insights and compare content type, objective, audience location and posting time. The current Instagram Facebook Login path needs `instagram_manage_insights` plus applicable basic/Page permissions. Missing metrics must be **unavailable**, not zero. Some metrics are unavailable below 100 followers; account data has retention limits.

Start with **suggested test windows**, showing timezone, sample size and confidence. Once comparable posts accumulate, rank windows using actual reach, engagement or attributable enquiries. Avoid universal best-time or growth guarantees: timing alone does not establish causation. Kosykin can default to Australia/Adelaide; paying businesses choose their own timezone and market. Facebook Page analytics requires its own authorised path; Instagram insights cannot report Page performance.

Source: [Instagram insights](https://developers.facebook.com/documentation/instagram-platform/insights), retrieved 5 November 2026.

## Telegram: recommended next channel

Start with the official **Bot API**, not a personal-account session or group automation. The owner creates a BotFather bot, supplies its token through an encrypted form, and ownership is verified with `getMe`. Register a per-connection HTTPS webhook with `secret_token`; verify `X-Telegram-Bot-Api-Secret-Token` on receipt. Deduplicate `update_id` and resolve the correct business server-side. Never put bot credentials in client props, URLs, logs or support chats. Detect an existing webhook and explain the switch before replacing another integration.

Reuse approved knowledge, usage reservations, channel/plan limits, human takeover, durable delivery records and pause/disconnect fences. Customers open the bot and start the conversation. Telegram needs its own rate-limit/delivery rules rather than Meta's 24-hour constraint. Use `getWebhookInfo` for diagnostics. A bot conversation does not become a business's existing personal Telegram inbox.

Sources: [Telegram bots](https://core.telegram.org/bots), [Bot API](https://core.telegram.org/bots/api), [bot features](https://core.telegram.org/bots/features).

## Product sequence and differentiation

1. Finish Meta publication/review and real-message verification, then last inbound/reply timestamps, expired-access alerts and visible delivery health.
2. Add tags, full-history search, assignment, handoff notifications and an audit trail. Catalogue tools must respect business boundaries; no invented stock or order actions.
3. Add Telegram bots to the same inbox and allowance system.
4. Introduce brand briefs, source-backed content ideas and a draft calendar, followed by reviewed publishing and account-specific analytics.
5. Add selective product-feed, commerce and calendar integrations when actual customers need them. Booking and order changes only become available after real tools exist. Follow-ups require opt-in and provider-specific rules.

Position the product as a clear, dependable workspace linking **customer questions → helpful answers → useful content ideas**. Keep service responses and media generation on separate allowances; do not subsidise unbounded video through the reply quota. Validate costs and packaging before publishing prices.

Later acceptance criteria: two-business isolation, webhook replay protection, invalid secrets, existing-webhook handling, quotas, pause/disconnect races, uncertain sends; publishing approval, DST scheduling, missing permissions, cancellation and duplicate prevention; insights missing-vs-zero, source/date labels and honest sample sizes. Never add active controls for unimplemented capabilities.
