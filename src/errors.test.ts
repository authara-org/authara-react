import { describe, expect, it } from "vitest";

import { toAutharaButtonError } from "./errors.js";

describe("Authara button errors", () => {
  it("keeps error codes declared by the Core contract", () => {
    const error = toAutharaButtonError(
      {
        name: "AutharaApiError",
        status: 428,
        code: "recent_authentication_required",
        message: "Confirm it is you.",
      },
      "Linking failed.",
      "authara",
    );

    expect(error).toMatchObject({
      code: "recent_authentication_required",
      serverCode: undefined,
      source: "authara",
      status: 428,
    });
  });

  it("surfaces an unknown future server code without lying to consumers", () => {
    const error = toAutharaButtonError(
      {
        name: "AutharaApiError",
        status: 409,
        code: "future_authentication_state",
        message: "A newer client may understand this response.",
      },
      "Login failed.",
      "authara",
    );

    expect(error).toMatchObject({
      code: "unknown_authara_error",
      serverCode: "future_authentication_state",
      source: "authara",
      status: 409,
    });
  });

  it("preserves account recovery details from the browser client", () => {
    const error = toAutharaButtonError(
      {
        name: "AutharaApiError",
        status: 409,
        code: "account_link_required",
        message: "Prove ownership of the existing account.",
        details: {
          recovery: {
            link_id: "link-1",
            provider: "apple",
            proof_methods: ["google"],
          },
        },
      },
      "Login failed.",
      "authara",
    );

    expect(error.recovery).toEqual({
      link_id: "link-1",
      provider: "apple",
      proof_methods: ["google"],
    });
  });
});
