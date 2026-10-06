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
  type GoogleButtonConfiguration,
  type GoogleCredentialResponse,
  type GoogleIdentity,
} from "./provider-sdks.js";

export type GoogleCredential = {
  credential: string;
  nonce: string;
  selectBy?: string;
};

export type AppleAuthorization = {
  code: string;
  state: string;
};

type GoogleHandler = (credential: GoogleCredential) => void;

let stateSequence = 0;

function nextState(): string {
  stateSequence += 1;
  return `authara-google-${stateSequence}`;
}

export class GoogleService {
  private optionsPromise?: Promise<GoogleLoginOptions>;
  private sdkPromise?: Promise<GoogleIdentity>;
  private handlers = new Map<string, GoogleHandler>();
  private activeState?: string;

  constructor(private readonly client: AutharaReactClient) {}

  async render(
    element: HTMLElement,
    configuration: GoogleButtonConfiguration,
    locale: string | undefined,
    handler: GoogleHandler,
  ): Promise<() => void> {
    const options = await this.options();
    const google = await this.sdk(locale, options);
    const state = nextState();
    this.handlers.set(state, handler);

    google.accounts.id.renderButton(element, {
      ...configuration,
      locale,
      state,
      click_listener: () => {
        this.activeState = state;
      },
    });

    return () => {
      this.handlers.delete(state);
      if (this.activeState === state) this.activeState = undefined;
    };
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

  private sdk(
    locale: string | undefined,
    options: GoogleLoginOptions,
  ): Promise<GoogleIdentity> {
    this.sdkPromise ??= loadGoogleIdentity(locale).then((google) => {
      google.accounts.id.initialize({
        client_id: options.client_id,
        nonce: options.nonce,
        callback: (response: GoogleCredentialResponse) => {
          if (!response.credential) return;
          const state = response.state ?? this.activeState;
          if (!state) return;
          this.handlers.get(state)?.({
            credential: response.credential,
            nonce: options.nonce,
            selectBy: response.select_by,
          });
        },
      });
      return google;
    });
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
