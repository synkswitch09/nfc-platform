# Google sign-in per store and environment

Create a separate Google Cloud project for each brand and environment: Tapkin staging, Kosykin staging, Tapkin production and Kosykin production. Each project has its own Branding (name, logo, home page, privacy policy and terms), audience and Web application OAuth client. Keep staging in Testing; publish and verify production branding. Verify the relevant brand domain in Search Console with a project owner/editor account.

Register only the matching callback:

| Project | Authorized redirect URI |
| --- | --- |
| Tapkin staging | `https://staging.tapkin.com.au/api/auth/oauth/google/callback` |
| Kosykin staging | `https://staging.kosykin.com.au/api/auth/oauth/google/callback` |
| Tapkin production | `https://tapkin.com.au/api/auth/oauth/google/callback` |
| Kosykin production | `https://kosykin.com.au/api/auth/oauth/google/callback` |

## Azure configuration

Create a Container App secret named `google-oauth-stores`. Its value is a JSON object keyed by store slug. Replace placeholders with actual credentials from the two projects for that deployment environment:

```json
{
  "tapkin": { "clientId": "TAPKIN_CLIENT_ID", "clientSecret": "TAPKIN_CLIENT_SECRET" },
  "kosykin": { "clientId": "KOSYKIN_CLIENT_ID", "clientSecret": "KOSYKIN_CLIENT_SECRET" }
}
```

Bind environment variable `GOOGLE_OAUTH_STORES` to that secret and deploy a new application revision. Never commit actual secrets or include them in screenshots, logs or CMS fields. Staging and production must have different JSON values. A new store adds an entry to the same secret, without a new environment variable or code change.

When `GOOGLE_OAUTH_STORES` is present, only configured stores can sign in with Google. Missing stores cannot fall back to shared credentials. Once both brands are configured, the legacy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` variables may be removed. If the map is absent, legacy credentials remain supported to preserve existing login until migration. Do not remove `SESSION_SECRET`.

Enable Continue with Google in each store's CMS Customer accounts settings. The start and callback routes both select credentials by the server-resolved store slug. Each callback remains on the store's own trusted domain. Requested scopes remain `openid email profile`.

Test each brand in each environment using a Google account, including an existing verified email/password account. An existing unverified account must verify its email first. Adding credentials does not grant administrative access.
