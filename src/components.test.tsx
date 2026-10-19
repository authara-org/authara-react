import { StrictMode } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppleButton, AppleCredentialButton } from "./AppleButton.js";
import type { AutharaReactClient } from "./contract.js";
import { AutharaProvider } from "./context.js";
import { GoogleButton, GoogleCredentialButton } from "./GoogleButton.js";
import {
  resetProviderSDKsForTests,
  type GoogleCodeClientConfiguration,
} from "./provider-sdks.js";

function client(
  overrides: Partial<AutharaReactClient> = {},
): AutharaReactClient {
  return {
    getCsrfToken: vi.fn().mockResolvedValue({ csrf_token: "csrf-token" }),
    getGoogleLoginOptions: vi.fn().mockResolvedValue({
      client_id: "google-client",
      nonce: "google-nonce",
    }),
    getAppleLoginOptions: vi.fn().mockResolvedValue({
      client_id: "apple-client",
      redirect_uri: `${window.location.origin}/auth/oauth/apple/callback`,
      state: "apple-state",
      nonce: "apple-nonce",
    }),
    loginWithGoogle: vi.fn().mockResolvedValue({
      user: {
        id: "user-1",
        email: "person@example.com",
        username: "person",
        disabled: false,
        created_at: "2030-01-01T00:00:00Z",
      },
      access_token: "access-token",
      refresh_token: "refresh-token",
    }),
    loginWithApple: vi.fn().mockResolvedValue({
      user: {
        id: "user-1",
        email: "person@example.com",
        username: "person",
        disabled: false,
        created_at: "2030-01-01T00:00:00Z",
      },
      access_token: "access-token",
      refresh_token: "refresh-token",
    }),
    authenticateAndAcceptInvitationWithGoogle: vi.fn().mockResolvedValue({
      status: "authenticated",
      session: {
        user: {
          id: "user-1",
          email: "person@example.com",
          username: "person",
          disabled: false,
          created_at: "2030-01-01T00:00:00Z",
        },
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
    }),
    linkCurrentUserGoogle: vi.fn().mockResolvedValue(undefined),
    linkCurrentUserApple: vi.fn().mockResolvedValue(undefined),
    reauthenticateWithGoogle: vi.fn().mockResolvedValue(undefined),
    reauthenticateWithApple: vi.fn().mockResolvedValue(undefined),
    completeAccountRecoveryLinkWithGoogle: vi.fn().mockResolvedValue({
      user: {
        id: "user-1",
        email: "person@example.com",
        username: "person",
        disabled: false,
        created_at: "2030-01-01T00:00:00Z",
      },
      access_token: "access-token",
      refresh_token: "refresh-token",
    }),
    completeAccountRecoveryLinkWithApple: vi.fn().mockResolvedValue({
      user: {
        id: "user-1",
        email: "person@example.com",
        username: "person",
        disabled: false,
        created_at: "2030-01-01T00:00:00Z",
      },
      access_token: "access-token",
      refresh_token: "refresh-token",
    }),
    ...overrides,
  };
}

function mockGoogle() {
  const configurations: GoogleCodeClientConfiguration[] = [];
  const requestCode = vi.fn();
  const initCodeClient = vi.fn((options: GoogleCodeClientConfiguration) => {
    configurations.push(options);
    return { requestCode };
  });
  window.google = { accounts: { oauth2: { initCodeClient } } };
  return { configurations, initCodeClient, requestCode };
}

describe("Authara React provider buttons", () => {
  beforeEach(() => {
    resetProviderSDKsForTests();
    delete window.google;
    delete window.AppleID;
  });

  afterEach(() => {
    cleanup();
    document.head
      .querySelectorAll("script")
      .forEach((script) => script.remove());
  });

  it("requires the page-wide provider", () => {
    expect(() =>
      render(<GoogleCredentialButton onCredential={() => undefined} />),
    ).toThrow("Authara buttons must be rendered inside AutharaProvider.");
  });

  it("prepares each custom Google button and routes authorization codes", async () => {
    const google = mockGoogle();
    const first = vi.fn();
    const second = vi.fn();
    const authara = client();

    render(
      <StrictMode>
        <AutharaProvider client={authara}>
          <GoogleCredentialButton onCredential={first} />
          <GoogleCredentialButton onCredential={second} />
        </AutharaProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(4));
    expect(google.initCodeClient).toHaveBeenCalledTimes(4);
    expect(authara.getGoogleLoginOptions).toHaveBeenCalledTimes(1);

    google.configurations.at(-1)!.callback({ code: "google-code" });

    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({
      code: "google-code",
      redirect_uri: window.location.origin,
    });
  });

  it("renders a fallback when Google is disabled in Authara", async () => {
    const onUnavailable = vi.fn();
    const authara = client({
      getGoogleLoginOptions: vi.fn().mockRejectedValue({ status: 404 }),
    });
    const result = render(
      <AutharaProvider client={authara}>
        <GoogleCredentialButton
          fallback={<p>Google unavailable</p>}
          onCredential={() => undefined}
          onUnavailable={onUnavailable}
        />
      </AutharaProvider>,
    );

    expect(await result.findByText("Google unavailable")).toBeTruthy();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("rejects an Apple callback outside the exact application route", async () => {
    const init = vi.fn();
    window.AppleID = {
      auth: { init, renderButton: vi.fn(), signIn: vi.fn() },
    };
    const onError = vi.fn();
    render(
      <AutharaProvider
        client={client({
          getAppleLoginOptions: vi.fn().mockResolvedValue({
            client_id: "apple-client",
            redirect_uri: "https://attacker.example/auth/oauth/apple/callback",
            state: "apple-state",
            nonce: "apple-nonce",
          }),
        })}
      >
        <AppleCredentialButton
          onAuthorization={() => undefined}
          onError={onError}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(init).not.toHaveBeenCalled();
  });

  it("renders a directly clickable, focusable Google button", async () => {
    const google = mockGoogle();

    const result = render(
      <AutharaProvider client={client()}>
        <GoogleCredentialButton
          data-testid="google"
          text="signin_with"
          size="medium"
          shape="pill"
          onCredential={() => undefined}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(result.getByTestId("google").dataset.autharaReady).toBe("true"),
    );
    const presentation = result.getByTestId("google");

    expect(presentation.textContent).toBe("Sign in with Google");
    expect(presentation.tagName).toBe("BUTTON");
    expect(presentation.style.borderRadius).toBe("18px");
    expect(presentation.style.background).toBe("#fff");
    expect(presentation.style.borderColor).toBe("#747775");
    expect(presentation.style.fontFamily).toBe(
      '"Google Sans", Roboto, Arial, sans-serif',
    );
    expect(presentation.style.fontSize).toBe("14px");
    expect(presentation.style.fontWeight).toBe("500");
    expect(presentation.style.lineHeight).toBe("20px");
    expect(presentation.style.gap).toBe("10px");
    expect(presentation.style.padding).toBe("0px 12px");
    expect(
      presentation.querySelector("[data-authara-google-trigger]"),
    ).toBeNull();
    presentation.focus();
    expect(document.activeElement).toBe(presentation);
    fireEvent.click(presentation);
    expect(google.requestCode).toHaveBeenCalledTimes(1);
  });

  it("renders provider-name buttons with CSS widths", async () => {
    mockGoogle();
    const renderAppleButton = vi.fn();
    window.AppleID = {
      auth: {
        init: vi.fn(),
        renderButton: renderAppleButton,
        signIn: vi.fn(),
      },
    };

    const result = render(
      <AutharaProvider client={client()}>
        <GoogleButton
          data-testid="google-provider"
          variant="provider"
          width="24rem"
        />
        <AppleButton
          data-testid="apple-provider"
          variant="provider"
          width="18rem"
        />
        <GoogleButton
          data-testid="google-icon-width"
          variant="icon"
          width="4rem"
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(renderAppleButton).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.getByTestId("google-provider").dataset.autharaReady).toBe(
        "true",
      ),
    );
    expect(result.getByTestId("google-provider").textContent).toBe("Google");
    expect(result.getByTestId("google-provider").style.width).toBe("24rem");
    expect(result.getByTestId("apple-provider").textContent).toBe("Apple");
    expect(result.getByTestId("apple-provider").style.width).toBe("18rem");
    expect(result.getByTestId("google-icon-width").style.width).toBe("4rem");
  });

  it("renders Apple and uses fresh server options for authorization", async () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    const signIn = vi.fn().mockResolvedValue({
      authorization: { code: "apple-code", state: "fresh-state" },
    });
    window.AppleID = {
      auth: { init: initialize, renderButton, signIn },
    };
    const getAppleLoginOptions = vi
      .fn()
      .mockResolvedValueOnce({
        client_id: "apple-client",
        redirect_uri: `${window.location.origin}/auth/oauth/apple/callback`,
        state: "render-state",
        nonce: "render-nonce",
      })
      .mockResolvedValueOnce({
        client_id: "apple-client",
        redirect_uri: `${window.location.origin}/auth/oauth/apple/callback`,
        state: "fresh-state",
        nonce: "fresh-nonce",
      });
    const onAuthorization = vi.fn();
    const result = render(
      <AutharaProvider client={client({ getAppleLoginOptions })}>
        <AppleCredentialButton
          data-testid="apple"
          borderRadius={20}
          onAuthorization={onAuthorization}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    const applePresentation = result
      .getByTestId("apple")
      .querySelector<HTMLButtonElement>("[data-authara-apple-presentation]");
    expect(result.getByTestId("apple").style.borderRadius).toBe("20px");
    expect(applePresentation?.textContent).toBe("Continue with Apple");
    expect(applePresentation?.style.fontFamily).toBe("Arial, sans-serif");
    expect(applePresentation?.style.fontSize).toBe("14px");
    expect(applePresentation?.style.fontWeight).toBe("500");
    expect(applePresentation?.style.lineHeight).toBe("1");
    expect(applePresentation?.style.gap).toBe("10px");
    expect(
      result
        .getByTestId("apple")
        .firstElementChild?.getAttribute("data-border-radius"),
    ).toBe("20");
    fireEvent.click(result.getByTestId("apple").firstElementChild!);

    await waitFor(() => expect(onAuthorization).toHaveBeenCalledTimes(1));
    expect(getAppleLoginOptions).toHaveBeenCalledTimes(2);
    expect(signIn).toHaveBeenCalledWith({
      clientId: "apple-client",
      scope: "email",
      redirectURI: `${window.location.origin}/auth/oauth/apple/callback`,
      state: "fresh-state",
      nonce: "fresh-nonce",
      usePopup: true,
    });
    expect(onAuthorization).toHaveBeenCalledWith({
      code: "apple-code",
      state: "fresh-state",
    });
  });

  it("uses the Google text-button radius as Apple's default", async () => {
    window.AppleID = {
      auth: {
        init: vi.fn(),
        renderButton: vi.fn(),
        signIn: vi.fn(),
      },
    };

    const result = render(
      <AutharaProvider client={client()}>
        <AppleCredentialButton
          data-testid="apple-default-radius"
          onAuthorization={() => undefined}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(
        result.getByTestId("apple-default-radius").dataset.autharaReady,
      ).toBe("true"),
    );
    expect(result.getByTestId("apple-default-radius").style.borderRadius).toBe(
      "12px",
    );
    expect(
      result
        .getByTestId("apple-default-radius")
        .firstElementChild?.getAttribute("data-border-radius"),
    ).toBe("12");
  });

  it("rejects an Apple radius outside the provider's supported range", () => {
    expect(() =>
      render(
        <AutharaProvider client={client()}>
          <AppleCredentialButton
            borderRadius={51}
            onAuthorization={() => undefined}
          />
        </AutharaProvider>,
      ),
    ).toThrow("Apple button borderRadius must be between 0 and 50.");
  });

  it("reports Apple cancellation separately from errors", async () => {
    const cancellation = { error: "user_cancelled_authorize" };
    window.AppleID = {
      auth: {
        init: vi.fn(),
        renderButton: vi.fn(),
        signIn: vi.fn().mockRejectedValue(cancellation),
      },
    };
    const onCancel = vi.fn();
    const onError = vi.fn();
    const result = render(
      <AutharaProvider client={client()}>
        <AppleCredentialButton
          data-testid="apple"
          onAuthorization={() => undefined}
          onCancel={onCancel}
          onError={onError}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(result.getByTestId("apple").dataset.autharaReady).toBe("true"),
    );
    fireEvent.click(result.getByTestId("apple").firstElementChild!);

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not run a disabled button action", async () => {
    const google = mockGoogle();
    const onCredential = vi.fn();
    const result = render(
      <AutharaProvider client={client()}>
        <GoogleCredentialButton
          data-testid="disabled-google"
          disabled
          onCredential={onCredential}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    fireEvent.click(result.getByTestId("disabled-google"));
    await Promise.resolve();
    expect(google.requestCode).not.toHaveBeenCalled();
    expect(onCredential).not.toHaveBeenCalled();
  });

  it("forwards the logo-only variants to both provider SDKs", async () => {
    mockGoogle();
    const renderAppleButton = vi.fn();
    window.AppleID = {
      auth: {
        init: vi.fn(),
        renderButton: renderAppleButton,
        signIn: vi.fn(),
      },
    };

    const result = render(
      <AutharaProvider client={client()}>
        <GoogleCredentialButton
          data-testid="google-logo"
          buttonText="Mit Google fortfahren"
          type="icon"
          shape="circle"
          onCredential={() => undefined}
        />
        <AppleCredentialButton
          data-testid="apple-logo"
          buttonText="Mit Apple fortfahren"
          mode="logo-only"
          onAuthorization={() => undefined}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(renderAppleButton).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.getByTestId("google-logo").dataset.autharaReady).toBe(
        "true",
      ),
    );
    expect(result.getByTestId("google-logo").textContent).toBe("");
    expect(result.getByTestId("google-logo").getAttribute("aria-label")).toBe(
      "Mit Google fortfahren",
    );
    expect(result.getByTestId("google-logo").style.borderRadius).toBe("26px");
    expect(
      result
        .getByTestId("apple-logo")
        .firstElementChild?.getAttribute("data-mode"),
    ).toBe("logo-only");
    const applePresentation = result
      .getByTestId("apple-logo")
      .querySelector("[data-authara-apple-presentation]");
    expect(applePresentation?.textContent).toBe("");
    expect(applePresentation?.getAttribute("aria-label")).toBe(
      "Mit Apple fortfahren",
    );
  });

  it("recovers when a synchronous Google callback throws", async () => {
    const google = mockGoogle();
    const onError = vi.fn();
    const result = render(
      <AutharaProvider client={client()}>
        <GoogleCredentialButton
          data-testid="google-sync-error"
          onCredential={() => {
            throw new Error("consumer failed");
          }}
          onError={onError}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    google.configurations[0].callback({ code: "google-code" });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toMatchObject({
      message: "consumer failed",
    });
    expect(
      (result.getByTestId("google-sync-error") as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      result.getByTestId("google-sync-error").getAttribute("aria-busy"),
    ).toBeNull();
  });

  it("executes a complete Google login with the selected audience", async () => {
    const google = mockGoogle();
    const authara = client();
    const onSuccess = vi.fn();

    const result = render(
      <AutharaProvider client={authara}>
        <GoogleButton
          data-testid="google-login"
          action="login"
          audience="operator"
          variant="icon"
          onSuccess={onSuccess}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    fireEvent.click(result.getByTestId("google-login"));
    expect(google.requestCode).toHaveBeenCalledTimes(1);
    google.configurations[0].callback({ code: "google-code" });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(authara.getCsrfToken).toHaveBeenCalledTimes(1);
    expect(authara.loginWithGoogle).toHaveBeenCalledWith({
      audience: "operator",
      body: {
        code: "google-code",
        redirect_uri: window.location.origin,
      },
    });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login",
        provider: "google",
      }),
    );
    expect(result.getByTestId("google-login").style.borderRadius).toBe("12px");
    expect(result.getByTestId("google-login").style.width).toBe("52px");
    expect(result.getByTestId("google-login").style.height).toBe("52px");
  });

  it("accepts a Google invitation or returns its typed recovery step", async () => {
    const google = mockGoogle();
    const recovery = {
      link_id: "recovery-link",
      provider: "google" as const,
      proof_methods: ["password" as const, "microsoft" as const],
    };
    const acceptInvitation = vi.fn().mockResolvedValue({
      status: "proof_required",
      recovery,
    });
    const authara = client({
      authenticateAndAcceptInvitationWithGoogle: acceptInvitation,
    });
    const onSuccess = vi.fn();

    render(
      <AutharaProvider client={authara}>
        <GoogleButton
          invitationToken="invitation-token"
          invitationFlow="signup"
          onSuccess={onSuccess}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    google.configurations[0].callback({ code: "google-code" });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(acceptInvitation).toHaveBeenCalledWith({
      audience: "app",
      body: {
        code: "google-code",
        redirect_uri: window.location.origin,
        token: "invitation-token",
        flow: "signup",
      },
    });
    expect(authara.loginWithGoogle).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith({
      action: "login",
      provider: "google",
      status: "recovery-required",
      recovery,
    });
  });

  it("rejects a malformed Google invitation recovery result", async () => {
    const google = mockGoogle();
    const onError = vi.fn();
    const authara = client({
      authenticateAndAcceptInvitationWithGoogle: vi.fn().mockResolvedValue({
        status: "proof_required",
        recovery: {
          link_id: "",
          provider: "google",
          proof_methods: [],
        },
      }),
    });

    render(
      <AutharaProvider client={authara}>
        <GoogleButton invitationToken="invitation-token" onError={onError} />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    google.configurations[0].callback({ code: "google-code" });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toMatchObject({ source: "authara" });
  });

  it("reports Google cancellation separately from popup failures", async () => {
    const google = mockGoogle();
    const onCancel = vi.fn();
    const onError = vi.fn();

    render(
      <AutharaProvider client={client()}>
        <GoogleButton onCancel={onCancel} onError={onError} />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    google.configurations[0].error_callback?.({ type: "popup_closed" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    google.configurations[0].error_callback?.({
      type: "popup_failed_to_open",
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("links Apple without exposing its authorization proof", async () => {
    window.AppleID = {
      auth: {
        init: vi.fn(),
        renderButton: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: { code: "apple-code", state: "apple-state" },
        }),
      },
    };
    const authara = client();
    const onSuccess = vi.fn();
    const result = render(
      <AutharaProvider client={authara}>
        <AppleButton
          data-testid="apple-link"
          action="link"
          variant="icon"
          size="small"
          onSuccess={onSuccess}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(result.getByTestId("apple-link").dataset.autharaReady).toBe(
        "true",
      ),
    );
    fireEvent.click(result.getByTestId("apple-link").firstElementChild!);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(authara.linkCurrentUserApple).toHaveBeenCalledWith({
      body: { code: "apple-code", state: "apple-state" },
    });
    expect(onSuccess).toHaveBeenCalledWith({
      action: "link",
      provider: "apple",
    });
    expect(result.getByTestId("apple-link").style.width).toBe("36px");
    expect(result.getByTestId("apple-link").style.height).toBe("36px");
    expect(result.getByTestId("apple-link").style.borderRadius).toBe("12px");
    expect(
      result
        .getByTestId("apple-link")
        .firstElementChild?.getAttribute("data-color"),
    ).toBe("black");
    expect(
      result
        .getByTestId("apple-link")
        .firstElementChild?.getAttribute("data-border"),
    ).toBe("false");
  });

  it("forwards invitation context through Apple login", async () => {
    window.AppleID = {
      auth: {
        init: vi.fn(),
        renderButton: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: { code: "apple-code", state: "apple-state" },
        }),
      },
    };
    const authara = client();
    const onSuccess = vi.fn();
    const result = render(
      <AutharaProvider client={authara}>
        <AppleButton
          data-testid="apple-invitation"
          invitationToken="invitation-token"
          onSuccess={onSuccess}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(result.getByTestId("apple-invitation").dataset.autharaReady).toBe(
        "true",
      ),
    );
    fireEvent.click(result.getByTestId("apple-invitation").firstElementChild!);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(authara.loginWithApple).toHaveBeenCalledWith({
      audience: "app",
      body: {
        code: "apple-code",
        state: "apple-state",
        invitation_token: "invitation-token",
      },
    });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login",
        provider: "apple",
        status: "authenticated",
      }),
    );
  });

  it("uses the provider dark-mode defaults", async () => {
    mockGoogle();
    const renderAppleButton = vi.fn();
    window.AppleID = {
      auth: {
        init: vi.fn(),
        renderButton: renderAppleButton,
        signIn: vi.fn(),
      },
    };

    const result = render(
      <AutharaProvider client={client()}>
        <GoogleButton data-testid="dark-google" mode="dark" />
        <AppleButton data-testid="dark-apple" mode="dark" />
      </AutharaProvider>,
    );

    await waitFor(() => expect(renderAppleButton).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.getByTestId("dark-google").dataset.autharaReady).toBe(
        "true",
      ),
    );
    expect(result.getByTestId("dark-google").style.background).toBe("#131314");
    expect(result.getByTestId("dark-google").style.borderColor).toBe("#8e918f");
    expect(
      result
        .getByTestId("dark-apple")
        .firstElementChild?.getAttribute("data-color"),
    ).toBe("white");
    expect(
      result
        .getByTestId("dark-apple")
        .firstElementChild?.getAttribute("data-border"),
    ).toBe("false");
  });

  it("completes account recovery with Google proof", async () => {
    const google = mockGoogle();
    const authara = client();
    const onSuccess = vi.fn();

    render(
      <AutharaProvider client={authara}>
        <GoogleButton
          action="recover"
          recoveryLinkId="link-1"
          invitationToken="invitation-token"
          audience="app"
          onSuccess={onSuccess}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    google.configurations[0].callback({ code: "google-code" });

    await waitFor(() =>
      expect(
        authara.completeAccountRecoveryLinkWithGoogle,
      ).toHaveBeenCalledWith({
        linkID: "link-1",
        audience: "app",
        body: {
          code: "google-code",
          redirect_uri: window.location.origin,
          invitation_token: "invitation-token",
        },
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ action: "recover", provider: "google" }),
    );
  });

  it("completes account recovery with Apple proof", async () => {
    window.AppleID = {
      auth: {
        init: vi.fn(),
        renderButton: vi.fn(),
        signIn: vi.fn().mockResolvedValue({
          authorization: { code: "apple-code", state: "apple-state" },
        }),
      },
    };
    const authara = client();
    const onSuccess = vi.fn();
    const result = render(
      <AutharaProvider client={authara}>
        <AppleButton
          data-testid="apple-recovery"
          action="recover"
          recoveryLinkId="link-1"
          invitationToken="invitation-token"
          onSuccess={onSuccess}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(result.getByTestId("apple-recovery").dataset.autharaReady).toBe(
        "true",
      ),
    );
    fireEvent.click(result.getByTestId("apple-recovery").firstElementChild!);

    await waitFor(() =>
      expect(authara.completeAccountRecoveryLinkWithApple).toHaveBeenCalledWith(
        {
          linkID: "link-1",
          audience: "app",
          body: {
            code: "apple-code",
            state: "apple-state",
            invitation_token: "invitation-token",
          },
        },
      ),
    );
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ action: "recover", provider: "apple" }),
    );
  });

  it("passes a reauthentication challenge to Authara", async () => {
    const google = mockGoogle();
    const authara = client();

    render(
      <AutharaProvider client={authara}>
        <GoogleButton
          action="reauthenticate"
          authenticationChallengeId="challenge-1"
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    google.configurations[0].callback({ code: "google-code" });

    await waitFor(() =>
      expect(authara.reauthenticateWithGoogle).toHaveBeenCalledTimes(1),
    );
    expect(authara.reauthenticateWithGoogle).toHaveBeenCalledWith({
      body: {
        authentication_challenge_id: "challenge-1",
        code: "google-code",
        redirect_uri: window.location.origin,
      },
    });
  });

  it("normalizes structured Authara failures for button consumers", async () => {
    const google = mockGoogle();
    const authara = client({
      linkCurrentUserGoogle: vi.fn().mockRejectedValue({
        status: 428,
        code: "recent_authentication_required",
        message: "Confirm it is you.",
        authenticationChallenge: {
          id: "challenge-1",
          expires_at: "2030-01-01T00:00:00Z",
        },
      }),
    });
    const onError = vi.fn();

    render(
      <AutharaProvider client={authara}>
        <GoogleButton action="link" onError={onError} />
      </AutharaProvider>,
    );

    await waitFor(() => expect(google.configurations).toHaveLength(1));
    google.configurations[0].callback({ code: "google-code" });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "AutharaButtonError",
        source: "authara",
        status: 428,
        code: "recent_authentication_required",
        authenticationChallenge: {
          id: "challenge-1",
          expires_at: "2030-01-01T00:00:00Z",
        },
      }),
    );
  });
});
