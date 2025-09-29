import { cn } from "~/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gray-200 dark:bg-gray-800 rounded",
        className
      )}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
}

export function TaskCardSkeleton({ darkMode = true }: { darkMode?: boolean }) {
  return (
    <div
      className={cn(
        "p-2 md:p-3 rounded-lg border",
        darkMode
          ? "bg-gray-800 border-gray-700"
          : "bg-gray-50 border-gray-200"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 md:gap-3 flex-1">
          <Skeleton className="mt-0.5 w-4 h-4 md:w-5 md:h-5 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 md:h-5 w-3/4 mb-2" />
            <Skeleton className="h-3 md:h-4 w-full mb-2" />
            <div className="flex items-center gap-2 md:gap-4 mt-2">
              <Skeleton className="h-6 w-20 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="w-6 h-6 md:w-8 md:h-8 rounded" />
          <Skeleton className="w-6 h-6 md:w-8 md:h-8 rounded" />
        </div>
      </div>
    </div>
  );
}

export function QuadrantSkeleton({ darkMode = true }: { darkMode?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg p-3 md:p-4 min-h-[250px] md:min-h-[300px]",
        darkMode ? "bg-gray-900" : "bg-white border border-gray-200"
      )}
    >
      <div className="mb-3 md:mb-4 p-2 md:p-3 rounded-lg bg-gray-100/10">
        <Skeleton className="h-5 md:h-6 w-40 mb-2" />
        <Skeleton className="h-3 md:h-4 w-24" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <TaskCardSkeleton key={i} darkMode={darkMode} />
        ))}
      </div>
      <div className="mt-3">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function StatCardSkeleton({ darkMode = true }: { darkMode?: boolean }) {
  return (
    <div
      className={cn(
        "p-3 md:p-4 rounded-lg",
        darkMode ? "bg-gray-900" : "bg-white border border-gray-200"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-3 md:h-4 w-20 mb-2" />
          <Skeleton className="h-6 md:h-8 w-12" />
        </div>
        <Skeleton className="w-6 h-6 md:w-8 md:h-8 rounded" />
      </div>
    </div>
  );
}