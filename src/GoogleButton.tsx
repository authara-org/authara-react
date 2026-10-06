import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import type { MaybePromise } from "./contract.js";
import { isProviderUnavailable, toError } from "./errors.js";
import type { GoogleButtonConfiguration } from "./provider-sdks.js";
import type { GoogleCredential } from "./services.js";
import { useAutharaServices } from "./context.js";

type GoogleAppearance = Pick<
  GoogleButtonConfiguration,
  "type" | "theme" | "size" | "text" | "shape" | "logo_alignment" | "width"
>;

export interface GoogleButtonProps
  extends
    Omit<ComponentPropsWithoutRef<"div">, "children" | "onError">,
    GoogleAppearance {
  disabled?: boolean;
  locale?: string;
  fallback?: ReactNode;
  onCredential: (credential: GoogleCredential) => MaybePromise<void>;
  onError?: (error: Error) => void;
  onUnavailable?: () => void;
}

export function GoogleButton({
  disabled = false,
  locale,
  fallback = null,
  onCredential,
  onError,
  onUnavailable,
  type = "standard",
  theme = "outline",
  size = "large",
  text = "continue_with",
  shape = "rectangular",
  logo_alignment = "left",
  width,
  style,
  ...divProps
}: GoogleButtonProps): React.JSX.Element | null {
  const { google } = useAutharaServices();
  const targetRef = useRef<HTMLDivElement>(null);
  const credentialRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const unavailableRef = useRef(onUnavailable);
  const disabledRef = useRef(disabled);
  const [available, setAvailable] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  credentialRef.current = onCredential;
  errorRef.current = onError;
  unavailableRef.current = onUnavailable;
  disabledRef.current = disabled;

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;
    let active = true;
    let dispose: (() => void) | undefined;

    void google
      .render(
        element,
        {
          type,
          theme,
          size,
          text,
          shape,
          logo_alignment,
          width: width ?? Math.min(element.clientWidth || 320, 400),
        },
        locale,
        (credential) => {
          if (!active || disabledRef.current) return;
          setBusy(true);
          void Promise.resolve(credentialRef.current(credential))
            .catch((error) =>
              errorRef.current?.(
                toError(error, "Google authentication failed."),
              ),
            )
            .finally(() => {
              if (active) setBusy(false);
            });
        },
      )
      .then((cleanup) => {
        if (!active) cleanup();
        else {
          dispose = cleanup;
          setReady(true);
        }
      })
      .catch((error) => {
        if (!active) return;
        if (isProviderUnavailable(error)) {
          setAvailable(false);
          unavailableRef.current?.();
          return;
        }
        errorRef.current?.(
          toError(error, "Google authentication is unavailable."),
        );
      });

    return () => {
      active = false;
      dispose?.();
    };
  }, [google, locale, logo_alignment, shape, size, text, theme, type, width]);

  if (!available) return <>{fallback}</>;
  const inactive = disabled || busy;
  return (
    <div
      {...divProps}
      ref={targetRef}
      aria-busy={busy || undefined}
      aria-disabled={inactive || undefined}
      data-authara-provider="google"
      data-authara-ready={ready ? "true" : "false"}
      style={{
        ...style,
        pointerEvents: inactive ? "none" : style?.pointerEvents,
      }}
    />
  );
}
