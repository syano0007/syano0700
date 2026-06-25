import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

/**
 * Thin top-of-page progress bar that fires on every client-side navigation.
 * Uses transform:scaleX() instead of width so the animation runs on the GPU
 * compositor thread — zero layout recalculation, zero paint overhead.
 */
export function NavigationProgress() {
  const [location] = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevRef = useRef(location);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (location === prevRef.current) return;
    prevRef.current = location;

    timers.current.forEach(clearTimeout);
    timers.current = [];

    setProgress(0);
    setVisible(true);

    const t1 = setTimeout(() => setProgress(0.30), 10);
    const t2 = setTimeout(() => setProgress(0.65), 150);
    const t3 = setTimeout(() => setProgress(0.85), 400);
    const t4 = setTimeout(() => setProgress(1.00), 600);
    const t5 = setTimeout(() => setVisible(false), 850);

    timers.current = [t1, t2, t3, t4, t5];
    return () => timers.current.forEach(clearTimeout);
  }, [location]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 start-0 end-0 z-[9999] h-[3px] pointer-events-none overflow-hidden"
    >
      <div
        className="h-full w-full bg-primary origin-left"
        style={{
          transform: `scaleX(${progress})`,
          willChange: "transform",
          transition: progress === 0
            ? "none"
            : `transform ${progress <= 0.30 ? 120 : progress <= 0.65 ? 280 : progress <= 0.85 ? 350 : 200}ms ease-out`,
        }}
      />
    </div>
  );
}
