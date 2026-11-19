"use client";

import { DsLabelsProvider, type DsLabels } from "@turvio/web-ui/ds";
import { useMemo, type ReactNode } from "react";
import type { Locale, TFunction } from "../lib/i18n";
import { I18nProvider, useI18n } from "../lib/i18n/client";

const ROLES = new Set(["owner", "admin", "dispatcher", "driver", "viewer"]);
const AUTH_ERRORS = ["invalid_credentials", "too_many_attempts", "invalid_token", "weak_password", "invalid_code", "rate_limited", "api_unavailable", "unauthenticated"] as const;

/** The design-system's built-in texts (shell, dialogs, sign-in forms) in the current language. */
export function dsLabels(t: TFunction, tr: ReturnType<typeof useI18n>["tr"]): DsLabels {
  return {
    close: t("shell.ds.close"),
    dialog: t("shell.ds.dialog"),
    details: t("shell.ds.details"),
    clearSearch: t("shell.ds.clearSearch"),
    toDark: t("shell.ds.toDark"),
    toLight: t("shell.ds.toLight"),
    shell: {
      account: (name) => t("shell.ds.account", { name }),
      switchCompany: t("shell.ds.switchCompany"),
      twoStep: t("shell.ds.twoStep"),
      signOut: t("shell.signOut"),
      expandSidebar: t("shell.ds.expandSidebar"),
      collapseSidebar: t("shell.ds.collapseSidebar"),
      collapse: t("shell.ds.collapse"),
      search: t("common.search"),
      searchPlaceholder: t("shell.ds.searchPlaceholder"),
      searchLabel: t("shell.ds.searchLabel"),
      searchButton: t("shell.ds.searchButton"),
      searchShort: t("shell.ds.searchShort"),
      noMatches: t("shell.ds.noMatches"),
      navigation: t("shell.ds.navigation"),
      openNavigation: t("shell.ds.openNavigation"),
      mainNav: t("shell.ds.mainNav"),
    },
    auth: {
      tagline: t("auth.tagline"),
      hidePassword: t("auth.hidePassword"),
      showPassword: t("auth.showPassword"),
      noConnection: t("auth.noConnection"),
      noConnectionShort: t("auth.noConnectionShort"),
      invalidLogin: t("auth.invalidLogin"),
      signInFailed: t("auth.signInFailed"),
      signInAgain: t("auth.signInAgain"),
      codeWrong: t("auth.codeWrong"),
      twoStepTitle: t("auth.twoStepTitle"),
      twoStepSubtitle: t("auth.twoStepSubtitle"),
      authCode: t("auth.authCode"),
      checking: t("auth.checking"),
      verify: t("auth.verify"),
      differentAccount: t("auth.differentAccount"),
      signIn: t("auth.signIn"),
      signInSubtitle: t("auth.signInSubtitle"),
      email: t("auth.email"),
      password: t("auth.password"),
      forgotPassword: t("auth.forgotPassword"),
      signingIn: t("auth.signingIn"),
      securityLoadFailed: t("auth.securityLoadFailed"),
      setupStartFailed: t("auth.setupStartFailed"),
      mfaSubtitle: t("auth.mfaSubtitle"),
      back: t("auth.back"),
      mfaRequired: t("auth.mfaRequired"),
      loading: t("auth.loading"),
      mfaNowOn: t("auth.mfaNowOn"),
      mfaIsOn: t("auth.mfaIsOn"),
      continue: t("auth.continue"),
      needApp: t("auth.needApp"),
      setUpMfa: t("auth.setUpMfa"),
      onYourPhone: t("auth.onYourPhone"),
      addToApp: t("auth.addToApp"),
      orEnterKey: t("auth.orEnterKey"),
      copied: t("auth.copied"),
      copy: t("auth.copy"),
      enterCode: t("auth.enterCode"),
      turnOn: t("auth.turnOn"),
      emailSendFailed: t("auth.emailSendFailed"),
      resetTitle: t("auth.resetTitle"),
      resetSubtitle: t("auth.resetSubtitle"),
      backToSignIn: t("auth.backToSignIn"),
      resetSent: (email) => t("auth.resetSent", { email }),
      sendResetLink: t("auth.sendResetLink"),
      pwTooShort: t("auth.pwTooShort"),
      pwNeedsNumber: t("auth.pwNeedsNumber"),
      pwMismatch: t("auth.pwMismatch"),
      pwChangeFailed: t("auth.pwChangeFailed"),
      newPasswordTitle: t("auth.newPasswordTitle"),
      resetIncomplete: t("auth.resetIncomplete"),
      pwChanged: t("auth.pwChanged"),
      newPassword: t("auth.newPassword"),
      repeatPassword: t("auth.repeatPassword"),
      setNewPassword: t("auth.setNewPassword"),
      inviteMissing: t("auth.inviteMissing"),
      inviteFailed: t("auth.inviteFailed"),
      joinTitle: t("auth.joinTitle"),
      invitedTo: (org, role) => tr("auth.invitedTo", { org, role }),
      inviteIncomplete: t("auth.inviteIncomplete"),
      loadingInvite: t("auth.loadingInvite"),
      inviteState: (state) => t(`auth.inviteState.${state}`),
      driverDone: (email) => t("auth.driverDone", { email }),
      yourName: t("auth.yourName"),
      existingAccount: t("auth.existingAccount"),
      acceptInvite: t("auth.acceptInvite"),
      errors: Object.fromEntries(AUTH_ERRORS.map((c) => [c, t(`auth.error.${c}`)])),
      role: (role) => (ROLES.has(role) ? t(`common.role.${role as "owner"}`) : role),
    },
  };
}

function Labels({ children }: { children: ReactNode }) {
  const { t, tr, locale } = useI18n();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => dsLabels(t, tr), [locale]);
  return <DsLabelsProvider labels={labels}>{children}</DsLabelsProvider>;
}

/** Language for the whole app: server-chosen initial value (cookie), changeable at runtime. */
export function I18nRoot({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <I18nProvider initial={locale}>
      <Labels>{children}</Labels>
    </I18nProvider>
  );
}
