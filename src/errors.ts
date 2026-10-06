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

export function isAppleCancellation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("error" in error)) {
    return false;
  }
  return (
    error.error === "user_cancelled_authorize" ||
    error.error === "popup_closed_by_user"
  );
}
