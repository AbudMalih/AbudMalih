import type { ReactNode } from "react";
import { LanguageSwitch } from "../../components/LanguageSwitch";

/** Sign-in pages: the language can be chosen before signing in (top corner opposite the theme switch). */
export default function AuthPagesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed start-4 top-4 z-10">
        <LanguageSwitch />
      </div>
    </>
  );
}
