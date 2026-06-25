import React from "react";

/**
 * useCountdown — ticks every second.
 *
 * @param getTarget  A stable getter that returns the current end Date.
 *                   Called on mount and again whenever the target expires,
 *                   so rolling modes can advance automatically.
 */
export function useCountdown(getTarget: () => Date) {
  const getTargetRef = React.useRef(getTarget);
  getTargetRef.current = getTarget;

  const [target, setTarget] = React.useState(getTarget);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      if (target.getTime() <= ts) {
        setTarget(getTargetRef.current());
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const timeLeft     = Math.max(0, target.getTime() - now);
  const totalSeconds = Math.floor(timeLeft / 1000);
  const hours        = Math.floor(totalSeconds / 3600);
  const minutes      = Math.floor((totalSeconds % 3600) / 60);
  const seconds      = totalSeconds % 60;

  return {
    formatted: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    expired: totalSeconds <= 0,
  };
}
