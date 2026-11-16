"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Built-in texts of the design-system components. English by default (Admin uses the defaults);
 * an app can provide its own translations with <DsLabelsProvider>.
 */
export const DEFAULT_DS_LABELS = {
  close: "Close",
  dialog: "Dialog",
  details: "Details",
  clearSearch: "Clear search",
  toDark: "Switch to dark mode",
  toLight: "Switch to light mode",
  shell: {
    account: (name: string) => `Account: ${name}`,
    switchCompany: "Switch company",
    twoStep: "Two-step verification",
    signOut: "Sign out",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    collapse: "Collapse",
    search: "Search",
    searchPlaceholder: "Search pages and actions…",
    searchLabel: "Search pages and actions",
    searchButton: "Search pages and actions (Ctrl K)",
    searchShort: "Search…",
    noMatches: "No matches",
    navigation: "Navigation",
    openNavigation: "Open navigation",
    mainNav: "Main",
  },
  auth: {
    tagline: "Smart Routes. Simple Deliveries.",
    hidePassword: "Hide password",
    showPassword: "Show password",
    noConnection: "No connection. Check your network and try again.",
    noConnectionShort: "No connection. Try again.",
    invalidLogin: "Enter a valid email address and your password.",
    signInFailed: "Sign-in failed. Please try again.",
    signInAgain: "Please sign in again.",
    codeWrong: "The code is not correct.",
    twoStepTitle: "Two-step verification",
    twoStepSubtitle: "Enter the 6-digit code from your authenticator app.",
    authCode: "Authentication code",
    checking: "Checking…",
    verify: "Verify",
    differentAccount: "Use a different account",
    signIn: "Sign in",
    signInSubtitle: "Use your TURVIO work account.",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    signingIn: "Signing in…",
    securityLoadFailed: "Could not load your security settings.",
    setupStartFailed: "Could not start the set-up.",
    mfaSubtitle: "Protects company and platform administration with a code from an authenticator app.",
    back: "Back",
    mfaRequired: "This action needs two-step verification. Set it up below; next time you sign in, TURVIO asks for a code.",
    loading: "Loading…",
    mfaNowOn: "Two-step verification is now on. Other sessions were signed out.",
    mfaIsOn: "Two-step verification is on for your account.",
    continue: "Continue",
    needApp: "You need an authenticator app on your phone, for example Google Authenticator, Microsoft Authenticator, 1Password or Aegis.",
    setUpMfa: "Set up two-step verification",
    onYourPhone: "On your phone:",
    addToApp: "add TURVIO to your authenticator app",
    orEnterKey: ". On a computer, enter this key in the app instead (type: time-based):",
    copied: "Copied",
    copy: "Copy",
    enterCode: "Enter the 6-digit code the app shows.",
    turnOn: "Turn on",
    emailSendFailed: "Could not send the email. Please try again.",
    resetTitle: "Reset your password",
    resetSubtitle: "We will email you a link to set a new password.",
    backToSignIn: "Back to sign in",
    resetSent: (email: string) => `If an account exists for ${email}, an email with a reset link is on its way. The link is valid for 60 minutes.`,
    sendResetLink: "Send reset link",
    pwTooShort: "Use at least 12 characters",
    pwNeedsNumber: "Use letters and at least one number",
    pwMismatch: "Passwords do not match",
    pwChangeFailed: "The password could not be changed.",
    newPasswordTitle: "Choose a new password",
    resetIncomplete: "This reset link is incomplete. Request a new one from the sign-in page.",
    pwChanged: "Your password was changed and all other sessions were signed out.",
    newPassword: "New password",
    repeatPassword: "Repeat password",
    setNewPassword: "Set new password",
    inviteMissing: "This invitation does not exist.",
    inviteFailed: "The invitation could not be accepted.",
    joinTitle: "Join your team",
    invitedTo: (org: ReactNode, role: string): ReactNode => (
      <>
        You were invited to {org} as {role}.
      </>
    ),
    inviteIncomplete: "This invitation link is incomplete.",
    loadingInvite: "Loading invitation",
    inviteState: (state: "accepted" | "expired" | "revoked") => `This invitation was ${state}. Ask your administrator for a new one.`,
    driverDone: (email: string) => `You are set up. Open the TURVIO Driver app and sign in with ${email} and your new password.`,
    yourName: "Your name",
    existingAccount: "existing account? use its password",
    acceptInvite: "Accept invitation",
    /** Translations of server error codes (empty: the server's own message is shown). */
    errors: {} as Record<string, string>,
    /** Role names as shown in the invitation. */
    role: (role: string) => role,
  },
};

export type DsLabels = typeof DEFAULT_DS_LABELS;

const Ctx = createContext<DsLabels>(DEFAULT_DS_LABELS);

export function DsLabelsProvider({ labels, children }: { labels: DsLabels; children: ReactNode }) {
  return <Ctx.Provider value={labels}>{children}</Ctx.Provider>;
}

export const useDsLabels = () => useContext(Ctx);
