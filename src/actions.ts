import type {
  AppleProof,
  AutharaAction,
  AutharaActionResult,
  AutharaAccountRecoveryLink,
  AutharaAudience,
  AutharaInvitationFlow,
  AutharaReactClient,
  GoogleProof,
  MicrosoftProof,
} from "./contract.js";

export type ResolvedAutharaAction =
  | {
      action: "login";
      audience: AutharaAudience;
      invitationToken?: string;
      invitationFlow?: AutharaInvitationFlow;
    }
  | { action: "link" }
  | { action: "reauthenticate"; authenticationChallengeId: string }
  | {
      action: "recover";
      audience: "app";
      recoveryLinkId: string;
      invitationToken?: string;
    };

export async function runGoogleAction(
  client: AutharaReactClient,
  selected: ResolvedAutharaAction,
  proof: GoogleProof,
): Promise<AutharaActionResult<"google">> {
  await client.getCsrfToken();
  const body = { code: proof.code, redirect_uri: proof.redirect_uri };
  switch (selected.action) {
    case "login":
      if (selected.invitationToken) {
        const result = await client.authenticateAndAcceptInvitationWithGoogle({
          audience: "app",
          body: {
            ...body,
            token: selected.invitationToken,
            flow: selected.invitationFlow ?? "login",
          },
        });
        if (result.status === "authenticated") {
          return {
            action: "login",
            provider: "google",
            status: "authenticated",
            session: result.session,
          };
        }
        if (
          result.status === "proof_required" &&
          isAccountRecoveryLink(result.recovery)
        ) {
          return {
            action: "login",
            provider: "google",
            status: "recovery-required",
            recovery: result.recovery,
          };
        }
        throw new Error(
          "Authara returned an invalid Google invitation result.",
        );
      }
      return {
        action: "login",
        provider: "google",
        session: await client.loginWithGoogle({
          audience: selected.audience,
          body,
        }),
      };
    case "link":
      await client.linkCurrentUserGoogle({ body });
      return { action: "link", provider: "google" };
    case "reauthenticate":
      await client.reauthenticateWithGoogle({
        body: {
          ...body,
          authentication_challenge_id: selected.authenticationChallengeId,
        },
      });
      return { action: "reauthenticate", provider: "google" };
    case "recover":
      return {
        action: "recover",
        provider: "google",
        session: await client.completeAccountRecoveryLinkWithGoogle({
          linkID: selected.recoveryLinkId,
          audience: selected.audience,
          body: {
            ...body,
            ...(selected.invitationToken
              ? { invitation_token: selected.invitationToken }
              : {}),
          },
        }),
      };
  }
}

export async function runAppleAction(
  client: AutharaReactClient,
  selected: ResolvedAutharaAction,
  proof: AppleProof,
): Promise<AutharaActionResult<"apple">> {
  await client.getCsrfToken();
  switch (selected.action) {
    case "login":
      if (selected.invitationToken) {
        return {
          action: "login",
          provider: "apple",
          status: "authenticated",
          session: await client.loginWithApple({
            audience: "app",
            body: {
              ...proof,
              invitation_token: selected.invitationToken,
            },
          }),
        };
      }
      return {
        action: "login",
        provider: "apple",
        session: await client.loginWithApple({
          audience: selected.audience,
          body: proof,
        }),
      };
    case "link":
      await client.linkCurrentUserApple({ body: proof });
      return { action: "link", provider: "apple" };
    case "reauthenticate":
      await client.reauthenticateWithApple({
        body: {
          ...proof,
          authentication_challenge_id: selected.authenticationChallengeId,
        },
      });
      return { action: "reauthenticate", provider: "apple" };
    case "recover":
      return {
        action: "recover",
        provider: "apple",
        session: await client.completeAccountRecoveryLinkWithApple({
          linkID: selected.recoveryLinkId,
          audience: selected.audience,
          body: {
            ...proof,
            ...(selected.invitationToken
              ? { invitation_token: selected.invitationToken }
              : {}),
          },
        }),
      };
  }
}

export async function runMicrosoftAction(
  client: AutharaReactClient,
  selected: ResolvedAutharaAction,
  proof: MicrosoftProof,
): Promise<AutharaActionResult<"microsoft">> {
  await client.getCsrfToken();
  switch (selected.action) {
    case "login":
      if (!client.loginWithMicrosoft) throw microsoftClientUnavailable();
      if (selected.invitationToken) {
        return {
          action: "login",
          provider: "microsoft",
          status: "authenticated",
          session: await client.loginWithMicrosoft({
            audience: "app",
            body: {
              ...proof,
              invitation_token: selected.invitationToken,
            },
          }),
        };
      }
      return {
        action: "login",
        provider: "microsoft",
        session: await client.loginWithMicrosoft({
          audience: selected.audience,
          body: proof,
        }),
      };
    case "link":
      if (!client.linkCurrentUserMicrosoft) throw microsoftClientUnavailable();
      await client.linkCurrentUserMicrosoft({ body: proof });
      return { action: "link", provider: "microsoft" };
    case "reauthenticate":
      if (!client.reauthenticateWithMicrosoft)
        throw microsoftClientUnavailable();
      await client.reauthenticateWithMicrosoft({
        body: {
          ...proof,
          authentication_challenge_id: selected.authenticationChallengeId,
        },
      });
      return { action: "reauthenticate", provider: "microsoft" };
    case "recover":
      if (!client.completeAccountRecoveryLinkWithMicrosoft)
        throw microsoftClientUnavailable();
      return {
        action: "recover",
        provider: "microsoft",
        session: await client.completeAccountRecoveryLinkWithMicrosoft({
          linkID: selected.recoveryLinkId,
          audience: selected.audience,
          body: {
            ...proof,
            ...(selected.invitationToken
              ? { invitation_token: selected.invitationToken }
              : {}),
          },
        }),
      };
  }
}

function microsoftClientUnavailable() {
  return {
    status: 404,
    message:
      "This @authara/browser client does not include Microsoft authentication.",
  };
}

export function resolveAction(
  action: AutharaAction | undefined,
  audience: AutharaAudience | undefined,
  authenticationChallengeId: string | undefined,
  recoveryLinkId: string | undefined,
  invitationToken: string | undefined,
  invitationFlow: AutharaInvitationFlow | undefined,
): ResolvedAutharaAction {
  if (action === "link") return { action };
  if (action === "reauthenticate") {
    if (!authenticationChallengeId) {
      throw new Error(
        "authenticationChallengeId is required for reauthentication.",
      );
    }
    return { action, authenticationChallengeId };
  }
  if (action === "recover") {
    if (!recoveryLinkId) {
      throw new Error("recoveryLinkId is required for account recovery.");
    }
    return {
      action,
      audience: "app",
      recoveryLinkId,
      invitationToken: optionalValue(invitationToken, "invitationToken"),
    };
  }
  const resolvedInvitationToken = optionalValue(
    invitationToken,
    "invitationToken",
  );
  if (resolvedInvitationToken && audience && audience !== "app") {
    throw new Error("Invitation login supports only the app audience.");
  }
  return {
    action: "login",
    audience: audience ?? "app",
    invitationToken: resolvedInvitationToken,
    invitationFlow: resolvedInvitationToken ? invitationFlow : undefined,
  };
}

function optionalValue(value: string | undefined, name: string) {
  if (value === undefined) return undefined;
  if (!value.trim()) throw new Error(`${name} must not be empty.`);
  return value;
}

function isAccountRecoveryLink(
  value: AutharaAccountRecoveryLink | undefined,
): value is AutharaAccountRecoveryLink {
  return (
    typeof value?.link_id === "string" &&
    value.link_id.trim() !== "" &&
    ["google", "apple", "microsoft"].includes(value.provider) &&
    Array.isArray(value.proof_methods) &&
    value.proof_methods.length > 0 &&
    value.proof_methods.every((method) =>
      ["password", "google", "apple", "microsoft"].includes(method),
    )
  );
}
