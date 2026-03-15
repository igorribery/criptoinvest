import * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4">{children}</div>;
}

export function DialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full rounded-[2rem] border border-slate-700 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 text-slate-100 shadow-2xl shadow-cyan-950/20",
        className,
      )}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-6 flex items-start justify-between gap-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-4xl font-bold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm uppercase tracking-[0.3em] text-cyan-300", className)} {...props} />;
}
