import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const msal = vi.hoisted(() => ({
  configurations: [] as unknown[],
  initialize: vi.fn(),
  loginPopup: vi.fn(),
}));

vi.mock("@azure/msal-browser", () => ({
  PublicClientApplication: class {
    constructor(configuration: unknown) {
      msal.configurations.push(configuration);
    }

    initialize = msal.initialize;
    loginPopup = msal.loginPopup;
  },
}));

import { runMicrosoftAction } from "./actions.js";
import type { AutharaReactClient } from "./contract.js";
import { AutharaProvider } from "./context.js";
import {
  MicrosoftButton,
  MicrosoftCredentialButton,
} from "./MicrosoftButton.js";

const session = {
  user: {
    id: "user-1",
    email: "person@example.com",
    username: "person",
    disabled: false,
    created_at: "2030-01-01T00:00:00Z",
  },
  access_token: "access-token",
  refresh_token: "refresh-token",
};

function client(
  overrides: Partial<AutharaReactClient> = {},
): AutharaReactClient {
  return {
    getCsrfToken: vi.fn().mockResolvedValue({ csrf_token: "csrf-token" }),
    getGoogleLoginOptions: vi.fn(),
    getAppleLoginOptions: vi.fn(),
    loginWithGoogle: vi.fn(),
    loginWithApple: vi.fn(),
    authenticateAndAcceptInvitationWithGoogle: vi.fn(),
    linkCurrentUserGoogle: vi.fn(),
    linkCurrentUserApple: vi.fn(),
    reauthenticateWithGoogle: vi.fn(),
    reauthenticateWithApple: vi.fn(),
    completeAccountRecoveryLinkWithGoogle: vi.fn(),
    completeAccountRecoveryLinkWithApple: vi.fn(),
    getMicrosoftLoginOptions: vi.fn().mockResolvedValue({
      client_id: "microsoft-client",
      authority: "https://login.microsoftonline.com/common",
      nonce: "microsoft-nonce",
    }),
    loginWithMicrosoft: vi.fn().mockResolvedValue(session),
    linkCurrentUserMicrosoft: vi.fn().mockResolvedValue(undefined),
    reauthenticateWithMicrosoft: vi.fn().mockResolvedValue(undefined),
    completeAccountRecoveryLinkWithMicrosoft: vi
      .fn()
      .mockResolvedValue(session),
    ...overrides,
  } as AutharaReactClient;
}

describe("Microsoft buttons", () => {
  beforeEach(() => {
    msal.configurations.length = 0;
    msal.initialize.mockReset().mockResolvedValue(undefined);
    msal.loginPopup.mockReset().mockResolvedValue({
      idToken: "microsoft-id-token",
    });
  });

  afterEach(cleanup);

  it("runs Microsoft popup login with the server nonce", async () => {
    const authara = client();
    const onSuccess = vi.fn();
    const onStart = vi.fn();
    const result = render(
      <AutharaProvider client={authara}>
        <MicrosoftButton
          data-testid="microsoft"
          action="login"
          audience="operator"
          onStart={onStart}
          onSuccess={onSuccess}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(result.getByTestId("microsoft").dataset.autharaReady).toBe("true"),
    );
    expect(result.getByTestId("microsoft").textContent).toBe(
      "Sign in with Microsoft",
    );
    fireEvent.click(result.getByTestId("microsoft"));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(msal.loginPopup).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(msal.configurations[0]).toEqual(
      expect.objectContaining({
        auth: expect.objectContaining({
          clientId: "microsoft-client",
          authority: "https://login.microsoftonline.com/common",
          redirectUri: "http://localhost:3000/auth/oauth/microsoft/redirect",
        }),
      }),
    );
    expect(msal.loginPopup).toHaveBeenCalledWith(
      expect.objectContaining({
        nonce: "microsoft-nonce",
        overrideInteractionInProgress: true,
        prompt: "select_account",
        redirectUri: "http://localhost:3000/auth/oauth/microsoft/redirect",
        scopes: ["openid", "profile", "email"],
      }),
    );
    expect(authara.loginWithMicrosoft).toHaveBeenCalledWith({
      audience: "operator",
      body: {
        credential: "microsoft-id-token",
        nonce: "microsoft-nonce",
      },
    });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ action: "login", provider: "microsoft" }),
    );
  });

  it("renders a fallback with an older browser client", async () => {
    const authara = client();
    delete authara.getMicrosoftLoginOptions;
    const onUnavailable = vi.fn();
    const result = render(
      <AutharaProvider client={authara}>
        <MicrosoftCredentialButton
          fallback={<p>Microsoft unavailable</p>}
          onCredential={() => undefined}
          onUnavailable={onUnavailable}
        />
      </AutharaProvider>,
    );

    expect(await result.findByText("Microsoft unavailable")).toBeTruthy();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("reports popup cancellation separately", async () => {
    msal.loginPopup.mockRejectedValue({ errorCode: "user_cancelled" });
    const onCancel = vi.fn();
    const onError = vi.fn();
    const result = render(
      <AutharaProvider client={client()}>
        <MicrosoftCredentialButton
          data-testid="microsoft"
          onCredential={() => undefined}
          onCancel={onCancel}
          onError={onError}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(result.getByTestId("microsoft").dataset.autharaReady).toBe("true"),
    );
    fireEvent.click(result.getByTestId("microsoft"));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports popup-open failures as errors", async () => {
    msal.loginPopup.mockRejectedValue({ errorCode: "popup_window_error" });
    const onCancel = vi.fn();
    const onError = vi.fn();
    const result = render(
      <AutharaProvider client={client()}>
        <MicrosoftCredentialButton
          data-testid="microsoft"
          onCredential={() => undefined}
          onCancel={onCancel}
          onError={onError}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(result.getByTestId("microsoft").dataset.autharaReady).toBe("true"),
    );
    fireEvent.click(result.getByTestId("microsoft"));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("rejects Microsoft authorities outside the trusted host", async () => {
    const onError = vi.fn();
    render(
      <AutharaProvider
        client={client({
          getMicrosoftLoginOptions: vi.fn().mockResolvedValue({
            client_id: "microsoft-client",
            authority: "https://attacker.example/common",
            nonce: "microsoft-nonce",
          }),
        })}
      >
        <MicrosoftCredentialButton
          onCredential={() => undefined}
          onError={onError}
        />
      </AutharaProvider>,
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(msal.configurations).toHaveLength(0);
  });

  it("renders the provider name with a CSS width", async () => {
    const result = render(
      <AutharaProvider client={client()}>
        <MicrosoftCredentialButton
          data-testid="microsoft-provider"
          variant="provider"
          width="calc(100% - 2rem)"
          onCredential={() => undefined}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect(
        result.getByTestId("microsoft-provider").dataset.autharaReady,
      ).toBe("true"),
    );
    expect(result.getByTestId("microsoft-provider").textContent).toBe(
      "Microsoft",
    );
    expect(result.getByTestId("microsoft-provider").style.width).toBe(
      "calc(100% - 2rem)",
    );
  });

  it("disables every button while the shared Microsoft runtime is in use", async () => {
    let finishPopup!: (result: { idToken: string }) => void;
    msal.loginPopup.mockReturnValue(
      new Promise((resolve) => {
        finishPopup = resolve;
      }),
    );
    const result = render(
      <AutharaProvider client={client()}>
        <MicrosoftCredentialButton
          data-testid="first"
          onCredential={() => undefined}
        />
        <MicrosoftCredentialButton
          data-testid="second"
          onCredential={() => undefined}
        />
      </AutharaProvider>,
    );

    await waitFor(() =>
      expect((result.getByTestId("first") as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    expect((result.getByTestId("second") as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(result.getByTestId("first"));
    await waitFor(() =>
      expect((result.getByTestId("second") as HTMLButtonElement).disabled).toBe(
        true,
      ),
    );

    finishPopup({ idToken: "microsoft-id-token" });
    await waitFor(() =>
      expect((result.getByTestId("second") as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
  });
});

describe("Microsoft actions", () => {
  const proof = { credential: "id-token", nonce: "nonce" };

  it("links, reauthenticates, and recovers", async () => {
    const authara = client();

    await expect(
      runMicrosoftAction(authara, { action: "link" }, proof),
    ).resolves.toEqual({ action: "link", provider: "microsoft" });
    expect(authara.linkCurrentUserMicrosoft).toHaveBeenCalledWith({
      body: proof,
    });

    await expect(
      runMicrosoftAction(
        authara,
        {
          action: "reauthenticate",
          authenticationChallengeId: "challenge-1",
        },
        proof,
      ),
    ).resolves.toEqual({
      action: "reauthenticate",
      provider: "microsoft",
    });
    expect(authara.reauthenticateWithMicrosoft).toHaveBeenCalledWith({
      body: { ...proof, authentication_challenge_id: "challenge-1" },
    });

    await expect(
      runMicrosoftAction(
        authara,
        {
          action: "recover",
          audience: "app",
          recoveryLinkId: "link-1",
          invitationToken: "invitation-token",
        },
        proof,
      ),
    ).resolves.toEqual({
      action: "recover",
      provider: "microsoft",
      session,
    });
    expect(
      authara.completeAccountRecoveryLinkWithMicrosoft,
    ).toHaveBeenCalledWith({
      linkID: "link-1",
      audience: "app",
      body: { ...proof, invitation_token: "invitation-token" },
    });
    expect(authara.getCsrfToken).toHaveBeenCalledTimes(3);
  });

  it("forwards invitation context through Microsoft login", async () => {
    const authara = client();

    await expect(
      runMicrosoftAction(
        authara,
        {
          action: "login",
          audience: "app",
          invitationToken: "invitation-token",
        },
        proof,
      ),
    ).resolves.toEqual({
      action: "login",
      provider: "microsoft",
      status: "authenticated",
      session,
    });
    expect(authara.loginWithMicrosoft).toHaveBeenCalledWith({
      audience: "app",
      body: { ...proof, invitation_token: "invitation-token" },
    });
  });
});
