import React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (rating: number) => void;
  className?: string;
}

export function StarRating({ rating, max = 5, size = "md", interactive = false, onRate, className }: StarRatingProps) {
  const [hovered, setHovered] = React.useState(0);

  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4.5 w-4.5";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <div className={cn("flex items-center", gap, className)}>
      {Array.from({ length: max }).map((_, i) => {
        const value = i + 1;
        const filled = interactive ? (hovered || rating) >= value : rating >= value;
        const halfFilled = !filled && !interactive && rating >= value - 0.5;

        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            className={cn(
              "transition-colors",
              interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default pointer-events-none"
            )}
            onClick={() => interactive && onRate?.(value)}
            onMouseEnter={() => interactive && setHovered(value)}
            onMouseLeave={() => interactive && setHovered(0)}
            aria-label={`${value} star`}
          >
            <Star
              className={cn(
                sizeClass,
                filled
                  ? "fill-amber-400 text-amber-400"
                  : halfFilled
                  ? "fill-amber-200 text-amber-400"
                  : interactive && hovered >= value
                  ? "fill-amber-300 text-amber-300"
                  : "fill-transparent text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
