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
export type AutharaProviderName = "apple" | "google" | "microsoft";
export type AutharaInvitationFlow = "login" | "signup";
export type AutharaAccountRecoveryLink = Omit<
  BrowserAccountRecoveryLink,
  "provider" | "proof_methods"
> & {
  provider: AutharaProviderName;
  proof_methods: Array<"password" | AutharaProviderName>;
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

export interface MicrosoftLoginOptions {
  client_id: string;
  authority: string;
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

export type MicrosoftProof = {
  credential: string;
  nonce: string;
};

/**
 * The generated @authara/browser contract slice used by the React components.
 * AutharaBrowserClient satisfies the required provider methods from the
 * released Core contract. Microsoft remains optional during SDK rollout.
 */
export interface AutharaReactClient {
  getCsrfToken(): Promise<unknown>;
  getGoogleLoginOptions(): Promise<GoogleLoginOptions>;
  getAppleLoginOptions(): Promise<AppleLoginOptions>;
  authenticateAndAcceptInvitationWithGoogle(options: {
    audience?: "app";
    body: GoogleProof & {
      token: string;
      flow: AutharaInvitationFlow;
    };
  }): Promise<{
    status: "authenticated" | "proof_required";
    session?: AuthSession;
    recovery?: AutharaAccountRecoveryLink;
  }>;
  loginWithGoogle(options: {
    audience?: AutharaAudience;
    body: GoogleProof;
  }): Promise<AuthSession>;
  loginWithApple(options: {
    audience?: AutharaAudience;
    body: AppleProof & { invitation_token?: string };
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
    audience?: "app";
    body: GoogleProof & { invitation_token?: string };
  }): Promise<AuthSession>;
  completeAccountRecoveryLinkWithApple(options: {
    linkID: AutharaAccountRecoveryLink["link_id"];
    audience?: "app";
    body: AppleProof & { invitation_token?: string };
  }): Promise<AuthSession>;

  // Optional until @authara/browser is regenerated from the Core contract that
  // introduced Microsoft. The button renders its fallback on older clients.
  getMicrosoftLoginOptions?(): Promise<MicrosoftLoginOptions>;
  loginWithMicrosoft?(options: {
    audience?: AutharaAudience;
    body: MicrosoftProof & { invitation_token?: string };
  }): Promise<AuthSession>;
  linkCurrentUserMicrosoft?(options: { body: MicrosoftProof }): Promise<void>;
  reauthenticateWithMicrosoft?(options: {
    body: MicrosoftProof & { authentication_challenge_id: string };
  }): Promise<void>;
  completeAccountRecoveryLinkWithMicrosoft?(options: {
    linkID: AutharaAccountRecoveryLink["link_id"];
    audience?: "app";
    body: MicrosoftProof & { invitation_token?: string };
  }): Promise<AuthSession>;
}

export type AutharaLoginSuccess<P extends AutharaProviderName> = {
  action: "login";
  provider: P;
  session: AuthSession;
};

export type AutharaInvitationLoginResult<P extends AutharaProviderName> =
  | {
      action: "login";
      provider: P;
      status: "authenticated";
      session?: AuthSession;
    }
  | {
      action: "login";
      provider: P;
      status: "recovery-required";
      recovery: AutharaAccountRecoveryLink;
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

export type AutharaActionResult<P extends AutharaProviderName> =
  AutharaActionSuccess<P> | AutharaInvitationLoginResult<P>;

export type AutharaActionProps<P extends AutharaProviderName> =
  | {
      action?: "login";
      audience?: AutharaAudience;
      authenticationChallengeId?: never;
      recoveryLinkId?: never;
      invitationToken?: never;
      invitationFlow?: never;
      onSuccess?: (result: AutharaLoginSuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaLoginErrorCode>) => void;
    }
  | {
      action?: "login";
      audience?: "app";
      authenticationChallengeId?: never;
      recoveryLinkId?: never;
      invitationToken: string;
      invitationFlow?: AutharaInvitationFlow;
      onSuccess?: (
        result: AutharaInvitationLoginResult<P>,
      ) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaLoginErrorCode>) => void;
    }
  | {
      action: "link";
      audience?: never;
      authenticationChallengeId?: never;
      recoveryLinkId?: never;
      invitationToken?: never;
      invitationFlow?: never;
      onSuccess?: (result: AutharaLinkSuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaLinkErrorCode>) => void;
    }
  | {
      action: "reauthenticate";
      audience?: never;
      authenticationChallengeId: string;
      recoveryLinkId?: never;
      invitationToken?: never;
      invitationFlow?: never;
      onSuccess?: (
        result: AutharaReauthenticationSuccess<P>,
      ) => MaybePromise<void>;
      onError?: (
        error: AutharaButtonError<AutharaReauthenticationErrorCode>,
      ) => void;
    }
  | {
      action: "recover";
      audience?: "app";
      authenticationChallengeId?: never;
      recoveryLinkId: AutharaAccountRecoveryLink["link_id"];
      invitationToken?: string;
      invitationFlow?: never;
      onSuccess?: (result: AutharaRecoverySuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaRecoveryErrorCode>) => void;
    };

export type MaybePromise<T> = T | Promise<T>;
