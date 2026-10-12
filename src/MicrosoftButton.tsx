import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { resolveAction, runMicrosoftAction } from "./actions.js";
import {
  type AutharaActionProps,
  type AutharaActionSuccess,
  type MaybePromise,
} from "./contract.js";
import { useAutharaServices } from "./context.js";
import {
  isMicrosoftCancellation,
  isProviderUnavailable,
  toAutharaButtonError,
  toError,
  type AutharaButtonError,
} from "./errors.js";
import type { MicrosoftCredential } from "./services.js";
import {
  type AutharaColorMode,
  useResolvedAutharaColorMode,
} from "./color-mode.js";

export type MicrosoftButtonVariant = "icon" | "text";
export type MicrosoftButtonLabel = "continue" | "sign-in" | "sign-up";

const textButtonHeights = { small: 30, medium: 36, large: 44 } as const;
const iconButtonSizes = { small: 36, medium: 44, large: 52 } as const;

function buttonLabel(label: MicrosoftButtonLabel): string {
  switch (label) {
    case "sign-in":
      return "Sign in with Microsoft";
    case "sign-up":
      return "Sign up with Microsoft";
    case "continue":
      return "Continue with Microsoft";
  }
}

function MicrosoftLogo(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "grid",
        width: 18,
        height: 18,
        flex: "0 0 18px",
        gridTemplateColumns: "repeat(2, 1fr)",
        gridTemplateRows: "repeat(2, 1fr)",
        gap: 1,
      }}
    >
      <span style={{ background: "#f25022" }} />
      <span style={{ background: "#7fba00" }} />
      <span style={{ background: "#00a4ef" }} />
      <span style={{ background: "#ffb900" }} />
    </span>
  );
}

export interface MicrosoftCredentialButtonProps extends Omit<
  ComponentPropsWithoutRef<"button">,
  "children" | "onError" | "size" | "type"
> {
  disabled?: boolean;
  variant?: MicrosoftButtonVariant;
  size?: "small" | "medium" | "large";
  label?: MicrosoftButtonLabel;
  buttonText?: string;
  align?: "center" | "left";
  mode?: AutharaColorMode;
  border?: boolean;
  width?: CSSProperties["width"];
  fallback?: ReactNode;
  onCredential: (credential: MicrosoftCredential) => MaybePromise<void>;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  onUnavailable?: () => void;
}

export function MicrosoftCredentialButton({
  disabled = false,
  variant = "text",
  size = "large",
  label = "continue",
  buttonText,
  align = "center",
  mode = "light",
  border = true,
  width,
  fallback = null,
  onCredential,
  onCancel,
  onError,
  onUnavailable,
  style,
  onClick,
  ...buttonProps
}: MicrosoftCredentialButtonProps): React.JSX.Element | null {
  const { microsoft } = useAutharaServices();
  const credentialRef = useRef(onCredential);
  const cancelRef = useRef(onCancel);
  const errorRef = useRef(onError);
  const unavailableRef = useRef(onUnavailable);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const ready = useSyncExternalStore(
    microsoft.subscribe,
    microsoft.isReady,
    microsoft.isReady,
  );
  const resolvedMode = useResolvedAutharaColorMode(mode);

  credentialRef.current = onCredential;
  cancelRef.current = onCancel;
  errorRef.current = onError;
  unavailableRef.current = onUnavailable;

  useEffect(() => {
    let active = true;
    void microsoft
      .prepare()
      .then(() => undefined)
      .catch((error) => {
        if (!active) return;
        if (isProviderUnavailable(error)) {
          setAvailable(false);
          unavailableRef.current?.();
          return;
        }
        errorRef.current?.(
          toError(error, "Microsoft authentication is unavailable."),
        );
      });
    return () => {
      active = false;
    };
  }, [microsoft]);

  if (!available) return <>{fallback}</>;

  const iconOnly = variant === "icon";
  const height = iconOnly ? iconButtonSizes[size] : textButtonHeights[size];
  const text = buttonText ?? buttonLabel(label);
  const inactive = disabled || busy;
  const dark = resolvedMode === "dark";

  return (
    <button
      {...buttonProps}
      type="button"
      disabled={!ready || inactive}
      aria-busy={busy || undefined}
      aria-label={iconOnly ? text : buttonProps["aria-label"]}
      data-authara-provider="microsoft"
      data-authara-ready={ready ? "true" : "false"}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !ready || inactive) return;
        setBusy(true);
        const authorization = microsoft.authorize();
        void authorization
          .then((proof) => credentialRef.current(proof))
          .catch((error) => {
            if (isMicrosoftCancellation(error)) {
              cancelRef.current?.();
              return;
            }
            errorRef.current?.(
              toError(error, "Microsoft authentication failed."),
            );
          })
          .finally(() => {
            setBusy(false);
            void microsoft
              .prepare()
              .then(() => undefined)
              .catch((error) => {
                errorRef.current?.(
                  toError(error, "Microsoft authentication is unavailable."),
                );
              });
          });
      }}
      style={{
        position: "relative",
        display: "inline-flex",
        width: width ?? (iconOnly ? height : "100%"),
        height,
        alignItems: "center",
        justifyContent: "center",
        gap: iconOnly || align === "left" ? 0 : 10,
        padding: iconOnly ? 0 : "0 12px",
        border: "1px solid",
        borderColor: border ? (dark ? "#8e918f" : "#8c8c8c") : "transparent",
        borderRadius: 12,
        boxSizing: "border-box",
        background: dark ? "#2f2f2f" : "#fff",
        color: dark ? "#fff" : "#1f1f1f",
        cursor: !ready ? "wait" : inactive ? "not-allowed" : "pointer",
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: 14,
        fontWeight: 600,
        lineHeight: "20px",
        opacity: inactive ? 0.62 : 1,
        outlineOffset: 2,
        transition: "opacity 150ms ease",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          position: !iconOnly && align === "left" ? "absolute" : "static",
          left: !iconOnly && align === "left" ? 12 : undefined,
        }}
      >
        <MicrosoftLogo />
      </span>
      {!iconOnly && <span>{text}</span>}
    </button>
  );
}

type MicrosoftButtonVisualProps = Omit<
  MicrosoftCredentialButtonProps,
  "onCredential" | "onError"
>;

export type MicrosoftButtonProps = MicrosoftButtonVisualProps &
  AutharaActionProps<"microsoft">;

export function MicrosoftButton(
  props: MicrosoftButtonProps,
): React.JSX.Element | null {
  const { client } = useAutharaServices();
  const internal = props as MicrosoftButtonVisualProps & {
    action?: "login" | "link" | "reauthenticate" | "recover";
    audience?: "app" | "admin" | "operator";
    authenticationChallengeId?: string;
    recoveryLinkId?: string;
    onSuccess?: (
      result: AutharaActionSuccess<"microsoft">,
    ) => MaybePromise<void>;
    onError?: (error: AutharaButtonError) => void;
  };
  const {
    action = "login",
    audience,
    authenticationChallengeId,
    recoveryLinkId,
    onSuccess,
    onError,
    label = action === "login" ? "sign-in" : "continue",
    ...buttonProps
  } = internal;

  return (
    <MicrosoftCredentialButton
      {...buttonProps}
      label={label}
      onCredential={async (proof) => {
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
            "The Microsoft button action is not configured correctly.",
            "configuration",
          );
        }

        let result: AutharaActionSuccess<"microsoft">;
        try {
          result = await runMicrosoftAction(client, selected, proof);
        } catch (error) {
          throw toAutharaButtonError(
            error,
            `Microsoft ${action} failed.`,
            "authara",
          );
        }

        try {
          await onSuccess?.(result);
        } catch (error) {
          throw toAutharaButtonError(
            error,
            "The Microsoft success callback failed.",
            "consumer",
          );
        }
      }}
      onError={(error) =>
        onError?.(
          toAutharaButtonError(
            error,
            "Microsoft authentication failed.",
            "provider",
          ),
        )
      }
    />
  );
}
