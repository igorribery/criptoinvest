import * as React from "react";
import { cn } from "@/lib/utils";

export function Avatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900",
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  alt,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [hasError, setHasError] = React.useState(false);
  const src = props.src;

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !src) {
    return null;
  }

  return (
    <img
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-xs font-semibold text-slate-200", className)} {...props} />
  );
}
