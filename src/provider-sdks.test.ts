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
      oauth2: {
        initCodeClient() {
          return { requestCode() {} };
        },
      },
    },
  };
  script?.dispatchEvent(new Event("load"));

  await expect(first).resolves.toBe(window.google);
});

it("retries after a provider script fails", async () => {
  const appended: HTMLScriptElement[] = [];
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    appended.push(node as HTMLScriptElement);
    return node;
  });

  const first = loadGoogleIdentity();
  const remove = vi.spyOn(appended[0], "remove");
  appended[0].dispatchEvent(new Event("error"));
  await expect(first).rejects.toThrow("Could not load Google");
  expect(remove).toHaveBeenCalledTimes(1);

  const second = loadGoogleIdentity();
  expect(appended).toHaveLength(2);
  window.google = {
    accounts: {
      oauth2: {
        initCodeClient() {
          return { requestCode() {} };
        },
      },
    },
  };
  appended[1].dispatchEvent(new Event("load"));
  await expect(second).resolves.toBe(window.google);
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
