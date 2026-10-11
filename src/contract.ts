import type {
  AccountRecoveryLink as BrowserAccountRecoveryLink,
  AuthSession,
} from "@authara/browser";
import type {
  AutharaButtonError,
  AutharaLinkErrorCode,
  AutharaLoginErrorCode,
  AutharaRecoveryErrorCode,
  AutharaReauthenticationErrorCode,
} from "./errors.js";

export type AutharaAudience = "app" | "admin" | "operator";
export type AutharaAction = "login" | "link" | "reauthenticate" | "recover";
export type AutharaProviderName = "apple" | "google";
export type AutharaAccountRecoveryLink = BrowserAccountRecoveryLink & {
  provider: AutharaProviderName;
};

export interface GoogleLoginOptions {
  client_id: string;
  nonce: string;
}

export interface AppleLoginOptions {
  client_id: string;
  redirect_uri: string;
  state: string;
  nonce: string;
}

export type GoogleProof = {
  code: string;
  redirect_uri: string;
};

export type AppleProof = {
  code: string;
  state: string;
};

/**
 * The generated @authara/browser contract slice used by the React components.
 * AutharaBrowserClient satisfies this interface once both providers are
 * available in the released Core contract.
 */
export interface AutharaReactClient {
  getCsrfToken(): Promise<unknown>;
  getGoogleLoginOptions(): Promise<GoogleLoginOptions>;
  getAppleLoginOptions(): Promise<AppleLoginOptions>;
  loginWithGoogle(options: {
    audience?: AutharaAudience;
    body: GoogleProof;
  }): Promise<AuthSession>;
  loginWithApple(options: {
    audience?: AutharaAudience;
    body: AppleProof;
  }): Promise<AuthSession>;
  linkCurrentUserGoogle(options: { body: GoogleProof }): Promise<void>;
  linkCurrentUserApple(options: { body: AppleProof }): Promise<void>;
  reauthenticateWithGoogle(options: {
    body: GoogleProof & { authentication_challenge_id: string };
  }): Promise<void>;
  reauthenticateWithApple(options: {
    body: AppleProof & { authentication_challenge_id: string };
  }): Promise<void>;
  completeAccountRecoveryLinkWithGoogle(options: {
    linkID: AutharaAccountRecoveryLink["link_id"];
    audience?: AutharaAudience;
    body: GoogleProof;
  }): Promise<AuthSession>;
  completeAccountRecoveryLinkWithApple(options: {
    linkID: AutharaAccountRecoveryLink["link_id"];
    audience?: AutharaAudience;
    body: AppleProof;
  }): Promise<AuthSession>;
}

export type AutharaLoginSuccess<P extends AutharaProviderName> = {
  action: "login";
  provider: P;
  session: AuthSession;
};

export type AutharaLinkSuccess<P extends AutharaProviderName> = {
  action: "link";
  provider: P;
};

export type AutharaReauthenticationSuccess<P extends AutharaProviderName> = {
  action: "reauthenticate";
  provider: P;
};

export type AutharaRecoverySuccess<P extends AutharaProviderName> = {
  action: "recover";
  provider: P;
  session: AuthSession;
};

export type AutharaActionSuccess<P extends AutharaProviderName> =
  | AutharaLoginSuccess<P>
  | AutharaLinkSuccess<P>
  | AutharaReauthenticationSuccess<P>
  | AutharaRecoverySuccess<P>;

export type AutharaActionProps<P extends AutharaProviderName> =
  | {
      action?: "login";
      audience?: AutharaAudience;
      authenticationChallengeId?: never;
      recoveryLinkId?: never;
      onSuccess?: (result: AutharaLoginSuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaLoginErrorCode>) => void;
    }
  | {
      action: "link";
      audience?: never;
      authenticationChallengeId?: never;
      recoveryLinkId?: never;
      onSuccess?: (result: AutharaLinkSuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaLinkErrorCode>) => void;
    }
  | {
      action: "reauthenticate";
      audience?: never;
      authenticationChallengeId: string;
      recoveryLinkId?: never;
      onSuccess?: (
        result: AutharaReauthenticationSuccess<P>,
      ) => MaybePromise<void>;
      onError?: (
        error: AutharaButtonError<AutharaReauthenticationErrorCode>,
      ) => void;
    }
  | {
      action: "recover";
      audience?: AutharaAudience;
      authenticationChallengeId?: never;
      recoveryLinkId: AutharaAccountRecoveryLink["link_id"];
      onSuccess?: (result: AutharaRecoverySuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaRecoveryErrorCode>) => void;
    };

export type MaybePromise<T> = T | Promise<T>;
