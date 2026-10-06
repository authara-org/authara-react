import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from "react";

import type { MaybePromise } from "./contract.js";
import {
  isAppleCancellation,
  isProviderUnavailable,
  toError,
} from "./errors.js";
import type { AppleAuthorization } from "./services.js";
import { useAutharaServices } from "./context.js";

export interface AppleButtonProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "onError"
> {
  disabled?: boolean;
  locale?: string;
  color?: "black" | "white";
  border?: boolean;
  type?: "sign-in" | "continue" | "sign-up";
  mode?: "center-align" | "left-align" | "logo-only";
  fallback?: ReactNode;
  onAuthorization: (authorization: AppleAuthorization) => MaybePromise<void>;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  onUnavailable?: () => void;
}

export function AppleButton({
  disabled = false,
  locale = "en_US",
  color = "black",
  border = true,
  type = "continue",
  mode = "center-align",
  fallback = null,
  onAuthorization,
  onCancel,
  onError,
  onUnavailable,
  style,
  ...divProps
}: AppleButtonProps): React.JSX.Element | null {
  const { apple } = useAutharaServices();
  const targetRef = useRef<HTMLDivElement>(null);
  const authorizationRef = useRef(onAuthorization);
  const cancelRef = useRef(onCancel);
  const errorRef = useRef(onError);
  const unavailableRef = useRef(onUnavailable);
  const [available, setAvailable] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  authorizationRef.current = onAuthorization;
  cancelRef.current = onCancel;
  errorRef.current = onError;
  unavailableRef.current = onUnavailable;

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;
    let active = true;

    void apple
      .render(element, locale)
      .then(() => {
        if (active) setReady(true);
      })
      .catch((error) => {
        if (!active) return;
        if (isProviderUnavailable(error)) {
          setAvailable(false);
          unavailableRef.current?.();
          return;
        }
        errorRef.current?.(
          toError(error, "Apple authentication is unavailable."),
        );
      });

    return () => {
      active = false;
    };
  }, [apple, border, color, locale, mode, type]);

  const beginAuthorization = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!ready || disabled || busy) return;

    setBusy(true);
    void apple
      .authorize(locale)
      .then((authorization) => authorizationRef.current(authorization))
      .catch((error) => {
        if (isAppleCancellation(error)) {
          cancelRef.current?.();
          return;
        }
        errorRef.current?.(toError(error, "Apple authentication failed."));
      })
      .finally(() => setBusy(false));
  };

  if (!available) return <>{fallback}</>;
  const inactive = disabled || busy;
  return (
    <div
      {...divProps}
      aria-busy={busy || undefined}
      aria-disabled={inactive || undefined}
      data-authara-provider="apple"
      data-authara-ready={ready ? "true" : "false"}
      onClickCapture={beginAuthorization}
      style={{
        width: "100%",
        height: 44,
        ...style,
        pointerEvents: inactive ? "none" : style?.pointerEvents,
      }}
    >
      <div
        ref={targetRef}
        data-color={color}
        data-border={String(border)}
        data-type={type}
        data-mode={mode}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
