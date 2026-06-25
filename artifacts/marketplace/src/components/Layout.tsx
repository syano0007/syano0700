import React from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "./Navbar";
import { HomeFooter } from "./HomeSections/HomeFooter";

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export function Layout({ children, hideFooter = false }: LayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Skip-to-content link — visible on focus for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[10000] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium focus:shadow-lg"
      >
        {t("nav.skip_to_content")}
      </a>
      <Navbar />
      <main id="main-content" role="main" tabIndex={-1} className="grow w-full min-w-0 overflow-x-hidden outline-none" style={{ paddingTop: "var(--navbar-height)" }}>
        {children}
      </main>
      {!hideFooter && <HomeFooter />}
    </div>
  );
}
