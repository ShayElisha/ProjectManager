import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

function Shimmer({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("dashboard-shimmer rounded-xl", className)} style={style} />;
}

export type ViewSkeletonVariant = "cards" | "table" | "detail";

interface ViewSkeletonProps {
  variant?: ViewSkeletonVariant;
  className?: string;
}

export function ViewSkeleton({ variant = "cards", className }: ViewSkeletonProps) {
  if (variant === "table") {
    return (
      <div className={cn("view-skeleton flex flex-col gap-3", className)} aria-busy="true">
        <Shimmer className="h-10 w-full max-w-md" />
        <Shimmer className="h-64 w-full" />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={cn("view-skeleton flex flex-col gap-4", className)} aria-busy="true">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-40 w-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Shimmer className="h-32" />
          <Shimmer className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("view-skeleton grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}
      aria-busy="true"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Shimmer key={i} className="h-28" style={{ animationDelay: `${i * 0.05}s` }} />
      ))}
    </div>
  );
}
