# WhatsApp Business Platform setup

WhatsApp uses the existing platform Meta app, portal, PostgreSQL database, Claude adapter, quota and worker. Each business authorises its own assets, selects its business number and controls WhatsApp independently of Instagram, Facebook and website chat.

## Scope

This release supports **dedicated Cloud API numbers** and customer-initiated 1:1 text messages. The assistant uses the selected business's published information and replies only within the 24-hour customer-service window. It is not a general-purpose WhatsApp AI service. Owners can reply manually, pause automation, take over a conversation or disconnect the channel. Attachments and unsupported messages need a person. Public comments do not exist on this channel.

**WhatsApp Business app coexistence is not implemented.** That onboarding path requires additional contact/history synchronization and lifecycle handling. The server explicitly rejects numbers marked `is_on_biz_app`; it never registers/deregisters an existing app number to force it into Cloud API. Do not instruct customers to delete their WhatsApp account or chat history. Marketing campaigns/templates, group messaging, calling and historical inbox imports are outside this release.

No Meta credentials or live WhatsApp numbers have been connected/tested by the code change. Complete the live checks below before offering it publicly.

## Configure the platform once

1. Complete the platform Meta configuration in [assistant-meta.md](assistant-meta.md), using the **same Meta app ID/secret**.
2. Add WhatsApp to the app and complete the Tech Provider onboarding and access requirements shown in the Meta dashboard. For customer-owned business accounts, obtain the required Advanced Access/App Review and business/access verification. Developer roles/test assets do not establish availability for public customers.
3. Under Facebook Login for Business, create a **v4 Embedded Signup** configuration with **Cloud API** as the product. Use the current template/configuration for customer-scoped business tokens. Do not reuse the ordinary Facebook/Instagram user-token configuration. Do not select coexistence or additional ad/catalog/calling products for this release.
4. Enable the JavaScript SDK login, HTTPS, strict OAuth redirect matching and embedded browser OAuth settings required by Meta. Add the canonical portal origin (`https://admin.tapkin.com.au`) to the allowed domains/JavaScript SDK domains and add both the origin and the actual signup page (`https://admin.tapkin.com.au/account`, and `/ai-assistants` for platform-administrator setup) to the valid OAuth redirect URIs as required by the Meta dashboard. Avoid wildcards. Update these entries if `AI_ASSISTANTS_ORIGIN` changes.
5. Configure the WhatsApp Business Account / Messaging account webhook object to use:
   `https://admin.tapkin.com.au/api/assistants/meta/webhook`
   Use the existing `AI_ASSISTANTS_META_VERIFY_TOKEN`. Subscribe to **messages** and **account_update**. The latter is required by Embedded Signup and handles app removal/offboarding. Subscribe to `smb_message_echoes` only if applicable to your assets; no coexistence signup is offered here.
6. Request `whatsapp_business_management` and `whatsapp_business_messaging`. The server verifies the token's application ID, validity, expiration and actual scopes before discovering account phone numbers. Browser-supplied asset IDs are treated only as hints and must pass server-side token access checks.
7. Set these on the existing Azure Container App (no new service):

| Variable | Value |
| --- | --- |
| `AI_ASSISTANTS_WHATSAPP_CONFIG_ID` | The v4 Embedded Signup configuration ID |
| `AI_ASSISTANTS_WHATSAPP_ENABLED` | `true` after configuration is ready for controlled testing |

The shared `AI_ASSISTANTS_META_ENABLED`, app credentials, encryption secret and pinned Graph API version must also be configured. `v26.0` is the current pin. This flow uses a **business token** exchanged directly from the SDK's code; it does not apply Facebook's user-token long-lived exchange.

## Customer experience

1. Prepare/publish the business information and open **Connections**.
2. Choose **Connect WhatsApp**, then **Continue with Meta**. The second button opens the popup directly from a click; preparing the SDK/server flow first avoids popup blocking. Meta's SDK loads only after this explicit connection action, with automatic app-event logging disabled. It is permitted only by the assistant-host CSP; storefront policies remain unchanged.
3. Sign in, approve the WhatsApp assets, verify/select the dedicated business number and finish Meta's flow. The exchangeable code expires after 30 seconds, so the portal immediately exchanges it on the server. It is never logged.
4. Select the authorised number in the portal. If Meta says it is not registered, provide a six-digit two-step verification PIN. It is transmitted server-to-server for registration and is **not stored** in the assistant database. Keep it safe for future WhatsApp number management.
5. Choose/save automatic message replies and select **Activate channel**. New social connections start paused. **Pause channel** stops that channel's AI replies and pending automatic sends while retaining preferences and history; manual replies remain possible within the allowed service window. **Disconnect** removes its credential. It does not deregister the WhatsApp number. Reconnect to restore service.
6. Add a payment method in Meta's WhatsApp Manager if required. Meta billing is separate from Stripe assistant billing. A fee exemption for Tapkin/Kosykin waives this platform's fees, not provider charges.
7. Start the trial for WhatsApp or activate the subscription. The trial remains one channel. Pausing does not free a connected channel slot; disconnect to free it. Internal fee-exempt businesses allow **four** channels: website, Instagram, Facebook and WhatsApp. Paid plan prices/allowances are unchanged.

## Delivery safeguards

- A WhatsApp connection stores its phone-number ID separately from its Messaging account ID. Signed incoming notifications must match **both** IDs before they enter the business's inbox.
- Incoming message IDs and status notifications are deduplicated. Media/unsupported messages are held for human review. Business-app echoes are recognized as human replies rather than new customer messages and do not extend the customer service window.
- Delivery callbacks update sent/delivered/read/failed state without calling the AI or opening a new conversation. A delayed “sent” callback cannot downgrade a “read” state. Failed WhatsApp delivery is shown in the inbox/attention list. External send uncertainty retains the shared no-automatic-retry fence.
- A signed account-removal/offboarding event immediately pauses affected WhatsApp connections. App uninstall/account deletion subsequently removes only that connection and its Meta-derived history. Other channels/businesses, published FAQs, global logins, orders and billing remain untouched. Older lifecycle events do not remove a reconnected account.
- Business tokens may expire. The persisted expiry blocks replies/activation after expiration; reconnect to renew access. Credentials are encrypted with the shared dedicated token key and never appear in client props.
- The same authenticated recovery worker processes WhatsApp and other Meta events. Normal processing runs immediately after webhook acknowledgement.

## Live acceptance checks

After the controlled database migration and application deployment:

1. Verify the WhatsApp webhook in Meta and test both message and account-update notifications.
2. Complete signup with an eligible account. Confirm only authorised phone numbers appear, new connections start paused, and registration/PIN is requested only when needed.
3. Complete Meta payment setup and activate WhatsApp. Send a customer text from another phone and verify one answer using the correct business knowledge. Observe delivery/read callbacks in the portal.
4. Pause WhatsApp and confirm Instagram/Messenger settings continue unchanged. Resume; test human takeover, expired tokens, expired 24-hour window, media and duplicate notifications.
5. Disconnect one number and confirm another number sharing the Messaging account remains subscribed. Remove the app through Meta on a disposable business and verify only its WhatsApp data is affected.
6. Test with a non-app-role customer only after the required Meta approvals. Review the current Meta WhatsApp Business terms, permitted customer-service use and pricing before public launch. No fixed Meta price is assumed or included by this implementation.

## Primary references (checked 1 November 2026)

- [Embedded Signup overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)
- [Current implementation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/)
- [Version 4](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4/)
- [Tech Provider post-signup steps](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider/)
- [Business phone status and registration](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers)
- [Message/status notifications](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages)
- [Account lifecycle notifications](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/account_update)
- [Business-app coexistence requirements](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [Token debugger](https://developers.facebook.com/docs/graph-api/reference/debug_token/)
