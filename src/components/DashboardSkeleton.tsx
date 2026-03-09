import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-muted/60",
        className
      )}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero card skeleton */}
      <div className="glass-card p-8">
        <div className="flex flex-col items-center gap-4">
          <Shimmer className="h-4 w-32" />
          <Shimmer className="h-12 w-48" />
          <Shimmer className="h-4 w-64" />
          <div className="flex gap-3 mt-2">
            <Shimmer className="h-10 w-36 rounded-xl" />
            <Shimmer className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Shimmer className="h-9 w-9 rounded-xl" />
              <Shimmer className="h-3 w-20" />
            </div>
            <Shimmer className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Alert rows skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-3">
            <Shimmer className="h-2 w-2 rounded-full" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-3 w-40" />
              <Shimmer className="h-2 w-64" />
            </div>
            <Shimmer className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
