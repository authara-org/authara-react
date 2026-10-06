import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  loadAppleIdentity,
  loadGoogleIdentity,
  resetProviderSDKsForTests,
} from "./provider-sdks.js";

beforeEach(() => {
  resetProviderSDKsForTests();
  delete window.google;
  delete window.AppleID;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.head.querySelectorAll("script").forEach((script) => script.remove());
});

it("loads Google Identity Services only once", async () => {
  let script: HTMLScriptElement | undefined;
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    script = node as HTMLScriptElement;
    return node;
  });
  const first = loadGoogleIdentity("de");
  const second = loadGoogleIdentity("de");
  expect(first).toBe(second);
  expect(document.head.appendChild).toHaveBeenCalledTimes(1);

  window.google = {
    accounts: {
      id: { initialize() {}, renderButton() {} },
    },
  };
  script?.dispatchEvent(new Event("load"));

  await expect(first).resolves.toBe(window.google);
});

it("rejects conflicting SDK locales", async () => {
  let script: HTMLScriptElement | undefined;
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    script = node as HTMLScriptElement;
    return node;
  });
  const first = loadAppleIdentity("en_US");
  await expect(loadAppleIdentity("de_DE")).rejects.toThrow("another locale");

  window.AppleID = {
    auth: {
      init() {},
      renderButton() {},
      async signIn() {
        return {};
      },
    },
  };
  script?.dispatchEvent(new Event("load"));
  await expect(first).resolves.toBe(window.AppleID.auth);
});
