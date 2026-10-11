import type {
  AppleProof,
  AutharaAction,
  AutharaActionSuccess,
  AutharaAudience,
  AutharaReactClient,
  GoogleProof,
} from "./contract.js";

export type ResolvedAutharaAction =
  | { action: "login"; audience: AutharaAudience }
  | { action: "link" }
  | { action: "reauthenticate"; authenticationChallengeId: string }
  | {
      action: "recover";
      audience: AutharaAudience;
      recoveryLinkId: string;
    };

export async function runGoogleAction(
  client: AutharaReactClient,
  selected: ResolvedAutharaAction,
  proof: GoogleProof,
): Promise<AutharaActionSuccess<"google">> {
  await client.getCsrfToken();
  const body = { code: proof.code, redirect_uri: proof.redirect_uri };
  switch (selected.action) {
    case "login":
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
          body,
        }),
      };
  }
}

export async function runAppleAction(
  client: AutharaReactClient,
  selected: ResolvedAutharaAction,
  proof: AppleProof,
): Promise<AutharaActionSuccess<"apple">> {
  await client.getCsrfToken();
  switch (selected.action) {
    case "login":
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
          body: proof,
        }),
      };
  }
}

export function resolveAction(
  action: AutharaAction | undefined,
  audience: AutharaAudience | undefined,
  authenticationChallengeId: string | undefined,
  recoveryLinkId: string | undefined,
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
    return { action, audience: audience ?? "app", recoveryLinkId };
  }
  return { action: "login", audience: audience ?? "app" };
}
