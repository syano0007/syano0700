import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";

/**
 * Resets scroll position to the top on every route/search change.
 *
 * Strategy:
 * - Temporarily override CSS `scroll-behavior: smooth` so the jump is instant.
 * - Scroll both `window` (standard Layout) and any `[data-scroll-container]`
 *   elements (AdminLayout uses an overflow-auto <main>).
 * - Restore smooth-scroll in the next animation frame so anchor links still
 *   benefit from smooth scrolling after navigation settles.
 *
 * Must be rendered INSIDE <WouterRouter> but OUTSIDE <Suspense> so it fires
 * the moment the URL changes, before the lazy chunk finishes loading.
 */
export function ScrollToTop() {
  const [location] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const html = document.documentElement;

    // Bypass CSS scroll-behavior: smooth for an instant, glitch-free snap
    html.style.scrollBehavior = "auto";

    // Reset the document scroll (covers all standard pages)
    window.scrollTo(0, 0);

    // Reset any overflow-auto scroll containers (e.g. AdminLayout <main>)
    document
      .querySelectorAll<HTMLElement>("[data-scroll-container]")
      .forEach((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });

    // Restore smooth scroll after the frame is painted
    requestAnimationFrame(() => {
      html.style.scrollBehavior = "";
    });
  }, [location, search]);

  return null;
}
