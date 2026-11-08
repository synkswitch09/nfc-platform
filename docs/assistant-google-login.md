# Google sign-in for the assistant platform

Google login for the assistant portal is separate from the storefront callbacks. It reuses the
existing user identities, verified-email linking rules and OAuthAccount table. A verified existing
account (including the global administrator) keeps its user ID, role and workspaces when Google
returns the same verified email. Newly created users receive the normal CUSTOMER role; signing in
with Google never grants administration rights. Existing unverified accounts must verify through
their current account flow before Google linking. Inactive accounts cannot sign in.

## Configuration

By default, the portal reuses the Google client in `GOOGLE_OAUTH_STORES` for the store named in
`AI_ASSISTANTS_EMAIL_STORE` (default `tapkin`). It does not use storefront CMS Google visibility
settings, since the portal is an independent sign-in surface.

If the existing Google client already works for Tapkin, **no additional client key is required**.
In Google Cloud Console, open that client's OAuth settings and add this authorized redirect URI:

```
https://admin.tapkin.com.au/api/assistants/oauth/google/callback
```

Use the exact `AI_ASSISTANTS_ORIGIN` when the deployed portal has a different domain. Keep all
existing store callback URLs; do not replace them. The URI must match exactly, including HTTPS,
path, and absence of a trailing slash. If the Google app is in testing, the intended account must
be an allowed test user. Google consent screen/domain verification rules still apply.

For a separate portal client, configure both server variables:

- `AI_ASSISTANTS_GOOGLE_CLIENT_ID`
- `AI_ASSISTANTS_GOOGLE_CLIENT_SECRET` (secret reference; never a NEXT_PUBLIC variable)

A partially configured dedicated pair disables Google login rather than silently using the wrong
client. With no configured client, the Google button stays hidden and password login is unchanged.
With valid credentials, **Continue with Google** appears on `/login` and `/register`.
The button is a normal navigation link; it does not load the Google SDK or require a new CSP origin.

The flow uses signed, short-lived, host-only assistant cookies with an isolated path, state,
PKCE S256 and nonce verification through openid-client. Return destinations are an allowlist of
private portal pages. Callback checks reject other hosts, mismatched clients/origins, expired or
modified transactions, missing codes, and denied authorizations. Password/session cookies for the
stores are not used or created. Account linking and new identity creation are transactional.

When `AI_ASSISTANTS_ENABLED=false`, existing users can still sign in, but new Google users are
not created. A newly created Google user can add their first business from the account page;
this does not automatically start a trial or activate billing.

## Find the trading owner ID and configured Claude models

After deploying, sign in as the global administrator and open:

```
https://admin.tapkin.com.au/account/integrations
```

The page shows the **current signed-in user's** UUID and email, plus the effective model names
and exact `modelId` values in that deployment. It includes any `AI_ASSISTANT_MODELS` override.
Copy the UUID to `TRADING_OWNER_USER_ID` and one model ID to `TRADING_AI_MODEL`.
These identifiers are not API keys. The page never displays `ANTHROPIC_API_KEY` or Google secrets.
A configured Anthropic key is reported as a boolean, not as proof of a successful provider call.

An authenticated request to `GET /api/assistants/auth` also returns the user's own identity.
Only verified global administrators receive model IDs and the Anthropic configured boolean.
No public email lookup is provided. Responses are private/no-store. Other users' UUIDs are not exposed.

If an administrator needs to retrieve their ID before deployment, use an authorized database console:

```sql
SELECT id, email, role, status, "emailVerifiedAt"
FROM "User"
WHERE email = 'admin@example.test';
```

Never use a hard-coded/example UUID or a workspace/store ID for the trading owner.

## Validation boundaries

Tests cover portal-vs-store isolation, configuration fallback, PKCE state/nonce binding, cookie
clearing, safe redirects, rejection of unverified/inactive accounts, preservation of existing
administrator IDs and prevention of registration when disabled. Provider secrets and real Google
credentials are not used in these tests. Completing an actual Google login remains a deployment
check after adding the authorized redirect URI in Google Cloud Console.

References:
- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/identity/openid-connect/reference
