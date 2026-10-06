import type { AutharaBrowserClient } from "@authara/browser";

import type { AutharaReactClient } from "../src/contract.js";

type Expect<T extends true> = T;

export type BrowserClientCompatibility = Expect<
  AutharaBrowserClient extends AutharaReactClient ? true : false
>;
