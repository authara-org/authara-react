import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";

import type { AutharaReactClient } from "./contract.js";
import { AppleService, GoogleService } from "./services.js";

type AutharaReactContextValue = {
  apple: AppleService;
  google: GoogleService;
};

const AutharaContext = createContext<AutharaReactContextValue | null>(null);

export type AutharaProviderProps = PropsWithChildren<{
  client: AutharaReactClient;
}>;

/**
 * Owns the page-wide Google and Apple SDK configuration. Use one provider per
 * document so Google Identity Services is initialized only once.
 */
export function AutharaProvider({
  client,
  children,
}: AutharaProviderProps): React.JSX.Element {
  const value = useMemo(
    () => ({
      apple: new AppleService(client),
      google: new GoogleService(client),
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
