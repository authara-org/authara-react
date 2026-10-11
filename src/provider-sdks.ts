export type GoogleCodeResponse = {
  code?: string;
  error?: string;
  error_description?: string;
};

export type GoogleCodeClient = { requestCode(): void };

export type GoogleCodeClientConfiguration = {
  client_id: string;
  scope: string;
  ux_mode: "popup";
  select_account: boolean;
  callback: (response: GoogleCodeResponse) => void;
  error_callback: (error: { type?: string }) => void;
};

export type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "light" | "dark" | "neutral";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
};

export type GoogleIdentity = {
  accounts: {
    oauth2: {
      initCodeClient(options: GoogleCodeClientConfiguration): GoogleCodeClient;
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
    const failed = () => {
      script.remove();
      reject(new Error(failureMessage));
    };
    const loaded = () => {
      const value = resolveGlobal();
      if (value) resolve(value);
      else failed();
    };

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
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
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
