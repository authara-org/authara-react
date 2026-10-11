import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";

import type { AutharaReactClient } from "./contract.js";
import { AppleService, GoogleService, MicrosoftService } from "./services.js";

type AutharaReactContextValue = {
  apple: AppleService;
  client: AutharaReactClient;
  google: GoogleService;
  microsoft: MicrosoftService;
};

const AutharaContext = createContext<AutharaReactContextValue | null>(null);

export type AutharaProviderProps = PropsWithChildren<{
  client: AutharaReactClient;
}>;

/**
 * Owns the page-wide external-provider SDK configuration.
 */
export function AutharaProvider({
  client,
  children,
}: AutharaProviderProps): React.JSX.Element {
  const value = useMemo(
    () => ({
      apple: new AppleService(client),
      client,
      google: new GoogleService(client),
      microsoft: new MicrosoftService(client),
    }),
    [client],
  );

  return (
    <AutharaContext.Provider value={value}>{children}</AutharaContext.Provider>
  );
}

export function useAutharaServices(): AutharaReactContextValue {
  const value = useContext(AutharaContext);
  if (!value) {
    throw new Error("Authara buttons must be rendered inside AutharaProvider.");
  }
  return value;
}
