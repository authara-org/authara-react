import type {
  AppleLoginOptions,
  AutharaReactClient,
  GoogleLoginOptions,
  MicrosoftLoginOptions,
} from "./contract.js";
import type { AuthenticationResult, PopupRequest } from "@azure/msal-browser";
import {
  loadAppleIdentity,
  loadGoogleIdentity,
  type AppleAuth,
  type AppleConfig,
  type GoogleIdentity,
} from "./provider-sdks.js";

export type GoogleCredential = {
  code: string;
  redirect_uri: string;
};

export type AppleAuthorization = {
  code: string;
  state: string;
};

export type MicrosoftCredential = {
  credential: string;
  nonce: string;
};

type MicrosoftApplication = {
  loginPopup(request: PopupRequest): Promise<AuthenticationResult>;
};

type MicrosoftRuntime = {
  application: MicrosoftApplication;
  options: MicrosoftLoginOptions;
  redirectUri: string;
};

type GoogleHandler = (credential: GoogleCredential) => void;

export class GoogleService {
  private optionsPromise?: Promise<GoogleLoginOptions>;
  private sdkPromise?: Promise<GoogleIdentity>;

  constructor(private readonly client: AutharaReactClient) {}

  async prepare(
    locale: string | undefined,
    handler: GoogleHandler,
    cancelHandler: () => void,
    errorHandler: (error: Error) => void,
  ): Promise<() => void> {
    const options = await this.options();
    const google = await this.sdk(locale);
    const client = google.accounts.oauth2.initCodeClient({
      client_id: options.client_id,
      scope: "openid email profile",
      ux_mode: "popup",
      select_account: true,
      callback: (response) => {
        if (response.error) {
          errorHandler(new Error(response.error_description || response.error));
          return;
        }
        if (!response.code) {
          errorHandler(
            new Error("Google did not return an authorization code."),
          );
          return;
        }
        handler({ code: response.code, redirect_uri: window.location.origin });
      },
      error_callback: (error) => {
        if (error.type === "popup_closed") {
          cancelHandler();
          return;
        }
        errorHandler(
          new Error(
            error.type === "popup_failed_to_open"
              ? "Google sign-in popup could not be opened."
              : "Google sign-in failed.",
          ),
        );
      },
    });
    return () => client.requestCode();
  }

  private options(): Promise<GoogleLoginOptions> {
    this.optionsPromise ??= this.client
      .getGoogleLoginOptions()
      .catch((error) => {
        this.optionsPromise = undefined;
        throw error;
      });
    return this.optionsPromise;
  }

  private sdk(locale: string | undefined): Promise<GoogleIdentity> {
    this.sdkPromise ??= loadGoogleIdentity(locale);
    return this.sdkPromise;
  }
}

function appleConfig(options: AppleLoginOptions): AppleConfig {
  assertSameOriginCallback(options.redirect_uri, "/auth/oauth/apple/callback");
  return {
    clientId: options.client_id,
    scope: "email",
    redirectURI: options.redirect_uri,
    state: options.state,
    nonce: options.nonce,
    usePopup: true,
  };
}

export class AppleService {
  private renderOptionsPromise?: Promise<AppleLoginOptions>;
  private renderQueue: Promise<void> = Promise.resolve();

  constructor(private readonly client: AutharaReactClient) {}

  async render(element: HTMLElement, locale: string): Promise<void> {
    const [auth, options] = await Promise.all([
      loadAppleIdentity(locale),
      this.renderOptions(),
    ]);

    const rendering = this.renderQueue.then(() =>
      this.renderOfficialButton(auth, options, element),
    );
    this.renderQueue = rendering.catch(() => undefined);
    await rendering;
  }

  async authorize(locale: string): Promise<AppleAuthorization> {
    const [auth, options] = await Promise.all([
      loadAppleIdentity(locale),
      this.client.getAppleLoginOptions(),
    ]);
    const result = await auth.signIn(appleConfig(options));
    const { code, state } = result.authorization ?? {};
    if (!code || !state) {
      throw new Error("Apple did not return an authorization code and state.");
    }
    return { code, state };
  }

  private renderOptions(): Promise<AppleLoginOptions> {
    this.renderOptionsPromise ??= this.client
      .getAppleLoginOptions()
      .catch((error) => {
        this.renderOptionsPromise = undefined;
        throw error;
      });
    return this.renderOptionsPromise;
  }

  private renderOfficialButton(
    auth: AppleAuth,
    options: AppleLoginOptions,
    element: HTMLElement,
  ): void {
    const existing = document.getElementById("appleid-signin");
    existing?.removeAttribute("id");
    element.id = "appleid-signin";
    try {
      auth.init(appleConfig(options));
      auth.renderButton();
    } finally {
      element.removeAttribute("id");
    }
  }
}

export class MicrosoftService {
  private optionsPromise?: Promise<MicrosoftLoginOptions>;
  private runtime?: MicrosoftRuntime;
  private runtimePromise?: Promise<MicrosoftRuntime>;
  private ready = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly client: AutharaReactClient) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly isReady = (): boolean => this.ready;

  async prepare(): Promise<void> {
    if (this.runtime) return;
    this.runtimePromise ??= Promise.all([
      this.options(),
      import("@azure/msal-browser"),
    ])
      .then(async ([options, { PublicClientApplication }]) => {
        assertMicrosoftAuthority(options.authority);
        const redirectUri = `${window.location.origin}/auth/oauth/microsoft/redirect`;
        const application = new PublicClientApplication({
          auth: {
            clientId: options.client_id,
            authority: options.authority,
            redirectUri,
          },
          cache: { cacheLocation: "sessionStorage" },
        });
        await application.initialize();
        this.runtime = { application, options, redirectUri };
        this.setReady(true);
        return this.runtime;
      })
      .catch((error) => {
        this.runtimePromise = undefined;
        throw error;
      });
    await this.runtimePromise;
  }

  authorize(): Promise<MicrosoftCredential> {
    const runtime = this.runtime;
    if (!runtime) {
      return Promise.reject(
        new Error("Microsoft authentication is still loading."),
      );
    }
    this.runtime = undefined;
    this.runtimePromise = undefined;
    this.optionsPromise = undefined;
    this.setReady(false);
    const resultPromise = runtime.application.loginPopup({
      scopes: ["openid", "profile", "email"],
      nonce: runtime.options.nonce,
      prompt: "select_account",
      redirectUri: runtime.redirectUri,
      overrideInteractionInProgress: true,
    });
    return resultPromise.then((result) => {
      if (!result.idToken) {
        throw new Error("Microsoft did not return an ID token.");
      }
      return {
        credential: result.idToken,
        nonce: runtime.options.nonce,
      };
    });
  }

  private options(): Promise<MicrosoftLoginOptions> {
    if (!this.client.getMicrosoftLoginOptions) {
      return Promise.reject({
        status: 404,
        message:
          "This @authara/browser client does not include Microsoft authentication.",
      });
    }
    this.optionsPromise ??= this.client
      .getMicrosoftLoginOptions()
      .catch((error) => {
        this.optionsPromise = undefined;
        throw error;
      });
    return this.optionsPromise;
  }

  private setReady(ready: boolean): void {
    if (this.ready === ready) return;
    this.ready = ready;
    for (const listener of this.listeners) listener();
  }
}

function assertSameOriginCallback(value: string, expectedPath: string): void {
  let callback: URL;
  try {
    callback = new URL(value);
  } catch {
    throw new Error("Authara returned an invalid provider callback URL.");
  }
  if (
    callback.origin !== window.location.origin ||
    callback.pathname !== expectedPath ||
    callback.username !== "" ||
    callback.password !== "" ||
    callback.search !== "" ||
    callback.hash !== ""
  ) {
    throw new Error("Authara returned an invalid provider callback URL.");
  }
}

function assertMicrosoftAuthority(value: string): void {
  let authority: URL;
  try {
    authority = new URL(value);
  } catch {
    throw new Error("Authara returned an invalid Microsoft authority.");
  }
  if (
    authority.origin !== "https://login.microsoftonline.com" ||
    authority.username !== "" ||
    authority.password !== "" ||
    authority.search !== "" ||
    authority.hash !== ""
  ) {
    throw new Error("Authara returned an invalid Microsoft authority.");
  }
}
