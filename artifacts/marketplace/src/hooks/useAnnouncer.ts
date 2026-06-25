import { useEffect, useRef, useCallback } from "react";

export default function useAnnouncer() {
  const regionRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const region = document.createElement("div");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.setAttribute("role", "status");
    Object.assign(region.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      overflow: "hidden",
      clip: "rect(0,0,0,0)",
      whiteSpace: "nowrap",
      border: "0",
    });
    document.body.appendChild(region);
    regionRef.current = region;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      region.remove();
    };
  }, []);

  const announce = useCallback((message: string) => {
    const region = regionRef.current;
    if (!region) return;
    region.textContent = "";
    if (timerRef.current) clearTimeout(timerRef.current);
    requestAnimationFrame(() => {
      region.textContent = message;
      timerRef.current = setTimeout(() => {
        region.textContent = "";
      }, 1000);
    });
  }, []);

  return announce;
}
