import type { AutharaAccountRecoveryLink } from "./contract.js";

import {
  autharaActionErrorCodes,
  type AutharaContractErrorCode,
} from "./generated-error-codes.js";

export function isProviderUnavailable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  );
}

export function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return new Error(error.message.trim());
  }
  return new Error(fallback);
}

export type AutharaButtonErrorSource =
  "authara" | "provider" | "configuration" | "consumer";

export type AutharaLocalErrorCode =
  "csrf_token_missing" | "unknown_authara_error";

export type AutharaLoginErrorCode =
  AutharaContractErrorCode<"login"> | AutharaLocalErrorCode;

export type AutharaLinkErrorCode =
  AutharaContractErrorCode<"link"> | AutharaLocalErrorCode;

export type AutharaReauthenticationErrorCode =
  AutharaContractErrorCode<"reauthenticate"> | AutharaLocalErrorCode;

export type AutharaRecoveryErrorCode =
  AutharaContractErrorCode<"recover"> | AutharaLocalErrorCode;

export type AutharaButtonErrorCode =
  | AutharaLoginErrorCode
  | AutharaLinkErrorCode
  | AutharaReauthenticationErrorCode
  | AutharaRecoveryErrorCode;

const knownAutharaErrorCodes = new Set<string>([
  ...autharaActionErrorCodes.login,
  ...autharaActionErrorCodes.link,
  ...autharaActionErrorCodes.reauthenticate,
  ...autharaActionErrorCodes.recover,
  "csrf_token_missing",
]);

export type AutharaAuthenticationChallenge = {
  id: string;
  expires_at: string;
};

export class AutharaButtonError<
  Code extends string = AutharaButtonErrorCode,
> extends Error {
  readonly source: AutharaButtonErrorSource;
  readonly code?: Code;
  readonly serverCode?: string;
  readonly status?: number;
  readonly authenticationChallenge?: AutharaAuthenticationChallenge;
  readonly reauthenticateUrl?: string;
  readonly recovery?: AutharaAccountRecoveryLink;
  readonly originalError: unknown;

  constructor(
    message: string,
    source: AutharaButtonErrorSource,
    originalError: unknown,
    metadata: {
      code?: Code;
      serverCode?: string;
      status?: number;
      authenticationChallenge?: AutharaAuthenticationChallenge;
      reauthenticateUrl?: string;
      recovery?: AutharaAccountRecoveryLink;
    } = {},
  ) {
    super(message);
    this.name = "AutharaButtonError";
    this.source = source;
    this.originalError = originalError;
    this.code = metadata.code;
    this.serverCode = metadata.serverCode;
    this.status = metadata.status;
    this.authenticationChallenge = metadata.authenticationChallenge;
    this.reauthenticateUrl = metadata.reauthenticateUrl;
    this.recovery = metadata.recovery;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function challengeFrom(error: Record<string, unknown> | undefined) {
  const details = record(error?.details);
  const candidate =
    record(error?.authenticationChallenge) ??
    record(details?.authentication_challenge);
  if (
    typeof candidate?.id !== "string" ||
    typeof candidate.expires_at !== "string"
  ) {
    return undefined;
  }
  return { id: candidate.id, expires_at: candidate.expires_at };
}

function recoveryFrom(
  error: Record<string, unknown> | undefined,
): AutharaAccountRecoveryLink | undefined {
  const details = record(error?.details);
  const candidate = record(error?.recovery) ?? record(details?.recovery);
  if (
    typeof candidate?.link_id !== "string" ||
    !candidate.link_id ||
    typeof candidate.provider !== "string" ||
    !candidate.provider ||
    !Array.isArray(candidate.proof_methods) ||
    !candidate.proof_methods.every((method) => typeof method === "string")
  ) {
    return undefined;
  }
  return {
    link_id: candidate.link_id,
    provider: candidate.provider as AutharaAccountRecoveryLink["provider"],
    proof_methods:
      candidate.proof_methods as AutharaAccountRecoveryLink["proof_methods"],
  };
}

export function toAutharaButtonError(
  error: unknown,
  fallback: string,
  defaultSource: AutharaButtonErrorSource,
): AutharaButtonError {
  if (error instanceof AutharaButtonError) return error;

  const value = record(error);
  const details = record(value?.details);
  const nestedError = record(details?.error);
  const status = typeof value?.status === "number" ? value.status : undefined;
  const rawCode =
    typeof value?.code === "string"
      ? value.code
      : typeof nestedError?.code === "string"
        ? nestedError.code
        : value?.name === "AutharaCSRFError"
          ? "csrf_token_missing"
          : undefined;
  const autharaFailure =
    status !== undefined ||
    details !== undefined ||
    value?.name === "AutharaApiError" ||
    value?.name === "AutharaCSRFError";
  const source = autharaFailure ? "authara" : defaultSource;
  const normalized = toError(error, fallback);
  const reauthenticateUrl =
    typeof value?.reauthenticateUrl === "string"
      ? value.reauthenticateUrl
      : typeof details?.reauthenticate_url === "string"
        ? details.reauthenticate_url
        : undefined;
  const knownCode =
    rawCode !== undefined && knownAutharaErrorCodes.has(rawCode);

  return new AutharaButtonError(normalized.message, source, error, {
    code:
      source === "authara"
        ? ((knownCode
            ? rawCode
            : "unknown_authara_error") as AutharaButtonErrorCode)
        : undefined,
    serverCode: source === "authara" && !knownCode ? rawCode : undefined,
    status,
    authenticationChallenge: challengeFrom(value),
    reauthenticateUrl,
    recovery: recoveryFrom(value),
  });
}

export function isAutharaButtonError(
  error: unknown,
): error is AutharaButtonError {
  return error instanceof AutharaButtonError;
}

export function isAppleCancellation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("error" in error)) {
    return false;
  }
  return (
    error.error === "user_cancelled_authorize" ||
    error.error === "popup_closed_by_user"
  );
}

export function isMicrosoftCancellation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("errorCode" in error)) {
    return false;
  }
  return error.errorCode === "user_cancelled";
}
