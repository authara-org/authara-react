import { StrictMode } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppleButton } from "./AppleButton.js";
import type { AutharaReactClient } from "./contract.js";
import { AutharaProvider } from "./context.js";
import { GoogleButton } from "./GoogleButton.js";
import {
  resetProviderSDKsForTests,
  type GoogleButtonConfiguration,
  type GoogleCredentialResponse,
} from "./provider-sdks.js";

function client(
  overrides: Partial<AutharaReactClient> = {},
): AutharaReactClient {
  return {
    getGoogleLoginOptions: vi.fn().mockResolvedValue({
      client_id: "google-client",
      nonce: "google-nonce",
    }),
    getAppleLoginOptions: vi.fn().mockResolvedValue({
      client_id: "apple-client",
      redirect_uri: "https://auth.example.com/auth/oauth/apple/callback",
      state: "apple-state",
      nonce: "apple-nonce",
    }),
    ...overrides,
  };
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
      render(<GoogleButton onCredential={() => undefined} />),
    ).toThrow("Authara buttons must be rendered inside AutharaProvider.");
  });

  it("initializes Google once and routes multiple button credentials", async () => {
    let callback: ((response: GoogleCredentialResponse) => void) | undefined;
    const rendered: GoogleButtonConfiguration[] = [];
    const initialize = vi.fn((options) => {
      callback = options.callback;
    });
    window.google = {
      accounts: {
        id: {
          initialize,
          renderButton: vi.fn((_parent, options) => rendered.push(options)),
        },
      },
    };
    const first = vi.fn();
    const second = vi.fn();
    const authara = client();

    render(
      <StrictMode>
        <AutharaProvider client={authara}>
          <GoogleButton onCredential={first} />
          <GoogleButton onCredential={second} />
        </AutharaProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(rendered).toHaveLength(4));
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(authara.getGoogleLoginOptions).toHaveBeenCalledTimes(1);

    const activeButton = rendered.at(-1)!;
    activeButton.click_listener?.();
    callback?.({
      credential: "google-credential",
      select_by: "btn",
      state: activeButton.state,
    });

    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({
      credential: "google-credential",
      nonce: "google-nonce",
      selectBy: "btn",
    });
  });

  it("renders a fallback when Google is disabled in Authara", async () => {
    const onUnavailable = vi.fn();
    const authara = client({
      getGoogleLoginOptions: vi.fn().mockRejectedValue({ status: 404 }),
    });
    const result = render(
      <AutharaProvider client={authara}>
        <GoogleButton
          fallback={<p>Google unavailable</p>}
          onCredential={() => undefined}
          onUnavailable={onUnavailable}
        />
      </AutharaProvider>,
    );

    expect(await result.findByText("Google unavailable")).toBeTruthy();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
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
        redirect_uri: "https://auth.example.com/auth/oauth/apple/callback",
        state: "render-state",
        nonce: "render-nonce",
      })
      .mockResolvedValueOnce({
        client_id: "apple-client",
        redirect_uri: "https://auth.example.com/auth/oauth/apple/callback",
        state: "fresh-state",
        nonce: "fresh-nonce",
      });
    const onAuthorization = vi.fn();
    const result = render(
      <AutharaProvider client={client({ getAppleLoginOptions })}>
        <AppleButton data-testid="apple" onAuthorization={onAuthorization} />
      </AutharaProvider>,
    );

    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    fireEvent.click(result.getByTestId("apple").firstElementChild!);

    await waitFor(() => expect(onAuthorization).toHaveBeenCalledTimes(1));
    expect(getAppleLoginOptions).toHaveBeenCalledTimes(2);
    expect(signIn).toHaveBeenCalledWith({
      clientId: "apple-client",
      scope: "email",
      redirectURI: "https://auth.example.com/auth/oauth/apple/callback",
      state: "fresh-state",
      nonce: "fresh-nonce",
      usePopup: true,
    });
    expect(onAuthorization).toHaveBeenCalledWith({
      code: "apple-code",
      state: "fresh-state",
    });
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
        <AppleButton
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
    let callback: ((response: GoogleCredentialResponse) => void) | undefined;
    let button: GoogleButtonConfiguration | undefined;
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((options) => {
            callback = options.callback;
          }),
          renderButton: vi.fn((_parent, options) => {
            button = options;
          }),
        },
      },
    };
    const onCredential = vi.fn();
    render(
      <AutharaProvider client={client()}>
        <GoogleButton disabled onCredential={onCredential} />
      </AutharaProvider>,
    );

    await waitFor(() => expect(button).toBeDefined());
    button?.click_listener?.();
    callback?.({ credential: "ignored", state: button?.state });
    await Promise.resolve();
    expect(onCredential).not.toHaveBeenCalled();
  });
});
