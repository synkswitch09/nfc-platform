# Instagram and Facebook connections

This integration uses **one platform-owned Meta Business app**, Facebook Login and Page access tokens for both Facebook Pages and linked professional Instagram accounts. Customers authorise your app and select an account in the portal. They do not create developer apps or enter private keys. It uses the existing Azure Container App, PostgreSQL database and worker; no new App Service or database is required.

Code deployment does **not** configure or obtain Meta approval. Do not advertise public availability until you complete the account/permission and webhook tests below. No live Meta credentials are stored in this repository.

## Platform configuration (once)

Set these in the existing Azure application's secrets/environment configuration, then deploy the new image and its migration through the existing production workflow:

| Variable | Value |
| --- | --- |
| `AI_ASSISTANTS_META_ENABLED` | `true`, only when ready for testing/operation |
| `AI_ASSISTANTS_META_APP_ID` | Business app ID from Meta |
| `AI_ASSISTANTS_META_APP_SECRET` | App secret, stored as an Azure secret reference |
| `AI_ASSISTANTS_META_VERIFY_TOKEN` | Your own random secret, at least 32 characters; same value in Meta webhook setup |
| `AI_ASSISTANTS_META_TOKEN_KEY` | Separate random encryption secret, at least 32 characters; retain securely across deployments |
| `AI_ASSISTANTS_META_GRAPH_VERSION` | `v26.0` (explicitly pinned; update after compatibility testing) |
| `AI_ASSISTANTS_META_LOGIN_CONFIG_ID` | Optional Facebook Login for Business configuration ID; configure its permissions/assets to match this integration. Use a **User Access Token** configuration, not a system-user token. |

The existing `AI_ASSISTANTS_ORIGIN` remains the only canonical portal origin. All callback and guide URLs derive from it, so a future domain change does not require application code changes. Update Meta's allowed URLs and reconnect after changing it. Provider credentials are not customer-editable and are never sent to client components.

Changing `AI_ASSISTANTS_META_TOKEN_KEY` invalidates saved connections and pending selections; reconnect them. Keep a secure backup of this secret. It is deliberately independent from store session keys.

### Meta dashboard

1. Create/configure the platform Business app with Facebook Login for Business, Messenger and the **Instagram API with Facebook Login** setup. This implementation does not use Instagram Login tokens or the Unified Login system-user flow. Do not mix their endpoints or permissions.
2. Add the exact valid OAuth redirect URI:
   `https://admin.tapkin.com.au/api/assistants/meta/callback`
3. Configure the webhook callback for both **Page** and **Instagram** objects:
   `https://admin.tapkin.com.au/api/assistants/meta/webhook`
   Use `AI_ASSISTANTS_META_VERIFY_TOKEN` in the Verify Token field.
4. On the Page object, subscribe to `messages`, `message_echoes`, and `feed` if offering Facebook comment replies. On the Instagram object, subscribe to `messages` and `comments` as required by your use case. Enable values in notifications. Instagram fields must be selected in the dashboard; the Page `/subscribed_apps` call does not select Instagram fields. Account subscription happens after the customer chooses an account.
5. Set the deauthorisation callback:
   `https://admin.tapkin.com.au/api/assistants/meta/deauthorize`
   Set the data-deletion callback:
   `https://admin.tapkin.com.au/api/assistants/meta/data-deletion`
   Both validate Meta's signed request. Deletion returns a confirmation code and status URL. These remove only Meta-derived connections/conversations/events, not orders, website chat, business knowledge, global users or Stripe billing. An ordinary portal Disconnect removes credentials and stops replies but preserves conversation history for the owner.
6. Configure the application privacy policy/terms to the portal `/privacy` and `/terms`, complete the business details and requirements shown by Meta, and request the permissions below. Development mode/Standard Access restricts who can connect and who can receive replies; use assigned app roles for initial testing. Public customers require the appropriate **Advanced Access, App Review, business verification and Live mode**. The application cannot grant these itself.

### Requested permissions

Common: `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`.

- Facebook private messages: `pages_messaging`.
- Facebook comments (only if customer opts in during connection): `pages_manage_engagement`, `pages_read_user_content`.
- Instagram private messages: `instagram_basic`, `instagram_manage_messages`.
- Instagram comments (only if opted in): `instagram_manage_comments`.

Request/review only capabilities you intend to enable. Review the current permission requirements in your app dashboard. A declined permission fails connection with a reconnect instruction. Enabling comment replies later requires reconnecting with comment access first. The server checks actual granted permissions rather than trusting a checkbox or a supplied account ID.

## Customer steps

1. Add/import business information, test it, and publish it.
2. Open **Connections → Connect Instagram** or **Connect Facebook Messenger**. Include comment access if needed.
3. Sign in on Meta and approve access to the desired assets. Back in the portal, select the authorised account to link to this business.
4. Instagram must be a Business/Creator account linked to a Facebook Page the user manages. Enable **Allow access to messages** under Instagram's Message controls → Connected tools.
5. Review the selected account. Automatic messages/comments are both **off by default**. Enable the desired switches and save reply preferences.
6. Start the trial for that channel or activate the service. The trial is one channel; paid plans enforce their channel allowance; internal exempt businesses allow WEB + Instagram + Facebook + WhatsApp + WhatsApp. Disable website chat before adding a social channel on a one-channel plan. Authorisation alone never starts billing or the trial.

## Delivery and operation

- Only signed notifications matching a connected provider/account are accepted. Message identity and account ownership stay scoped to that connection/workspace. OAuth states are opaque, hashed, single-use, session/user/business-bound and expire after 20 minutes. Pending candidate tokens are encrypted with contextual authenticated encryption.
- Text DMs and top-level text comments are supported. Attachments/unsupported messages go to human review. Own messages, deleted messages, test echoes and unrelated feed changes do not generate AI replies. A business reply made in Meta pauses AI for that DM conversation when its echo is delivered; a portal takeover blocks a reply generated concurrently.
- Each notification is stored before the webhook acknowledges it. Next.js `after()` processes a bounded batch after the HTTP response; the existing authenticated worker calls `/api/assistants/meta/process` for crash/backlog recovery. Run the existing worker continuously (`--watch`, five-minute cycles) for recovery; normal webhook replies run immediately. A large backlog needs more frequent authenticated worker cycles or an increased tested batch capacity; this is a small-business first release, not an unbounded throughput service.
- DMs use a strict 24-hour customer-message window. No promotional/outbound campaigns, comment-to-DM invitations or HUMAN_AGENT-window bypass are implemented. Public comments receive public replies and never request order or payment details. Complaints, refunds and explicit human requests are held for review. Model requests use the selected business's **published** prompt and knowledge and the existing quota reservation.
- Generation happens outside DB locks. Before sending, the server rechecks subscription/trial/channel, account status, reply switches and human takeover under row locks. A durable SENDING fence prevents automatic retries after uncertain delivery. A timeout/crash after a possible send is marked **UNCERTAIN**; the owner must check Meta before composing another reply. Explicit Graph rejection is FAILED. Failed attempts that may have used the model retain their usage reservation.
- Review **Connections → Replies that need your attention** and **Conversations**. Manual replies from the portal are sent through Meta and pause AI. Existing store/website chat remains separate. Expired/revoked Meta access switches the account to Reconnect needed.
- No hourly full-site import, voice, bookings, images/audio interpretation or historical inbox import is included in this integration.

## Production acceptance checks (requires your Meta account)

After GitHub checks and the controlled database migration succeed:

1. Enable the platform credentials, confirm HTTPS on the canonical origin, and verify both webhook objects in Meta.
2. With an app-role test user, connect a Page and linked Instagram account to the correct businesses. Confirm names are shown, credentials are absent from browser/network props, and replaying a callback fails.
3. Publish known FAQs, enable private replies, and send a new text DM from an eligible test account. Confirm one reply and the correct business knowledge in the portal and Meta. Repeat the same webhook to verify no second response.
4. Verify disabled comments produce no response; grant/enable comments and test a new top-level comment on owned public media/a Page post. Reply from Meta and confirm your own comment does not create a loop.
5. Test a human takeover during answer generation, a photo, a complaint/refund question, a closed 24-hour window, expired service, channel/quota exhaustion and disconnection.
6. Revoke app permissions in Meta, reconnect, and test signed deauthorisation/deletion callbacks against a disposable assistant. Verify store users, orders and unrelated business knowledge remain untouched.
7. Complete Meta review/Advanced Access and then repeat with a user who has no app role before selling public access. Do not infer public availability from an administrator-only test.

## Primary references (checked 1 November 2026)

- [Instagram Messaging with Facebook Login: get started](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/get-started)
- [Send a message: Page ID and 1,000-character Instagram limit](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/send-message)
- [Instagram webhook setup, signatures and per-account subscription](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup)
- [Instagram webhook notification examples](https://developers.facebook.com/documentation/instagram-platform/webhooks/examples)
- [Page subscribed apps](https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/)
- [Page feed payload reference](https://developers.facebook.com/docs/graph-api/webhooks/reference/page/)
- [Meta's Messenger API collection: permissions and messaging window](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api)

WhatsApp Cloud API and explicit per-channel Activate/Pause buttons are covered in [WhatsApp setup](assistant-whatsapp.md). New connections start paused; existing IG/FB settings are preserved by the migration.
