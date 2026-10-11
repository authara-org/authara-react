import type {
  AppleLoginOptions,
  AutharaReactClient,
  GoogleLoginOptions,
} from "./contract.js";
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

type GoogleHandler = (credential: GoogleCredential) => void;

export class GoogleService {
  private optionsPromise?: Promise<GoogleLoginOptions>;
  private sdkPromise?: Promise<GoogleIdentity>;

  constructor(private readonly client: AutharaReactClient) {}

  async prepare(
    locale: string | undefined,
    handler: GoogleHandler,
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
        errorHandler(
          new Error(
            error.type === "popup_closed"
              ? "Google sign-in was cancelled."
              : "Google sign-in could not be opened.",
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
