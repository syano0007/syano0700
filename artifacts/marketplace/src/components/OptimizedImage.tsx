import { useState } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> {
  src: string;
  alt: string;
  /** Aspect ratio class applied to the wrapper (e.g. "aspect-square", "aspect-[4/3]"). */
  aspect?: string;
  /** Mark as priority/LCP — uses eager loading + fetchpriority=high. */
  priority?: boolean;
  /** Optional fallback content when src fails to load. */
  fallback?: React.ReactNode;
  /** Wrapper className (the box that reserves the aspect-ratio space). */
  wrapperClassName?: string;
}

/**
 * Production-grade image with:
 *  - Reserved aspect-ratio box (zero CLS).
 *  - Lazy loading by default; eager + fetchpriority=high when `priority`.
 *  - `decoding="async"` to keep the main thread free.
 *  - Shimmer/skeleton background until the image paints.
 *  - Graceful fallback when the URL fails.
 */
export function OptimizedImage({
  src,
  alt,
  aspect = "aspect-square",
  priority = false,
  fallback,
  className,
  wrapperClassName,
  ...rest
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        aspect,
        wrapperClassName,
      )}
    >
      {!loaded && !errored && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted"
        />
      )}

      {errored
        ? (fallback ?? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
              —
            </div>
          ))
        : (
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            {...(priority ? { fetchPriority: "high" } : {} as any)}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
              className,
            )}
            {...rest}
          />
        )}
    </div>
  );
}
