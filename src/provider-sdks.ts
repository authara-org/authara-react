export type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
  state?: string;
};

export type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
  state?: string;
  click_listener?: () => void;
};

export type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        nonce: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: GoogleButtonConfiguration,
      ): void;
    };
  };
};

export type AppleConfig = {
  clientId: string;
  scope: "email";
  redirectURI: string;
  state: string;
  nonce: string;
  usePopup: true;
};

type AppleSignInResponse = {
  authorization?: { code?: string; state?: string };
};

export type AppleAuth = {
  init(options: AppleConfig): void;
  renderButton(): void;
  signIn(options?: AppleConfig): Promise<AppleSignInResponse>;
};

declare global {
  interface Window {
    google?: GoogleIdentity;
    AppleID?: { auth: AppleAuth };
  }
}

const googleIdentityURL = "https://accounts.google.com/gsi/client";
const appleIdentityBaseURL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1";

let googlePromise: Promise<GoogleIdentity> | undefined;
let googleLocale: string | undefined;
let applePromise: Promise<AppleAuth> | undefined;
let appleLocale: string | undefined;

function appendScript<T>(
  url: string,
  resolveGlobal: () => T | undefined,
  failureMessage: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${url}"]`,
    );
    const script = existing ?? document.createElement("script");
    const loaded = () => {
      const value = resolveGlobal();
      if (value) resolve(value);
      else reject(new Error(failureMessage));
    };
    const failed = () => reject(new Error(failureMessage));

    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.src = url;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export function loadGoogleIdentity(locale?: string): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googlePromise) {
    if (locale !== googleLocale) {
      return Promise.reject(
        new Error(
          "Google Identity has already been loaded with another locale.",
        ),
      );
    }
    return googlePromise;
  }

  googleLocale = locale;
  const url = locale
    ? `${googleIdentityURL}?hl=${encodeURIComponent(locale)}`
    : googleIdentityURL;
  googlePromise = appendScript(
    url,
    () => window.google,
    "Could not load Google Identity Services.",
  ).catch((error) => {
    googlePromise = undefined;
    googleLocale = undefined;
    throw error;
  });
  return googlePromise;
}

export function loadAppleIdentity(locale = "en_US"): Promise<AppleAuth> {
  if (window.AppleID?.auth) return Promise.resolve(window.AppleID.auth);
  if (applePromise) {
    if (locale !== appleLocale) {
      return Promise.reject(
        new Error(
          "Sign in with Apple has already been loaded with another locale.",
        ),
      );
    }
    return applePromise;
  }

  appleLocale = locale;
  const url = `${appleIdentityBaseURL}/${encodeURIComponent(locale)}/appleid.auth.js`;
  applePromise = appendScript(
    url,
    () => window.AppleID?.auth,
    "Could not load Sign in with Apple.",
  ).catch((error) => {
    applePromise = undefined;
    appleLocale = undefined;
    throw error;
  });
  return applePromise;
}

/** @internal Test isolation for module-level third-party script promises. */
export function resetProviderSDKsForTests(): void {
  googlePromise = undefined;
  googleLocale = undefined;
  applePromise = undefined;
  appleLocale = undefined;
}
