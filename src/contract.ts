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

/**
 * The generated @authara/browser contract slice used by the React components.
 * AutharaBrowserClient satisfies this interface once both providers are
 * available in the released Core contract.
 */
export interface AutharaReactClient {
  getGoogleLoginOptions(): Promise<GoogleLoginOptions>;
  getAppleLoginOptions(): Promise<AppleLoginOptions>;
}

export type MaybePromise<T> = T | Promise<T>;
