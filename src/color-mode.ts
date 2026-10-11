import { useSyncExternalStore } from "react";

export type AutharaColorMode = "dark" | "light" | "system";
export type ResolvedAutharaColorMode = Exclude<AutharaColorMode, "system">;

const darkModeQuery = "(prefers-color-scheme: dark)";

function systemColorMode(): ResolvedAutharaColorMode {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia(darkModeQuery).matches ? "dark" : "light";
}

function subscribeSystemColorMode(update: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(darkModeQuery);
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}

const noSubscription = () => () => {};
const serverColorMode = (): ResolvedAutharaColorMode => "light";

export function useResolvedAutharaColorMode(
  mode: AutharaColorMode,
): ResolvedAutharaColorMode {
  const systemMode = useSyncExternalStore(
    mode === "system" ? subscribeSystemColorMode : noSubscription,
    systemColorMode,
    serverColorMode,
  );

  return mode === "system" ? systemMode : mode;
}
