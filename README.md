# @authara/react

Official React buttons for complete Authara Google, Apple, and Microsoft authentication
flows. The components load the provider SDK, obtain the provider proof, prepare
CSRF, call the generated Authara browser client, and return a typed result.

## Installation

```bash
npm install @authara/react @authara/browser react
```

## Setup

Create one browser client and one provider near the root of the page:

```tsx
import { AutharaBrowserClient } from "@authara/browser";
import { AutharaProvider } from "@authara/react";

const authara = new AutharaBrowserClient({
  automaticRefresh: { audience: "app" },
});

export function App() {
  return (
    <AutharaProvider client={authara}>
      <Routes />
    </AutharaProvider>
  );
}
```

The provider owns no user or session state. It coordinates Authara's generated
client and the external-provider SDKs.

## Login

```tsx
import { AppleButton, GoogleButton, MicrosoftButton } from "@authara/react";

export function Login() {
  return (
    <div>
      <GoogleButton
        action="login"
        audience="app"
        variant="text"
        size="large"
        onSuccess={({ session }) => setCurrentUser(session.user)}
        onError={handleAuthError}
      />

      <AppleButton
        action="login"
        audience="app"
        variant="text"
        size="large"
        onSuccess={({ session }) => setCurrentUser(session.user)}
        onError={handleAuthError}
        onCancel={() => setMessage("Sign in was cancelled.")}
      />

      <MicrosoftButton
        action="login"
        audience="app"
        variant="text"
        size="large"
        onSuccess={({ session }) => setCurrentUser(session.user)}
        onError={handleAuthError}
        onCancel={() => setMessage("Sign in was cancelled.")}
      />
    </div>
  );
}
```

`action="login"` supports the `app`, `admin`, and `operator` audiences. The
default action is `login` and the default audience is `app`.

## Invitation-aware login

Pass an Authara invitation token to accept the invitation as part of provider
login. Invitation login is intentionally restricted to the `app` audience:

```tsx
<GoogleButton
  invitationToken={invitationToken}
  invitationFlow="signup"
  onSuccess={(result) => {
    if (result.status === "recovery-required") {
      setRecovery(result.recovery);
      return;
    }
    reloadSession();
  }}
/>

<AppleButton invitationToken={invitationToken} onSuccess={reloadSession} />
<MicrosoftButton invitationToken={invitationToken} onSuccess={reloadSession} />
```

Google's invitation endpoint can return a typed `recovery-required` result
when the provider email collides with an existing account. Apple and Microsoft
surface the equivalent collision through the normal structured error contract.
Pass the same `invitationToken` to an `action="recover"` button so Authara can
complete the pending invitation after ownership proof.

## Link a provider

```tsx
<GoogleButton
  action="link"
  onSuccess={() => refreshAccount()}
  onError={handleAuthError}
/>

<AppleButton
  action="link"
  onSuccess={() => refreshAccount()}
  onError={handleAuthError}
/>

<MicrosoftButton
  action="link"
  onSuccess={() => refreshAccount()}
  onError={handleAuthError}
/>
```

Linking uses the current Authara session and therefore does not accept an
audience. Authara may return `recent_authentication_required` when the session
needs a fresh proof.

## Reauthenticate

```tsx
<AppleButton
  action="reauthenticate"
  authenticationChallengeId={challenge.id}
  onSuccess={() => retrySensitiveAction()}
  onError={handleAuthError}
/>

<MicrosoftButton
  action="reauthenticate"
  authenticationChallengeId={challenge.id}
  onSuccess={() => retrySensitiveAction()}
  onError={handleAuthError}
/>
```

TypeScript requires `authenticationChallengeId` for reauthentication and
rejects `audience` for both linking and reauthentication.

## Account collisions

A login with an email owned by another sign-in method returns
`account_link_required`. The error contains the pending provider, a short-lived
link ID, and the methods that can prove ownership. Render the matching provider
button with `action="recover"`:

```tsx
import type {
  AutharaAccountRecoveryLink,
  AutharaButtonError,
} from "@authara/react";

const [recovery, setRecovery] = useState<AutharaAccountRecoveryLink>();

function handleLoginError(error: AutharaButtonError) {
  if (error.code === "account_link_required" && error.recovery) {
    setRecovery(error.recovery);
    return;
  }
  showMessage(error.message);
}

{
  recovery?.proof_methods.includes("google") && (
    <GoogleButton
      action="recover"
      recoveryLinkId={recovery.link_id}
      onSuccess={({ session }) => setCurrentUser(session.user)}
      onError={handleLoginError}
    />
  );
}

{
  recovery?.proof_methods.includes("apple") && (
    <AppleButton
      action="recover"
      recoveryLinkId={recovery.link_id}
      onSuccess={({ session }) => setCurrentUser(session.user)}
      onError={handleLoginError}
    />
  );
}

{
  recovery?.proof_methods.includes("microsoft") && (
    <MicrosoftButton
      action="recover"
      recoveryLinkId={recovery.link_id}
      onSuccess={({ session }) => setCurrentUser(session.user)}
      onError={handleLoginError}
    />
  );
}
```

The flow is symmetric across external providers: a collision can be proved
with any existing Google, Apple, or Microsoft identity returned in
`proof_methods`. Authara never links accounts from an email match alone.

## Errors

`onError` receives `AutharaButtonError`. It identifies the failing layer and
preserves structured Authara metadata:

```tsx
import type { AutharaButtonError } from "@authara/react";

function handleAuthError(error: AutharaButtonError) {
  switch (error.code) {
    case "recent_authentication_required":
      openReauthentication(error.authenticationChallenge);
      return;
    case "auth_method_already_linked":
      showMessage("That provider is already linked.");
      return;
    case "unauthorized":
      navigate("/login");
      return;
    default:
      showMessage(error.message);
  }
}
```

Useful fields are:

- `source`: `authara`, `provider`, `configuration`, or `consumer`
- `status`: the HTTP status when Authara responded
- `code`: the stable Authara error code, or `unknown_authara_error`
- `serverCode`: an unrecognized server code when `code` is
  `unknown_authara_error`
- `authenticationChallenge`: the challenge returned with HTTP 428
- `reauthenticateUrl`: Authara's optional reauthentication URL
- `recovery`: typed account-collision recovery details returned with HTTP 409
- `originalError`: the original provider, SDK, or callback failure

The selected `action` narrows the error-code type passed to `onError`. These
unions are generated from Core's `x-authara-error-codes` declarations:

- login adds `account_link_required`
- link adds `auth_method_already_linked` and
  `recent_authentication_required`
- reauthentication adds `invalid_authentication_challenge`
- recovery adds the provider-link and invitation completion errors
- every action includes its declared authorization, request, availability, and
  internal codes, plus the local CSRF and unknown-code fallbacks

Google, Apple, and Microsoft popup cancellations call `onCancel`, not
`onError`. Popup-open and other provider failures remain errors. A provider
disabled in Authara renders `fallback` and calls `onUnavailable`.

Use `onStart` when surrounding application state must observe an accepted
provider attempt. It runs once after the button is ready and enabled and
immediately before provider authorization starts. It is consistent across all
three providers; do not use provider-specific DOM click propagation as an
authorization lifecycle signal.

The package rejects Apple callback URLs outside the exact same-origin
`/auth/oauth/apple/callback` route and Microsoft authorities outside
`https://login.microsoftonline.com` before provider authorization begins.

## Appearance

All three components share the simple properties:

```tsx
<AppleButton
  action="login"
  variant="icon"
  size="small"
/>

<GoogleButton
  action="login"
  variant="provider"
  size="large"
  mode="system"
  width="min(100%, 24rem)"
/>

<MicrosoftButton action="login" variant="text" size="large" mode="system" />
```

- `variant`: `text`, `provider`, or `icon`
- `size`: `small`, `medium`, or `large`
- `label`: `sign-in`, `sign-up`, or `continue`

The `provider` variant shows only the provider icon and name, such as
“Google”, without an action prefix. Every button accepts `width` with normal
CSS values such as `320`, `"20rem"`, `"100%"`, or `"min(100%, 24rem)"`.
Icon buttons remain square by default, but an explicit `width` overrides that
default too.

Text-button heights are `30px`, `36px`, and `44px`. Icon-only buttons are
larger at `36px`, `44px`, and `52px` for the same three size names.

`mode` accepts `"light"`, `"dark"`, or `"system"` and defaults to `"light"`.
`system` follows live changes to `prefers-color-scheme`. Light mode uses the
black Apple button and Google's light preset. Dark mode uses the white Apple
button and Google's dark preset. Apple is borderless in both modes. Explicit
Apple `color` or `border`, or Google `theme` or `border`, properties take
precedence over these defaults.

Google additionally exposes `theme`, `border`, `shape`, and `logoAlignment`.
Apple exposes `color`, `border`, `borderRadius`, and `align`.
Microsoft exposes `border` and `align`. All providers accept
`buttonText` to localize or otherwise override the
visible label and the accessible name of icon-only buttons.
Text, provider, and icon variants all default to a `12px` corner radius. Apple's
`borderRadius` accepts its supported `0`–`50` range; Google's `shape` can still
select `pill`, `circle`, `square`, or `rectangular` explicitly.
All providers use an Authara-rendered, centered logo-and-label structure.
Google's `light`, `dark`, and `neutral` themes use Google's required colors,
spacing, and typography. Make Google Sans Medium available in your application
as required by Google's branding guidelines; this package does not inject a
font download or redistribute Google's font. The provider SDKs still own the
underlying credential and authorization flows. Google's visible control is a
real native button; it starts the popup authorization-code flow directly and
does not place an invisible provider button over Authara's presentation.

## Advanced provider-proof components

Applications with a custom multi-step operation can use the lower-level
components:

```tsx
<GoogleCredentialButton onCredential={handleGoogleProof} />
<AppleCredentialButton onAuthorization={handleAppleProof} />
<MicrosoftCredentialButton onCredential={handleMicrosoftProof} />
```

Most applications should use `GoogleButton`, `AppleButton`, and
`MicrosoftButton`; the lower-level components deliberately expose the
short-lived provider proofs used by Core.

## Real local playground

The Vite playground uses the real Google, Apple, and Microsoft SDKs and sends real HTTP
requests to Authara. It has no provider or API mocks.

For fast component development, start an Authara gateway with Google and/or
Apple configured, then run:

```bash
npm ci
npm run dev
```

Core reads Google configuration from `AUTHARA_OAUTH_GOOGLE_CLIENT_ID` and
`AUTHARA_OAUTH_GOOGLE_CLIENT_SECRET`. Keep the secret on Core; React never
receives it. Apple uses `AUTHARA_OAUTH_APPLE_CLIENT_ID`, `AUTHARA_OAUTH_APPLE_TEAM_ID`,
`AUTHARA_OAUTH_APPLE_KEY_ID`, `AUTHARA_OAUTH_APPLE_PRIVATE_KEY_BASE64`, and the
Apple token-key settings documented by Authara Core.
Microsoft uses `AUTHARA_OAUTH_MICROSOFT_CLIENT_ID` and
`AUTHARA_OAUTH_MICROSOFT_TENANT_ID`; the browser obtains its authority and
one-time nonce from Core. Register the exact SPA redirect URI
`https://your-domain/auth/oauth/microsoft/redirect` in Microsoft Entra; Core
serves the MSAL redirect bridge at that path.

By default, Vite proxies `/auth` to `http://localhost:3001`. Override the Core
or gateway address when needed:

```bash
AUTHARA_PLAYGROUND_PROXY_TARGET=http://localhost:3000 npm run dev
```

Alternatively, set `VITE_AUTHARA_BASE_URL` to call an Authara origin directly.
That origin must allow the playground origin and credentialed browser requests.
The same-origin proxy is usually simpler.

To rehearse the way an operator deploys the packages, use the version-pinned
Compose stack instead. It builds the package first, builds the playground
against the package's public `dist` exports, and serves it through Authara
Gateway alongside released Core, migrations, PostgreSQL, and Redis images. A
`cloudflared` container publishes that gateway through the named tunnel:

```bash
cp .env.example .env
# Paste the tunnel's eyJ... token into CLOUDFLARE_TUNNEL_TOKEN in .env.
docker compose -f docker-compose.playground.yaml up --build
```

While testing unreleased Core contract changes from this workspace, add the
local override. It keeps the operator-style stack but builds the neighboring
`authara-core` checkout instead of pulling the released Core image:

```bash
cp docker-compose.playground.local.example.yaml docker-compose.playground.local.yaml
docker compose \
  -f docker-compose.playground.yaml \
  -f docker-compose.playground.local.yaml \
  up --build
```

The Cloudflare route for `playground.authara.org` must use
`http://gateway:3000` as its service URL because the connector runs inside the
Compose network. Open `https://playground.authara.org`; `http://localhost:3000`
remains available for direct local debugging.

After configuring the providers, fill their values in `.env` and set
`AUTHARA_OAUTH_PROVIDERS=google,apple,microsoft`. Until then, leave the provider list
empty; the playground displays the disabled-provider fallbacks instead of
attempting OAuth. Never commit `.env` or the tunnel token.

The Compose file defaults to the exact Core and migrations versions recorded
for this React contract; override `AUTHARA_CORE_VERSION` and
`AUTHARA_MIGRATIONS_VERSION` only when deliberately testing another released
pair.

For the Compose deployment, configure all providers with the public origin
`https://playground.authara.org`. The Google redirect URI is
`https://playground.authara.org/auth/oauth/google/callback`; the Apple domain is
`playground.authara.org` and its return URL is
`https://playground.authara.org/auth/oauth/apple/callback`.
Register
`https://playground.authara.org/auth/oauth/microsoft/redirect` as the Microsoft
SPA redirect URI.

The playground covers:

- real login for `app`, `admin`, and `operator`
- linking Google, Apple, or Microsoft to the current account
- signed-out cross-provider account-collision recovery
- Google, Apple, or Microsoft reauthentication with a challenge UUID
- text and icon variants in all three sizes
- disabled-provider fallbacks, cancellation, and structured errors
- current-session inspection without displaying access or refresh tokens

“Request challenge” calls Authara's recent-authentication check. A fresh session
returns success without a challenge; an old session returns HTTP 428 and the
playground fills the challenge UUID automatically.

To rehearse account-collision recovery, use “Sign out,” select “Recover account
collision,” and attempt a normal external-provider login with an email already
owned by another method. Authara's `409 account_link_required` response
already contains the pending link, so the playground immediately renders the
available existing-account proof buttons. It creates and consumes Core's real
ten-minute `link_id`; it does not simulate either provider response.

## Contract synchronization

The published components contain no Authara route strings. They call methods on
the generated `@authara/browser` client. The package's compatibility manifest
and synchronization workflow bind each React release to an immutable browser
SDK release and its Authara Core OpenAPI provenance.

Each Browser release triggers a compatibility PR. The workflow waits for npm
registry propagation, verifies the Browser and Core commits and OpenAPI hash,
updates the exact Browser development dependency, and regenerates the action
error unions from Core. Route/type-compatible updates may auto-merge. A changed
error union deliberately requires human review so component mechanics and the
documented application handling can be updated when necessary.

Provider operations are discovered from Core's `get…LoginOptions` operations,
so Microsoft error declarations enter the generated unions automatically. The
Microsoft client methods are optional locally so this package still accepts the
currently released Browser client and renders `fallback`; they become active
when Browser is regenerated from the Microsoft-enabled Core OpenAPI contract.

## License

MIT
