export function shortAddr(a: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function fmtDuration(secs: number): string {
  if (secs <= 0) return "0s";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtCountdown(targetSecs: number, nowSecs: number): string {
  return fmtDuration(Math.max(0, targetSecs - nowSecs));
}

export function bpsToPct(bps: number | bigint): string {
  return `${Number(bps) / 100}%`;
}

export function pctToBps(pct: number): number {
  return Math.round(pct * 100);
}

export const STATUS_META: Record<number, { label: string; color: string; desc: string }> = {
  0: { label: "Active", color: "text-alive border-alive/40 bg-alive/10", desc: "Heartbeat is alive. Assets locked but fully owned." },
  1: { label: "Lapsed", color: "text-warn border-warn/40 bg-warn/10", desc: "Heartbeat missed — heirs may now initiate a claim." },
  2: { label: "Challenged", color: "text-gold border-gold/40 bg-gold/10", desc: "A claim is in its challenge window. Owner can still cancel." },
  3: { label: "Claimable", color: "text-gold border-gold/40 bg-gold/10", desc: "Finalized — heirs may withdraw their shares." },
  4: { label: "Drained", color: "text-muted border-line bg-panel2", desc: "All shares withdrawn. The vault rests." },
};
