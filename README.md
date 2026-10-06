# @authara/react

Official React components for Authara's Google and Apple browser flows.

The package owns provider SDK loading and React lifecycle integration. HTTP,
cookies, CSRF protection, sessions, and generated Authara API operations remain
in [`@authara/browser`](https://www.npmjs.com/package/@authara/browser).

## Installation

```bash
npm install @authara/react @authara/browser react
```

## Usage

Create one browser client and place one provider near the root of the page:

```tsx
import { AutharaBrowserClient } from "@authara/browser";
import {
  AppleButton,
  AutharaProvider,
  GoogleButton
} from "@authara/react";

const authara = new AutharaBrowserClient();

export function Login() {
  return (
    <AutharaProvider client={authara}>
      <GoogleButton
        onCredential={async ({ credential, nonce }) => {
          await authara.loginWithGoogle({
            audience: "app",
            body: { credential, nonce }
          });
        }}
        onError={console.error}
      />

      <AppleButton
        onAuthorization={async ({ code, state }) => {
          await authara.loginWithApple({
            audience: "app",
            body: { code, state }
          });
        }}
        onError={console.error}
      />
    </AutharaProvider>
  );
}
```

The buttons return provider proof instead of choosing an Authara operation.
The same components therefore work for login, provider linking,
reauthentication, invitations, and account-recovery proof.

`AutharaProvider` is deliberately small. It contains no authentication or
session state. It coordinates the page-global third-party SDK instances so
Google is initialized once and callbacks are routed to the correct button.

## Provider availability

Authara returns `404 Not Found` from an options operation when that provider is
disabled. The corresponding button then renders `fallback` (which defaults to
`null`) and calls `onUnavailable`.

```tsx
<GoogleButton
  fallback={<p>Google sign-in is not configured.</p>}
  onUnavailable={() => reportProviderUnavailable("google")}
  onCredential={handleGoogleCredential}
/>
```

Apple user cancellation calls `onCancel`; it is not reported through
`onError`.

## Appearance

`GoogleButton` exposes the official Google button configuration: `type`,
`theme`, `size`, `text`, `shape`, `logo_alignment`, `width`, and `locale`.

`AppleButton` exposes `color`, `border`, `type`, `mode`, and `locale`. Width and
height are set through the normal React `style` prop. Provider branding remains
rendered by the official provider SDKs.

## Contract synchronization

The components never contain Authara route strings. They consume the generated
`AutharaBrowserClient` operation methods:

- `getGoogleLoginOptions()`
- `getAppleLoginOptions()`

`.contract/manifest.json` records the exact browser SDK release and its
immutable Authara Core OpenAPI provenance. `npm run check:contract` performs a
TypeScript structural compatibility check against that exact browser SDK.

`.github/workflows/sync-browser.yaml` receives each
`authara-browser-released` event, installs the exact released browser package,
copies its Core provenance, runs the full checks, and opens an automated pull
request. This keeps route and schema changes flowing in this order:

```text
Authara Core OpenAPI release
  -> generated @authara/browser release
  -> @authara/react contract check and dependency PR
```

The initial manifest is intentionally marked `unreleased`. Publishing remains
blocked until a browser SDK release containing the Apple operations has passed
the synchronization workflow.

## Design guarantees

- No hidden login or redirect behavior
- No Authara route duplication
- Provider scripts are loaded once
- Safe effect cleanup for React Strict Mode
- Fresh Apple state and nonce immediately before authorization
- Disabled providers disappear cleanly
- React 18 and 19 peer support

## License

MIT
