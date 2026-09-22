import { useEffect, useRef, useState } from "react";
import { fmtDuration } from "../lib/utils";

/**
 * Ticking countdown to a unix-seconds target.
 * `now0` = chain timestamp at fetch time; we extrapolate from it so the UI
 * tracks chain time (matches contract logic even when wall clock drifts or
 * a local node fast-forwards). Baseline resets whenever now0 is refreshed.
 */
export function Countdown({ target, now0, prefix = "", className = "" }: {
  target: number; now0?: number; prefix?: string; className?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const base = useRef<{ now0: number; wall: number } | null>(null);
  if (now0 === undefined || base.current?.now0 !== now0) {
    base.current = now0 === undefined ? null : { now0, wall: Date.now() / 1000 };
  }
  const now = base.current ? base.current.now0 + (Date.now() / 1000 - base.current.wall) : Date.now() / 1000;
  const left = Math.max(0, Math.floor(target - now));
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {prefix}{left === 0 ? "— elapsed —" : fmtDuration(left)}
    </span>
  );
}
