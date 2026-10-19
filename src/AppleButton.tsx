import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import type {
  AutharaActionProps,
  AutharaActionResult,
  MaybePromise,
} from "./contract.js";
import { resolveAction, runAppleAction } from "./actions.js";
import {
  isAppleCancellation,
  isProviderUnavailable,
  toAutharaButtonError,
  toError,
  type AutharaButtonError,
} from "./errors.js";
import type { AppleAuthorization } from "./services.js";
import { useAutharaServices } from "./context.js";
import {
  type AutharaColorMode,
  useResolvedAutharaColorMode,
} from "./color-mode.js";

type AppleButtonType = "sign-in" | "continue" | "sign-up";

function appleButtonText(type: AppleButtonType): string {
  switch (type) {
    case "sign-in":
      return "Sign in with Apple";
    case "sign-up":
      return "Sign up with Apple";
    case "continue":
      return "Continue with Apple";
  }
}

function AppleLogo(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 814 1000"
      width="16"
      height="20"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </svg>
  );
}

export interface AppleCredentialButtonProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "onError"
> {
  disabled?: boolean;
  locale?: string;
  color?: "black" | "white";
  border?: boolean;
  buttonText?: string;
  width?: CSSProperties["width"];
  type?: AppleButtonType;
  mode?: "center-align" | "left-align" | "logo-only";
  /** Apple supports a border radius from 0 through 50 points. */
  borderRadius?: number;
  fallback?: ReactNode;
  onAuthorization: (authorization: AppleAuthorization) => MaybePromise<void>;
  onStart?: () => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  onUnavailable?: () => void;
}

export function AppleCredentialButton({
  disabled = false,
  locale = "en_US",
  color = "black",
  border = false,
  buttonText,
  width,
  type = "continue",
  mode = "center-align",
  borderRadius = 12,
  fallback = null,
  onAuthorization,
  onStart,
  onCancel,
  onError,
  onUnavailable,
  style,
  ...divProps
}: AppleCredentialButtonProps): React.JSX.Element | null {
  if (!Number.isFinite(borderRadius) || borderRadius < 0 || borderRadius > 50) {
    throw new RangeError("Apple button borderRadius must be between 0 and 50.");
  }

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
  }, [apple, border, borderRadius, color, locale, mode, type]);

  const beginAuthorization = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!ready || disabled || busy) return;

    onStart?.();
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
  const label = buttonText ?? appleButtonText(type);
  return (
    <div
      {...divProps}
      aria-busy={busy || undefined}
      aria-disabled={inactive || undefined}
      data-authara-provider="apple"
      data-authara-ready={ready ? "true" : "false"}
      onClickCapture={beginAuthorization}
      style={{
        position: "relative",
        display: "inline-block",
        width: width ?? "100%",
        height: 44,
        overflow: "hidden",
        borderRadius,
        cursor: !ready ? "wait" : inactive ? "not-allowed" : "pointer",
        lineHeight: 0,
        opacity: inactive ? 0.62 : 1,
        transition: "opacity 150ms ease",
        verticalAlign: "middle",
        WebkitTapHighlightColor: "transparent",
        ...style,
        pointerEvents: !ready || inactive ? "none" : style?.pointerEvents,
      }}
    >
      <div
        ref={targetRef}
        aria-hidden="true"
        data-color={color}
        data-border={String(border)}
        data-border-radius={borderRadius}
        data-width="100%"
        data-height="100%"
        data-type={type}
        data-mode={mode}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          borderRadius,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
      <button
        type="button"
        disabled={!ready || inactive}
        aria-label={mode === "logo-only" ? label : undefined}
        data-authara-apple-presentation
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: mode === "logo-only" || mode === "left-align" ? 0 : 10,
          padding: mode === "logo-only" ? 0 : "0 14px",
          overflow: "hidden",
          border: "1px solid",
          borderColor: border
            ? color === "black"
              ? "#000"
              : "#9aa0a6"
            : "transparent",
          borderRadius,
          background: color === "black" ? "#000" : "#fff",
          boxShadow: "none",
          color: color === "black" ? "#fff" : "#202124",
          cursor: inactive ? "not-allowed" : ready ? "pointer" : "wait",
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            width: 20,
            height: 20,
            flex: "0 0 20px",
            alignItems: "center",
            justifyContent: "center",
            position: mode === "left-align" ? "absolute" : "static",
            left: mode === "left-align" ? 14 : undefined,
          }}
        >
          <AppleLogo />
        </span>
        {mode !== "logo-only" && <span>{label}</span>}
      </button>
    </div>
  );
}

export type AppleButtonVariant = "icon" | "provider" | "text";
export type AppleButtonLabel = "continue" | "sign-in" | "sign-up";

type AppleButtonVisualProps = Omit<
  AppleCredentialButtonProps,
  "mode" | "onAuthorization" | "onCancel" | "onError" | "type"
> & {
  variant?: AppleButtonVariant;
  size?: "small" | "medium" | "large";
  label?: AppleButtonLabel;
  align?: "center" | "left";
  mode?: AutharaColorMode;
  onCancel?: () => void;
};

export type AppleButtonProps = AppleButtonVisualProps &
  AutharaActionProps<"apple">;

const appleButtonHeights = {
  small: 30,
  medium: 36,
  large: 44,
} as const;

const appleIconButtonSizes = {
  small: 36,
  medium: 44,
  large: 52,
} as const;

function appleType(label: AppleButtonLabel): AppleButtonType {
  return label;
}

export function AppleButton(props: AppleButtonProps): React.JSX.Element | null {
  const { client } = useAutharaServices();
  const internal = props as AppleButtonVisualProps & {
    action?: "login" | "link" | "reauthenticate" | "recover";
    audience?: "app" | "admin" | "operator";
    authenticationChallengeId?: string;
    recoveryLinkId?: string;
    invitationToken?: string;
    invitationFlow?: "login" | "signup";
    onSuccess?: (result: AutharaActionResult<"apple">) => MaybePromise<void>;
    onError?: (error: AutharaButtonError) => void;
  };
  const {
    action = "login",
    audience,
    authenticationChallengeId,
    recoveryLinkId,
    invitationToken,
    invitationFlow,
    onSuccess,
    onError,
    onCancel,
    variant = "text",
    size = "large",
    label = action === "login" ? "sign-in" : "continue",
    align = "center",
    mode = "light",
    width,
    color,
    borderRadius,
    buttonText,
    style,
    ...buttonProps
  } = internal;
  const height =
    variant === "icon" ? appleIconButtonSizes[size] : appleButtonHeights[size];
  const resolvedMode = useResolvedAutharaColorMode(mode);

  return (
    <AppleCredentialButton
      {...buttonProps}
      color={color ?? (resolvedMode === "dark" ? "white" : "black")}
      type={appleType(label)}
      mode={variant === "icon" ? "logo-only" : `${align}-align`}
      borderRadius={borderRadius}
      buttonText={buttonText ?? (variant === "provider" ? "Apple" : undefined)}
      width={width ?? (variant === "icon" ? height : "100%")}
      style={{
        height,
        ...style,
      }}
      onAuthorization={async (proof) => {
        let result: AutharaActionResult<"apple">;
        let selected;
        try {
          selected = resolveAction(
            action,
            audience,
            authenticationChallengeId,
            recoveryLinkId,
            invitationToken,
            invitationFlow,
          );
        } catch (error) {
          throw toAutharaButtonError(
            error,
            "The Apple button action is not configured correctly.",
            "configuration",
          );
        }
        try {
          result = await runAppleAction(client, selected, proof);
        } catch (error) {
          throw toAutharaButtonError(
            error,
            `Apple ${action} failed.`,
            "authara",
          );
        }

        try {
          await onSuccess?.(result);
        } catch (error) {
          throw toAutharaButtonError(
            error,
            "The Apple success callback failed.",
            "consumer",
          );
        }
      }}
      onCancel={onCancel}
      onError={(error) =>
        onError?.(
          toAutharaButtonError(
            error,
            "Apple authentication failed.",
            "provider",
          ),
        )
      }
    />
  );
}
