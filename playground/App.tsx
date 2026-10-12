import { useMemo, useState } from "react";
import { AutharaBrowserClient } from "@authara/browser";
import {
  AppleButton,
  AutharaProvider,
  GoogleButton,
  MicrosoftButton,
  type AutharaAction,
  type AutharaAccountRecoveryLink,
  type AutharaActionSuccess,
  type AutharaAudience,
  type AutharaButtonError,
  type AutharaColorMode,
  type AutharaProviderName,
} from "@authara/react";

type ButtonVariant = "icon" | "provider" | "text";
type ButtonSize = "small" | "medium" | "large";

type Event = {
  id: number;
  kind: "error" | "info" | "success";
  message: string;
};

let eventSequence = 0;

function describeError(error: unknown): string {
  if (typeof error !== "object" || error === null) return String(error);
  const value = error as {
    code?: string;
    message?: string;
    status?: number;
  };
  const prefix = [value.status, value.code].filter(Boolean).join(" · ");
  return `${prefix ? `${prefix}: ` : ""}${value.message ?? "Unknown error"}`;
}

type RealButtonProps = {
  provider: AutharaProviderName;
  action: Exclude<AutharaAction, "recover">;
  audience: AutharaAudience;
  authenticationChallengeId: string;
  variant: ButtonVariant;
  size: ButtonSize;
  mode: AutharaColorMode;
  disabled: boolean;
  onSuccess: (result: AutharaActionSuccess<AutharaProviderName>) => void;
  onError: (error: AutharaButtonError) => void;
  onCancel: () => void;
  onUnavailable: (provider: AutharaProviderName) => void;
};

function RealButton({
  provider,
  action,
  audience,
  authenticationChallengeId,
  variant,
  size,
  mode,
  disabled,
  onSuccess,
  onError,
  onCancel,
  onUnavailable,
}: RealButtonProps) {
  const shared = {
    variant,
    size,
    mode,
    disabled,
    onError,
    onUnavailable: () => onUnavailable(provider),
    fallback: <p className="provider-unavailable">Not enabled in Authara</p>,
  } as const;

  if (provider === "google") {
    if (action === "link") {
      return <GoogleButton {...shared} action="link" onSuccess={onSuccess} />;
    }
    if (action === "reauthenticate") {
      return (
        <GoogleButton
          {...shared}
          action="reauthenticate"
          authenticationChallengeId={authenticationChallengeId}
          onSuccess={onSuccess}
        />
      );
    }
    return (
      <GoogleButton
        {...shared}
        action="login"
        audience={audience}
        onSuccess={onSuccess}
      />
    );
  }

  if (provider === "microsoft") {
    if (action === "link") {
      return (
        <MicrosoftButton {...shared} action="link" onSuccess={onSuccess} />
      );
    }
    if (action === "reauthenticate") {
      return (
        <MicrosoftButton
          {...shared}
          action="reauthenticate"
          authenticationChallengeId={authenticationChallengeId}
          onCancel={onCancel}
          onSuccess={onSuccess}
        />
      );
    }
    return (
      <MicrosoftButton
        {...shared}
        action="login"
        audience={audience}
        onCancel={onCancel}
        onSuccess={onSuccess}
      />
    );
  }

  if (action === "link") {
    return (
      <AppleButton
        {...shared}
        action="link"
        onCancel={onCancel}
        onSuccess={onSuccess}
      />
    );
  }
  if (action === "reauthenticate") {
    return (
      <AppleButton
        {...shared}
        action="reauthenticate"
        authenticationChallengeId={authenticationChallengeId}
        onCancel={onCancel}
        onSuccess={onSuccess}
      />
    );
  }
  return (
    <AppleButton
      {...shared}
      action="login"
      audience={audience}
      onCancel={onCancel}
      onSuccess={onSuccess}
    />
  );
}

export function App() {
  const client = useMemo(
    () =>
      new AutharaBrowserClient({
        baseUrl: import.meta.env.VITE_AUTHARA_BASE_URL || undefined,
      }),
    [],
  );
  const [action, setAction] = useState<AutharaAction>("login");
  const [audience, setAudience] = useState<AutharaAudience>("app");
  const [variant, setVariant] = useState<ButtonVariant>("text");
  const [size, setSize] = useState<ButtonSize>("large");
  const [mode, setMode] = useState<AutharaColorMode>("light");
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<string>("Not checked");
  const [events, setEvents] = useState<Event[]>([]);
  const [recovery, setRecovery] = useState<AutharaAccountRecoveryLink | null>(
    null,
  );

  const addEvent = (kind: Event["kind"], message: string) => {
    eventSequence += 1;
    setEvents((current) => [
      { id: eventSequence, kind, message },
      ...current.slice(0, 7),
    ]);
  };

  const readAccount = async () => {
    setBusy(true);
    try {
      const current = await client.getCurrentAccount();
      setAccount(`${current.user.email} (${current.user.id})`);
      addEvent("info", "Loaded the current Authara account.");
    } catch (error) {
      setAccount("No authenticated account");
      addEvent("error", describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const requestChallenge = async () => {
    setBusy(true);
    try {
      await client.getCsrfToken();
      await client.checkRecentAuthentication();
      addEvent(
        "info",
        "The session is already recent, so Authara did not issue a challenge.",
      );
    } catch (error) {
      const value = error as {
        authenticationChallenge?: { id?: string };
        code?: string;
      };
      if (
        value.code === "recent_authentication_required" &&
        value.authenticationChallenge?.id
      ) {
        setChallengeId(value.authenticationChallenge.id);
        setAction("reauthenticate");
        addEvent(
          "info",
          `Loaded challenge ${value.authenticationChallenge.id}.`,
        );
      } else {
        addEvent("error", describeError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await client.getCsrfToken();
      await client.logout();
      setAccount("No authenticated account");
      setRecovery(null);
      addEvent("success", "Signed out of Authara.");
    } catch (error) {
      addEvent("error", describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const onError = (error: AutharaButtonError) => {
    if (error.code === "account_link_required") {
      setAction("recover");
      if (error.recovery) {
        setRecovery(error.recovery);
        addEvent(
          "info",
          `${error.recovery.provider} login requires existing-account proof: ${error.recovery.proof_methods.join(", ")}.`,
        );
      } else {
        setRecovery(null);
        addEvent(
          "error",
          "Authara returned account_link_required without recovery details. Update Core and @authara/browser together.",
        );
      }
      return;
    }
    if (error.authenticationChallenge?.id) {
      setChallengeId(error.authenticationChallenge.id);
    }
    addEvent("error", `${error.source}: ${describeError(error)}`);
  };

  const onSuccess = (result: AutharaActionSuccess<AutharaProviderName>) => {
    if (result.action === "login" || result.action === "recover") {
      const message =
        result.action === "recover"
          ? `${recovery?.provider ?? "account"} recovery completed with ${result.provider} proof for ${result.session.user.email}.`
          : `${result.provider} login succeeded for ${result.session.user.email}.`;
      addEvent("success", message);
      setAccount(`${result.session.user.email} (${result.session.user.id})`);
      setRecovery(null);
      setAction("login");
      return;
    }
    addEvent("success", `${result.provider} ${result.action} succeeded.`);
  };

  const actionDisabled =
    busy || (action === "reauthenticate" && !challengeId.trim());

  return (
    <AutharaProvider client={client}>
      <main className="playground">
        <header className="hero">
          <div>
            <p className="eyebrow">@authara/react · real integration</p>
            <h1>Provider button playground</h1>
            <p>
              These controls load the real Google, Apple, and Microsoft SDKs and
              call your running Authara instance. No credentials or provider
              responses are mocked.
            </p>
          </div>
          <div className="connection">
            <span>Authara endpoint</span>
            <code>
              {import.meta.env.VITE_AUTHARA_BASE_URL ||
                "/auth through the Vite proxy"}
            </code>
          </div>
        </header>

        <section className="workspace">
          <aside className="controls" aria-label="Playground controls">
            <label>
              <span>Action</span>
              <select
                value={action}
                onChange={(event) =>
                  setAction(event.target.value as AutharaAction)
                }
              >
                <option value="login">Login</option>
                <option value="link">Link to current account</option>
                <option value="reauthenticate">Reauthenticate</option>
                <option value="recover">Recover account collision</option>
              </select>
            </label>

            <label>
              <span>Audience</span>
              <select
                value={audience}
                disabled={action !== "login"}
                onChange={(event) =>
                  setAudience(event.target.value as AutharaAudience)
                }
              >
                <option value="app">App</option>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
              </select>
            </label>

            <label>
              <span>Variant</span>
              <select
                value={variant}
                onChange={(event) =>
                  setVariant(event.target.value as ButtonVariant)
                }
              >
                <option value="text">Text</option>
                <option value="provider">Provider name</option>
                <option value="icon">Icon only</option>
              </select>
            </label>

            <label>
              <span>Size</span>
              <select
                value={size}
                onChange={(event) => setSize(event.target.value as ButtonSize)}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>

            <label>
              <span>Mode</span>
              <select
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as AutharaColorMode)
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>

            <label>
              <span>Authentication challenge</span>
              <input
                value={challengeId}
                disabled={action !== "reauthenticate"}
                placeholder="Challenge UUID"
                onChange={(event) => setChallengeId(event.target.value)}
              />
            </label>

            <div className="utility-actions">
              <button type="button" disabled={busy} onClick={readAccount}>
                Check session
              </button>
              <button type="button" disabled={busy} onClick={requestChallenge}>
                Request challenge
              </button>
              <button type="button" disabled={busy} onClick={logout}>
                Sign out
              </button>
            </div>
          </aside>

          <div className="preview-column">
            <section className="preview-card" data-color-mode={mode}>
              <div className="preview-heading">
                <div>
                  <p className="eyebrow">Selected operation</p>
                  <h2>{action === "recover" ? "account recovery" : action}</h2>
                </div>
                <code>
                  {action === "login"
                    ? audience
                    : action === "recover"
                      ? "app · signed out"
                      : "current session"}
                </code>
              </div>

              {action === "reauthenticate" && !challengeId && (
                <p className="notice">
                  Supply a challenge UUID or use “Request challenge.” Authara
                  only issues one when the current session is no longer recent.
                </p>
              )}

              {action === "recover" ? (
                <>
                  <p className="notice">
                    Sign out first, then attempt external login with an email
                    already owned by another method. Authara returns a
                    ten-minute recovery link and the existing methods that may
                    prove account ownership.
                  </p>
                  {!recovery ? (
                    <div className="provider-grid">
                      {(["google", "apple", "microsoft"] as const).map(
                        (provider) => (
                          <article className="provider-card" key={provider}>
                            <h3>Attempt {provider} login</h3>
                            <div className="button-stage">
                              <RealButton
                                provider={provider}
                                action="login"
                                audience="app"
                                authenticationChallengeId=""
                                variant={variant}
                                size={size}
                                mode={mode}
                                disabled={busy}
                                onSuccess={onSuccess}
                                onError={onError}
                                onCancel={() =>
                                  addEvent(
                                    "info",
                                    "Apple authorization was cancelled.",
                                  )
                                }
                                onUnavailable={(name) =>
                                  addEvent(
                                    "info",
                                    `${name} is disabled in Authara.`,
                                  )
                                }
                              />
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="recovery-state">
                        Pending <strong>{recovery.provider}</strong> link{" "}
                        <code>{recovery.link_id}</code>
                      </div>
                      <div className="provider-grid">
                        {recovery.proof_methods.includes("google") && (
                          <article className="provider-card">
                            <h3>Prove with Google</h3>
                            <div className="button-stage">
                              <GoogleButton
                                action="recover"
                                recoveryLinkId={recovery.link_id}
                                audience="app"
                                variant={variant}
                                size={size}
                                mode={mode}
                                disabled={busy}
                                onSuccess={onSuccess}
                                onError={onError}
                              />
                            </div>
                          </article>
                        )}
                        {recovery.proof_methods.includes("apple") && (
                          <article className="provider-card">
                            <h3>Prove with Apple</h3>
                            <div className="button-stage">
                              <AppleButton
                                action="recover"
                                recoveryLinkId={recovery.link_id}
                                audience="app"
                                variant={variant}
                                size={size}
                                mode={mode}
                                disabled={busy}
                                onSuccess={onSuccess}
                                onError={onError}
                                onCancel={() =>
                                  addEvent(
                                    "info",
                                    "Apple recovery proof was cancelled.",
                                  )
                                }
                              />
                            </div>
                          </article>
                        )}
                        {recovery.proof_methods.includes("microsoft") && (
                          <article className="provider-card">
                            <h3>Prove with Microsoft</h3>
                            <div className="button-stage">
                              <MicrosoftButton
                                action="recover"
                                recoveryLinkId={recovery.link_id}
                                audience="app"
                                variant={variant}
                                size={size}
                                mode={mode}
                                disabled={busy}
                                onSuccess={onSuccess}
                                onError={onError}
                                onCancel={() =>
                                  addEvent(
                                    "info",
                                    "Microsoft recovery proof was cancelled.",
                                  )
                                }
                              />
                            </div>
                          </article>
                        )}
                      </div>
                      {recovery.proof_methods.includes("password") && (
                        <p className="notice">
                          Password is also an available proof method. This
                          button playground only exercises provider proofs.
                        </p>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="provider-grid">
                  {(["google", "apple", "microsoft"] as const).map(
                    (provider) => (
                      <article className="provider-card" key={provider}>
                        <h3>
                          {provider === "google"
                            ? "Google"
                            : provider === "apple"
                              ? "Apple"
                              : "Microsoft"}
                        </h3>
                        <div className="button-stage">
                          <RealButton
                            provider={provider}
                            action={action}
                            audience={audience}
                            authenticationChallengeId={challengeId}
                            variant={variant}
                            size={size}
                            mode={mode}
                            disabled={actionDisabled}
                            onSuccess={onSuccess}
                            onError={onError}
                            onCancel={() =>
                              addEvent(
                                "info",
                                "Apple authorization was cancelled.",
                              )
                            }
                            onUnavailable={(name) =>
                              addEvent(
                                "info",
                                `${name} is disabled in Authara.`,
                              )
                            }
                          />
                        </div>
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>

            <section className="status-grid">
              <article className="status-card">
                <p className="eyebrow">Current account</p>
                <p>{account}</p>
              </article>
              <article className="status-card event-log">
                <p className="eyebrow">Events</p>
                {events.length === 0 ? (
                  <p>No requests yet.</p>
                ) : (
                  <ol>
                    {events.map((event) => (
                      <li data-kind={event.kind} key={event.id}>
                        {event.message}
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            </section>
          </div>
        </section>
      </main>
    </AutharaProvider>
  );
}
