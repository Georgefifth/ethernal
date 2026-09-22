import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { STATUS_META } from "../lib/utils";

export function Btn({ children, className = "", variant = "gold", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "ghost" | "danger" }) {
  const base = "px-4 py-2 rounded-lg font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  const styles = {
    gold: "bg-gold text-ink hover:bg-parchment",
    ghost: "border border-line text-parchment hover:border-gold hover:text-gold",
    danger: "bg-warn/15 text-warn border border-warn/40 hover:bg-warn/25",
  } as const;
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest}>{children}</button>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-panel border border-line rounded-xl ${className}`}>{children}</div>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full bg-panel2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-parchment placeholder:text-muted/60 focus:outline-none focus:border-gold ${props.className ?? ""}`} />;
}

export function StatusBadge({ status }: { status: number }) {
  const m = STATUS_META[status] ?? STATUS_META[0];
  return <span className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-mono tracking-wide ${m.color}`}>{m.label.toUpperCase()}</span>;
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs uppercase tracking-widest text-muted mb-1.5">{children}</div>;
}

export function Divider({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="h-px flex-1 bg-line" />
      {children && <span className="text-xs text-muted uppercase tracking-widest">{children}</span>}
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}
