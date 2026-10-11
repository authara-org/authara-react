import type { ReactNode } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../playground/App.js";

const session = {
  user: { id: "user-1", email: "person@example.com" },
  access_token: "access-token",
  refresh_token: "refresh-token",
};

const mocks = vi.hoisted(() => ({
  client: {
    checkRecentAuthentication: vi.fn(),
    getCsrfToken: vi.fn(),
    getCurrentAccount: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock("@authara/browser", () => ({
  AutharaBrowserClient: vi.fn(function AutharaBrowserClient() {
    return mocks.client;
  }),
}));

vi.mock("@authara/react", () => ({
  AutharaProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  GoogleButton: ({
    action,
    mode,
    onError,
    onSuccess,
  }: {
    action: "login" | "recover";
    mode?: string;
    onError?: (error: unknown) => void;
    onSuccess?: (result: unknown) => void;
  }) => (
    <button
      type="button"
      data-color-mode={mode}
      onClick={() =>
        action === "recover"
          ? onSuccess?.({ action, provider: "google", session })
          : onError?.({
              code: "account_link_required",
              message: "Account proof required.",
              source: "authara",
              status: 409,
              recovery: {
                link_id: "google-link",
                provider: "google",
                proof_methods: ["apple"],
              },
            })
      }
    >
      {action === "recover" ? "Prove with Google" : "Attempt Google login"}
    </button>
  ),
  AppleButton: ({
    action,
    mode,
    onError,
    onSuccess,
  }: {
    action: "login" | "recover";
    mode?: string;
    onError?: (error: unknown) => void;
    onSuccess?: (result: unknown) => void;
  }) => (
    <button
      type="button"
      data-color-mode={mode}
      onClick={() =>
        action === "recover"
          ? onSuccess?.({ action, provider: "apple", session })
          : onError?.({
              code: "account_link_required",
              message: "Account proof required.",
              source: "authara",
              status: 409,
              recovery: {
                link_id: "apple-link",
                provider: "apple",
                proof_methods: ["google"],
              },
            })
      }
    >
      {action === "recover" ? "Prove with Apple" : "Attempt Apple login"}
    </button>
  ),
}));

describe("provider playground", () => {
  beforeEach(() => {
    mocks.client.getCsrfToken.mockResolvedValue({ csrf_token: "csrf" });
    mocks.client.logout.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("uses Apple proof for a Google collision", async () => {
    const result = render(<App />);

    fireEvent.click(
      result.getByRole("button", { name: "Attempt Google login" }),
    );

    expect(
      (result.getByRole("combobox", { name: "Action" }) as HTMLSelectElement)
        .value,
    ).toBe("recover");
    expect(result.getByText("google-link")).toBeTruthy();
    expect(
      result.getByRole("button", { name: "Prove with Apple" }),
    ).toBeTruthy();

    fireEvent.click(result.getByRole("button", { name: "Prove with Apple" }));

    await waitFor(() =>
      expect(result.getByText("person@example.com (user-1)")).toBeTruthy(),
    );
    expect(
      result.getByText(
        "google recovery completed with apple proof for person@example.com.",
      ),
    ).toBeTruthy();
  });

  it("uses Google proof for an Apple collision", async () => {
    const result = render(<App />);

    fireEvent.click(
      result.getByRole("button", { name: "Attempt Apple login" }),
    );

    expect(result.getByText("apple-link")).toBeTruthy();
    expect(
      result.getByRole("button", { name: "Prove with Google" }),
    ).toBeTruthy();

    fireEvent.click(result.getByRole("button", { name: "Prove with Google" }));

    await waitFor(() =>
      expect(result.getByText("person@example.com (user-1)")).toBeTruthy(),
    );
    expect(
      result.getByText(
        "apple recovery completed with google proof for person@example.com.",
      ),
    ).toBeTruthy();
  });

  it("signs out before a recovery rehearsal", async () => {
    const result = render(<App />);

    fireEvent.click(result.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mocks.client.logout).toHaveBeenCalledTimes(1));
    expect(result.getByText("No authenticated account")).toBeTruthy();
  });

  it("switches both provider buttons with the mode control", () => {
    const result = render(<App />);
    const google = result.getByRole("button", {
      name: "Attempt Google login",
    });
    const apple = result.getByRole("button", { name: "Attempt Apple login" });

    expect(google.getAttribute("data-color-mode")).toBe("light");
    expect(apple.getAttribute("data-color-mode")).toBe("light");
    expect(
      result.container
        .querySelector(".preview-card")
        ?.getAttribute("data-color-mode"),
    ).toBe("light");

    fireEvent.change(result.getByRole("combobox", { name: "Mode" }), {
      target: { value: "system" },
    });

    expect(google.getAttribute("data-color-mode")).toBe("system");
    expect(apple.getAttribute("data-color-mode")).toBe("system");
    expect(
      result.container
        .querySelector(".preview-card")
        ?.getAttribute("data-color-mode"),
    ).toBe("system");
  });
});
