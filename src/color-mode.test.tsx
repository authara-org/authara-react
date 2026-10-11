import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AutharaColorMode,
  useResolvedAutharaColorMode,
} from "./color-mode.js";

function ModeProbe({ mode }: { mode: AutharaColorMode }) {
  return <output>{useResolvedAutharaColorMode(mode)}</output>;
}

describe("Authara color mode", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("follows system color-scheme changes", () => {
    let listener: (() => void) | undefined;
    let matches = false;
    const removeEventListener = vi.fn();
    const query = {
      get matches() {
        return matches;
      },
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn((_type: string, next: () => void) => {
        listener = next;
      }),
      removeEventListener,
    } as unknown as MediaQueryList;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => query),
    );

    const result = render(<ModeProbe mode="system" />);
    expect(result.getByText("light")).toBeTruthy();

    act(() => {
      matches = true;
      listener?.();
    });
    expect(result.getByText("dark")).toBeTruthy();

    result.unmount();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("uses a stable light snapshot during server rendering", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );

    expect(renderToString(<ModeProbe mode="system" />)).toContain(
      "<output>light</output>",
    );
  });
});
