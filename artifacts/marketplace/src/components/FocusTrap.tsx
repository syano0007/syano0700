import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface FocusTrapProps {
  children: React.ReactNode;
  active: boolean;
  onEscape?: () => void;
}

export default function FocusTrap({ children, active, onEscape }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const getFocusables = (): HTMLElement[] =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS) ?? []
      ).filter((el) => !el.closest("[aria-hidden='true']"));

    const first = getFocusables()[0];
    if (first) first.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusables();
      if (focusables.length === 0) { e.preventDefault(); return; }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [active, onEscape]);

  return <div ref={containerRef}>{children}</div>;
}
