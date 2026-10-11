import type { AutharaBrowserClient } from "@authara/browser";

import type { AutharaReactClient } from "../src/contract.js";

declare const browserClient: AutharaBrowserClient;
export const browserClientCompatibility: AutharaReactClient = browserClient;
