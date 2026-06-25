import { useState } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export default function LazyImage({
  src,
  alt,
  className,
  width,
  height,
  priority = false,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={cn("bg-muted", className)}
        style={{ width, height }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      {!loaded && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-muted animate-pulse rounded-sm",
            className,
          )}
        />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </div>
  );
}
