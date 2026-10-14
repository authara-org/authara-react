import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import type {
  AutharaActionProps,
  AutharaActionSuccess,
  MaybePromise,
} from "./contract.js";
import { resolveAction, runGoogleAction } from "./actions.js";
import {
  isProviderUnavailable,
  toAutharaButtonError,
  toError,
  type AutharaButtonError,
} from "./errors.js";
import type { GoogleButtonConfiguration } from "./provider-sdks.js";
import type { GoogleCredential } from "./services.js";
import { useAutharaServices } from "./context.js";
import {
  type AutharaColorMode,
  useResolvedAutharaColorMode,
} from "./color-mode.js";

type GoogleAppearance = Pick<
  GoogleButtonConfiguration,
  "type" | "theme" | "size" | "text" | "shape" | "logo_alignment"
>;

const googleButtonHeights = {
  small: 30,
  medium: 36,
  large: 44,
} as const;

const googleIconButtonSizes = {
  small: 36,
  medium: 44,
  large: 52,
} as const;

function googleButtonText(
  text: NonNullable<GoogleButtonConfiguration["text"]>,
): string {
  switch (text) {
    case "signin":
    case "signin_with":
      return "Sign in with Google";
    case "signup_with":
      return "Sign up with Google";
    case "continue_with":
      return "Continue with Google";
  }
}

function googleButtonRadius(
  shape: NonNullable<GoogleButtonConfiguration["shape"]>,
  height: number,
): number {
  switch (shape) {
    case "circle":
    case "pill":
      return height / 2;
    case "square":
      return 6;
    case "rectangular":
      return 12;
  }
}

function googleButtonColors(
  theme: NonNullable<GoogleButtonConfiguration["theme"]>,
): Pick<CSSProperties, "background" | "borderColor" | "color"> {
  switch (theme) {
    case "light":
      return { background: "#fff", borderColor: "#747775", color: "#1f1f1f" };
    case "dark":
      return {
        background: "#131314",
        borderColor: "#8e918f",
        color: "#e3e3e3",
      };
    case "neutral":
      return {
        background: "#f2f2f2",
        borderColor: "transparent",
        color: "#1f1f1f",
      };
  }
}

function GoogleLogo(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.613Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.468-.806 5.956-2.182l-2.91-2.258c-.805.54-1.835.86-3.046.86-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.507.454 3.44 1.345l2.581-2.58C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export interface GoogleCredentialButtonProps
  extends
    Omit<
      ComponentPropsWithoutRef<"button">,
      "children" | "onError" | "size" | "type"
    >,
    GoogleAppearance {
  disabled?: boolean;
  border?: boolean;
  buttonText?: string;
  width?: CSSProperties["width"];
  locale?: string;
  fallback?: ReactNode;
  onCredential: (credential: GoogleCredential) => MaybePromise<void>;
  onError?: (error: Error) => void;
  onUnavailable?: () => void;
}

export function GoogleCredentialButton({
  disabled = false,
  border,
  buttonText,
  locale,
  fallback = null,
  onCredential,
  onError,
  onUnavailable,
  type = "standard",
  theme = "light",
  size = "large",
  text = "continue_with",
  shape = "rectangular",
  logo_alignment = "center",
  width,
  style,
  onClick,
  ...buttonProps
}: GoogleCredentialButtonProps): React.JSX.Element | null {
  const { google } = useAutharaServices();
  const credentialRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const unavailableRef = useRef(onUnavailable);
  const disabledRef = useRef(disabled);
  const [available, setAvailable] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestCode, setRequestCode] = useState<(() => void) | undefined>();

  credentialRef.current = onCredential;
  errorRef.current = onError;
  unavailableRef.current = onUnavailable;
  disabledRef.current = disabled;

  useEffect(() => {
    let active = true;

    void google
      .prepare(
        locale,
        (credential) => {
          if (!active || disabledRef.current) return;
          setBusy(true);
          void Promise.resolve()
            .then(() => credentialRef.current(credential))
            .catch((error) =>
              errorRef.current?.(
                toError(error, "Google authentication failed."),
              ),
            )
            .finally(() => {
              if (active) setBusy(false);
            });
        },
        (error) => {
          if (!active) return;
          setBusy(false);
          errorRef.current?.(error);
        },
      )
      .then((trigger) => {
        if (active) {
          setRequestCode(() => trigger);
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
    };
  }, [google, locale]);

  if (!available) return <>{fallback}</>;
  const inactive = disabled || busy;
  const iconOnly = type === "icon";
  const height = iconOnly
    ? googleIconButtonSizes[size]
    : googleButtonHeights[size];
  const colors = googleButtonColors(theme);
  const radius = googleButtonRadius(shape, height);
  const label = buttonText ?? googleButtonText(text);
  const showBorder = border ?? theme !== "neutral";
  return (
    <button
      {...buttonProps}
      type="button"
      disabled={!ready || inactive}
      aria-busy={busy || undefined}
      aria-label={buttonProps["aria-label"] ?? (iconOnly ? label : undefined)}
      data-authara-provider="google"
      data-authara-ready={ready ? "true" : "false"}
      data-authara-google-presentation
      data-border={String(showBorder)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !requestCode) return;
        setBusy(true);
        requestCode();
      }}
      style={{
        position: "relative",
        display: "inline-flex",
        width: width ?? (iconOnly ? height : "100%"),
        height,
        alignItems: "center",
        justifyContent: "center",
        gap: iconOnly || logo_alignment === "left" ? 0 : 10,
        padding: iconOnly ? 0 : "0 12px",
        overflow: "hidden",
        border: "1px solid",
        borderRadius: radius,
        boxSizing: "border-box",
        boxShadow: "none",
        cursor: !ready ? "wait" : inactive ? "not-allowed" : "pointer",
        fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: "20px",
        whiteSpace: "nowrap",
        ...colors,
        borderColor: showBorder ? colors.borderColor : "transparent",
        outlineOffset: 2,
        opacity: inactive ? 0.62 : 1,
        transition: "opacity 150ms ease",
        verticalAlign: "middle",
        WebkitTapHighlightColor: "transparent",
        ...style,
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
          background: "#fff",
          borderRadius: 2,
          position:
            !iconOnly && logo_alignment === "left" ? "absolute" : "static",
          left: !iconOnly && logo_alignment === "left" ? 12 : undefined,
        }}
      >
        <GoogleLogo />
      </span>
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

export type GoogleButtonVariant = "icon" | "provider" | "text";
export type GoogleButtonLabel = "continue" | "sign-in" | "sign-up";

type GoogleButtonVisualProps = Omit<
  GoogleCredentialButtonProps,
  "logo_alignment" | "onCredential" | "onError" | "size" | "text" | "type"
> & {
  variant?: GoogleButtonVariant;
  size?: "small" | "medium" | "large";
  label?: GoogleButtonLabel;
  logoAlignment?: "left" | "center";
  mode?: AutharaColorMode;
};

export type GoogleButtonProps = GoogleButtonVisualProps &
  AutharaActionProps<"google">;

function googleText(
  label: GoogleButtonLabel,
): GoogleButtonConfiguration["text"] {
  switch (label) {
    case "sign-in":
      return "signin_with";
    case "sign-up":
      return "signup_with";
    case "continue":
      return "continue_with";
  }
}

export function GoogleButton(
  props: GoogleButtonProps,
): React.JSX.Element | null {
  const { client } = useAutharaServices();
  const internal = props as GoogleButtonVisualProps & {
    action?: "login" | "link" | "reauthenticate" | "recover";
    audience?: "app" | "admin" | "operator";
    authenticationChallengeId?: string;
    recoveryLinkId?: string;
    onSuccess?: (result: AutharaActionSuccess<"google">) => MaybePromise<void>;
    onError?: (error: AutharaButtonError) => void;
  };
  const {
    action = "login",
    audience,
    authenticationChallengeId,
    recoveryLinkId,
    onSuccess,
    onError,
    variant = "text",
    size = "large",
    label = action === "login" ? "sign-in" : "continue",
    logoAlignment = "center",
    mode = "light",
    border,
    shape,
    theme,
    buttonText,
    ...buttonProps
  } = internal;
  const resolvedMode = useResolvedAutharaColorMode(mode);

  return (
    <GoogleCredentialButton
      {...buttonProps}
      border={border}
      theme={theme ?? resolvedMode}
      type={variant === "icon" ? "icon" : "standard"}
      size={size}
      text={googleText(label)}
      buttonText={buttonText ?? (variant === "provider" ? "Google" : undefined)}
      shape={shape ?? "rectangular"}
      logo_alignment={logoAlignment}
      onCredential={async (proof) => {
        let result: AutharaActionSuccess<"google">;
        let selected;
        try {
          selected = resolveAction(
            action,
            audience,
            authenticationChallengeId,
            recoveryLinkId,
          );
        } catch (error) {
          throw toAutharaButtonError(
            error,
            "The Google button action is not configured correctly.",
            "configuration",
          );
        }
        try {
          result = await runGoogleAction(client, selected, proof);
        } catch (error) {
          throw toAutharaButtonError(
            error,
            `Google ${action} failed.`,
            "authara",
          );
        }

        try {
          await onSuccess?.(result);
        } catch (error) {
          throw toAutharaButtonError(
            error,
            "The Google success callback failed.",
            "consumer",
          );
        }
      }}
      onError={(error) =>
        onError?.(
          toAutharaButtonError(
            error,
            "Google authentication failed.",
            "provider",
          ),
        )
      }
    />
  );
}
